  import { Router } from 'express';
import { SpotifyControl } from '../spotify/control';
import { ensureValidToken } from '../spotify/auth';
import { SpotifyTrack } from '../types';
import { llmOrchestrator, OPENROUTER_MODELS } from '../llm/orchestrator';
import { llmMonitor } from '../llm/monitoring';
import { RedisConversation, createConversationManager, ConversationEntry, DialogState } from '../utils/redisConversation';

export const simpleLLMInterpreterRouter = Router();

// Conversation manager instance (will be set when Redis is available)
let conversationManager: RedisConversation | null = null;

export function setRedisClient(redisClient: any) {
  if (redisClient) {
    conversationManager = createConversationManager(redisClient);
    console.log('✅ Conversation manager initialized for contextual understanding');
  }
}

// Security constants
const MAX_RESPONSE_SIZE = 10_000; // characters
const INTERPRETATION_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 2;

interface TrackWithScore extends SpotifyTrack {
  relevanceScore: number;
}

// Sanitize response to prevent security issues
function sanitizeResponse(response: string): string {
  return response
    .substring(0, MAX_RESPONSE_SIZE)
    .replace(/[^\x20-\x7E\n\r\t]/g, ''); // ASCII only + common whitespace
}

// Normalize LLM response with defensive parsing
function normalizeResponse(raw: any): any {
  // Handle string responses
  if (typeof raw === 'string') {
    try {
      // Clean markdown code blocks and sanitize
      let cleaned = raw;
      if (cleaned.includes('```json')) {
        cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      } else if (cleaned.includes('```')) {
        cleaned = cleaned.replace(/```\s*/g, '');
      }
      
      // Extract JSON from the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      
      cleaned = sanitizeResponse(cleaned);
      raw = JSON.parse(cleaned);
    } catch {
      return {
        intent: 'unknown',
        error: 'Failed to parse LLM response',
        confidence: 0
      };
    }
  }
  
  // Ensure we have an object
  if (!raw || typeof raw !== 'object') {
    return {
      intent: 'unknown',
      error: 'Invalid response format',
      confidence: 0
    };
  }
  
  // Extract fields flexibly
  return {
    intent: raw.intent || raw.action || raw.command || 'unknown',
    query: raw.query || raw.search || raw.searchQuery || raw.q || '',
    artist: raw.artist || raw.artist_name || raw.artistName || '',
    track: raw.track || raw.song || raw.track_name || raw.trackName || '',
    album: raw.album || raw.album_name || raw.albumName || '',
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.7,
    reasoning: raw.reasoning || raw.explanation || '',
    modifiers: raw.modifiers || {},
    alternatives: Array.isArray(raw.alternatives) ? raw.alternatives : [],
    volume: raw.volume || raw.volume_level || raw.value,
    volume_level: raw.volume_level || raw.volume || raw.value,
    // Preserve any additional fields the LLM provided
    ...raw
  };
}

// Check if low confidence destructive action needs confirmation
function needsConfirmation(interpretation: any): boolean {
  if (!conversationManager) return false;
  
  const isDestructive = conversationManager.isDestructiveAction(interpretation.intent);
  const lowConfidence = interpretation.confidence < 0.7;
  
  return isDestructive && lowConfidence;
}

// Create confirmation response
function createConfirmationResponse(interpretation: any): any {
  const action = interpretation.intent.replace('_', ' ');
  const target = interpretation.track || interpretation.artist || interpretation.query || 'that';
  
  return {
    success: true,
    message: `Are you asking me to ${action} "${target}"? (Low confidence: ${Math.round(interpretation.confidence * 100)}%)`,
    confirmation_needed: true,
    pending_action: interpretation,
    confidence: interpretation.confidence
  };
}

// Simple, flexible interpretation with retries
async function interpretCommand(command: string, sessionId?: string, retryCount = 0): Promise<any> {
  let conversationHistory: ConversationEntry[] = [];
  let dialogState: DialogState | null = null;
  
  // Fetch conversation history and dialog state if we have a session
  if (sessionId && conversationManager) {
    // Get both conversation history and dialog state
    const [history, state] = await Promise.all([
      conversationManager.getHistory(sessionId, 8),
      conversationManager.getDialogState(sessionId)
    ]);
    
    conversationHistory = history;
    dialogState = state;
    
    // Check if this is a contextual reference
    if (conversationManager.isContextualReference(command)) {
      const resolved = conversationManager.resolveContextualReference(command, conversationHistory);
      if (resolved) {
        console.log(`Resolved contextual reference: "${command}" → ${resolved.artist} - ${resolved.track}`);
        // Return a pre-resolved interpretation
        return {
          intent: command.toLowerCase().includes('queue') ? 'queue_specific_song' : 'play_specific_song',
          artist: resolved.artist,
          track: resolved.track,
          confidence: resolved.confidence,
          reasoning: `Resolved from previous context: ${resolved.artist} - ${resolved.track}`,
          query: '',
          modifiers: {},
          alternatives: []
        };
      }
    }
  }
  
  // Get relevant context using smart filtering
  const relevantContext = conversationManager && dialogState ? 
    conversationManager.getRelevantContext(command, conversationHistory, dialogState) : 
    conversationHistory.slice(0, 2);
  
  console.log(`[DEBUG] Command: "${command}"`);
  console.log(`[DEBUG] Full history length: ${conversationHistory.length}`);
  console.log(`[DEBUG] Relevant context length: ${relevantContext.length}`);
  console.log(`[DEBUG] Dialog state last action:`, dialogState?.last_action?.artist, '-', dialogState?.last_action?.track);
  
  if (relevantContext.length > 0) {
    console.log(`[DEBUG] Relevant context entries:`);
    relevantContext.forEach((entry, idx) => {
      console.log(`  ${idx + 1}. ${entry.interpretation.intent}: ${entry.interpretation.artist || 'N/A'} - ${entry.interpretation.track || entry.interpretation.query || 'N/A'}`);
    });
  }
  
  // Format conversation context for the LLM
  const contextBlock = relevantContext.length > 0 ? `
CONVERSATION CONTEXT:
${relevantContext.map((entry, idx) => `
[${idx + 1}] User: "${entry.command}"
    Intent: ${entry.interpretation.intent}
    ${entry.interpretation.artist ? `Artist: ${entry.interpretation.artist}` : ''}
    ${entry.interpretation.track ? `Track: ${entry.interpretation.track}` : ''}
    ${entry.interpretation.query ? `Query: ${entry.interpretation.query}` : ''}
    ${entry.interpretation.alternatives && entry.interpretation.alternatives.length > 0 ? 
      `Alternatives shown: ${entry.interpretation.alternatives.join(', ')}` : ''}
`).join('\n')}

IMPORTANT: If the user is referencing something from the conversation above (like "no the taylor swift one", "the second one", "actually play X instead"), look for it in the alternatives or context and respond with the specific song they're referring to.
` : '';
  
  const prompt = `You are an advanced music command interpreter for Spotify with deep knowledge of music.

${contextBlock}
[DEBUG: Relevant context entries: ${relevantContext.length}]

AVAILABLE INTENTS - Choose the most appropriate one:

=== SONG INTENTS (require specific song recommendations) ===
• play_specific_song - Play a specific song based on vague/mood/cultural descriptions
• queue_specific_song - Queue a specific song based on vague/mood/cultural descriptions

=== PLAYLIST INTENTS (use search queries) ===
• play_playlist - Search and play a playlist immediately
• queue_playlist - Search and queue a playlist

=== CONTROL INTENTS ===
• pause - Pause playback
• play/resume - Resume playback (no parameters needed)
• skip/next - Skip to next track
• previous/back - Go to previous track
• set_volume - Set volume level (requires volume_level field)
• get_current_track - Get currently playing track info
• set_shuffle - Enable/disable shuffle (requires enabled field)
• set_repeat - Enable/disable repeat (requires enabled field)
• clear_queue - Clear the playback queue

=== CONVERSATIONAL INTENTS (return text, no Spotify action) ===
• chat - General music discussion ("what do you think of this artist")
• ask_question - Questions about collaborations, facts ("did he collaborate with X")
• get_info - Information about current/previous songs ("tell me about this song")

=== OTHER INTENTS ===
• search - Search without playing (requires query)
• get_devices - List available devices
• get_playlists - Get user's playlists
• get_recently_played - Get recently played tracks
• queue_add - Generic queue add (DEPRECATED - use queue_specific_song for songs)

CRITICAL DISTINCTIONS:

1. SPECIFIC SONG REQUESTS (use play_specific_song or queue_specific_song):
   - "play something for assassins creed" → play_specific_song with "Ezio's Family" by Jesper Kyd
   - "queue the most obscure Taylor Swift song" → queue_specific_song with "I'd Lie"
   - "play taylor swift" → play_specific_song with a popular Taylor Swift song
   - "queue taylor swift" → queue_specific_song with a popular Taylor Swift song
   - "add something melancholy to queue" → queue_specific_song with specific sad song
   - "play bohemian rhapsody" → play_specific_song (even though it's specific, still use this intent)
   - "queue bohemian rhapsody" → queue_specific_song (for consistency)

2. PLAYLIST REQUESTS (use play_playlist or queue_playlist):
   - "play my workout playlist" → play_playlist with query: "workout"
   - "queue up a jazz playlist" → queue_playlist with query: "jazz"
   - "play taylor swift playlist" → play_playlist with query: "taylor swift"
   - "play my discover weekly" → play_playlist with query: "discover weekly"

3. CONVERSATIONAL vs ACTION DISTINCTION:
   - Questions starting with "did", "does", "has", "tell me about", "what do you think" → conversational intents
   - Commands requesting action "play", "queue", "skip" → action intents
   - "did he ever collaborate with X" → ask_question (return text, don't play music)
   - "tell me about this song" → get_info (return info, don't play music)
   - "what do you think of this artist" → chat (return opinion, don't play music)

4. KEY DISTINCTION:
   - If asking for A SONG (even by name) → use play_specific_song/queue_specific_song
   - If asking for A PLAYLIST → use play_playlist/queue_playlist
   - If asking QUESTIONS → use conversational intents (chat/ask_question/get_info)
   - The word "playlist" in the command is a strong indicator for playlist intents

RESPONSE FORMAT:
For specific song requests (both play and queue):
{
  "intent": "play_specific_song" or "queue_specific_song",
  "artist": "Exact Artist Name",
  "track": "Exact Song Title",
  "album": "Album Name (optional)",
  "confidence": 0.8-1.0,
  "reasoning": "Why this specific song matches their request",
  "alternatives": [
    "Artist Name - Song Title",
    "Artist Name - Song Title",
    "Artist Name - Song Title",
    "Artist Name - Song Title",
    "Artist Name - Song Title"
  ]
}

For playlist requests:
{
  "intent": "play_playlist" or "queue_playlist",
  "query": "playlist search terms",
  "confidence": 0.7-1.0,
  "reasoning": "brief explanation"
}

For conversational requests:
{
  "intent": "chat" or "ask_question" or "get_info",
  "confidence": 0.8-1.0,
  "reasoning": "explain why this is conversational and what information to provide"
}

Other intents remain the same: pause, skip, volume, get_current_track, etc.

Command: "${command}"`;

  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('LLM timeout')), INTERPRETATION_TIMEOUT)
    );
    
    const responsePromise = llmOrchestrator.complete({
      messages: [
        { role: 'system', content: 'Respond with valid JSON. Be helpful and specific. Include confidence scores. CRITICAL: You must use the discriminated union pattern - when intent is "play_specific_song" or "queue_specific_song", you MUST include artist, track, and alternatives fields. When intent is "play_playlist" or "queue_playlist", use query field. Never use generic search queries for specific song requests - always recommend exact songs using your music knowledge. Distinguish between playing (immediate) and queuing (add to queue) for both songs and playlists.' },
        { role: 'user', content: prompt }
      ],
      model: OPENROUTER_MODELS.CLAUDE_SONNET_4,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });
    
    const response = await Promise.race([responsePromise, timeoutPromise]) as any;
    const normalized = normalizeResponse(response.content);
    
    // Validate we got something useful
    if (normalized.intent === 'unknown' && retryCount < MAX_RETRIES) {
      console.log(`Retry ${retryCount + 1} for command interpretation`);
      return interpretCommand(command, sessionId, retryCount + 1);
    }
    
    return normalized;
  } catch (error) {
    console.error('LLM interpretation error:', error);
    
    // Retry with a different model if we haven't exhausted retries
    if (retryCount < MAX_RETRIES) {
      const fallbackModels = [
        OPENROUTER_MODELS.GEMINI_2_5_FLASH,
        OPENROUTER_MODELS.O3_PRO
      ];
      
      try {
        const response = await llmOrchestrator.complete({
          messages: [
            { role: 'system', content: 'Respond with JSON for this music command.' },
            { role: 'user', content: command }
          ],
          model: fallbackModels[retryCount],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        });
        
        return normalizeResponse(response.content);
      } catch (retryError) {
        console.error(`Fallback model ${fallbackModels[retryCount]} also failed:`, retryError);
      }
    }
    
    // Final fallback - basic keyword matching
    const lowerCommand = command.toLowerCase();
    return {
      intent: lowerCommand.includes('play') ? 'search_and_play' : 
              lowerCommand.includes('pause') ? 'pause' :
              lowerCommand.includes('skip') || lowerCommand.includes('next') ? 'skip' :
              lowerCommand.includes('volume') ? 'volume' : 'unknown',
      query: command.replace(/^(play|search for|find)\s+/i, ''),
      confidence: 0.3,
      reasoning: 'Basic keyword matching fallback'
    };
  }
}

// Build Spotify search query - embrace flexibility
function buildSearchQuery(interpretation: any): string {
  // For specific song intents (both play and queue), always use precise search
  if ((interpretation.intent === 'play_specific_song' || interpretation.intent === 'queue_specific_song') 
      && interpretation.artist && interpretation.track) {
    // Use Spotify's precise search operators for exact matching
    return `artist:"${interpretation.artist}" track:"${interpretation.track}"`;
  }
  
  // If LLM gave us a specific artist and track (legacy behavior), use precise search
  if (interpretation.artist && interpretation.track) {
    return `artist:"${interpretation.artist}" track:"${interpretation.track}"`;
  }
  
  // Otherwise use whatever the LLM thought was best (for playlists, etc.)
  return interpretation.query || interpretation.searchQuery || 
         `${interpretation.track || ''} ${interpretation.artist || ''}`.trim();
}

// Simple modifier application
function rankTracks(tracks: SpotifyTrack[], interpretation: any): TrackWithScore[] {
  return tracks.map(track => {
    let score = 1.0;
    
    // If looking for obscure, prefer low popularity
    if (interpretation.obscure || interpretation.modifiers?.obscurity === 'obscure') {
      score *= (100 - (track.popularity || 50)) / 100;
    }
    
    // If original version requested, penalize remasters
    if (interpretation.original || interpretation.version === 'original') {
      if (track.name.toLowerCase().includes('remaster') ||
          track.album.name.toLowerCase().includes('remaster')) {
        score *= 0.3;
      }
    }
    
    return { ...track, relevanceScore: score };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Health check endpoint
simpleLLMInterpreterRouter.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    interpreter: 'flexible',
    models: llmOrchestrator.getAvailableModels().length
  });
});

// Clear conversation history endpoint
simpleLLMInterpreterRouter.post('/clear-history', ensureValidToken, async (req, res) => {
  try {
    const sessionId = req.sessionID;
    
    if (sessionId && conversationManager) {
      // Clear both conversation history and dialog state
      await Promise.all([
        conversationManager.clear(sessionId),
        conversationManager.updateDialogState(sessionId, {
          last_action: null,
          last_candidates: [],
          interaction_mode: 'music',
          updated_at: Date.now()
        })
      ]);
      
      console.log(`[CLEAR] Conversation history cleared for session ${sessionId}`);
      
      res.json({
        success: true,
        message: 'Conversation history cleared',
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        message: 'No active session to clear',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error clearing conversation history:', error);
    res.status(500).json({
      error: 'Failed to clear conversation history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Main command endpoint
simpleLLMInterpreterRouter.post('/command', ensureValidToken, async (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }
  
  // Sanitize input command
  if (typeof command !== 'string' || command.length > 500) {
    return res.status(400).json({ error: 'Invalid command format or too long' });
  }

  console.log('Processing command:', command);
  const startTime = Date.now();

  try {
    // Get session ID from request
    const sessionId = req.sessionID;
    console.log('Session ID:', sessionId);
    
    const interpretation = await interpretCommand(command, sessionId);
    console.log('LLM interpretation:', interpretation);

    const spotifyControl = new SpotifyControl(
      req.session.spotifyTokens!,
      (tokens) => { req.session.spotifyTokens = tokens; }
    );

    let result;

    // Log interpretation for monitoring
    console.log('Interpretation:', {
      command,
      intent: interpretation.intent,
      confidence: interpretation.confidence,
      model: interpretation.model || 'unknown'
    });

    // Check if we need confirmation for low-confidence destructive actions
    if (needsConfirmation(interpretation)) {
      const confirmationResponse = createConfirmationResponse(interpretation);
      
      res.json({
        ...confirmationResponse,
        interpretation: {
          command: command,
          intent: interpretation.intent,
          confidence: interpretation.confidence,
          searchQuery: buildSearchQuery(interpretation),
          ...(interpretation.reasoning && { reasoning: interpretation.reasoning }),
          model: 'unknown'
        },
        timestamp: new Date().toISOString()
      });
      
      return;
    }

    // Handle different intents flexibly
    const intent = interpretation.intent || interpretation.action;
    
    // Handle conversational intents (return text, no Spotify action)
    if (intent === 'chat' || intent === 'ask_question' || intent === 'get_info') {
      result = {
        success: true,
        message: interpretation.reasoning || "I'd be happy to discuss that with you!",
        conversational: true // Flag to indicate no Spotify action
      };
    } else if (intent === 'play_specific_song' || intent === 'queue_specific_song' || ((intent?.includes('play') || intent?.includes('search')) && intent !== 'play_playlist' && intent !== 'queue_playlist')) {
      const searchQuery = buildSearchQuery(interpretation);
      
      if (!searchQuery) {
        return res.json({
          success: false,
          message: "I couldn't understand what you want to play",
          interpretation
        });
      }

      console.log(`Spotify search: "${searchQuery}"`);
      const tracks = await spotifyControl.search(searchQuery);
      const ranked = rankTracks(tracks, interpretation);

      if (ranked.length === 0) {
        result = {
          success: false,
          message: `No tracks found for: "${searchQuery}"`,
        };
      } else {
        const track = ranked[0];
        
        // Check intent for queue vs play - now properly handles queue_specific_song
        if (intent === 'queue_specific_song' || intent?.includes('queue')) {
          await spotifyControl.queueTrackByUri(track.uri);
          result = {
            success: true,
            message: `Added to queue: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`
          };
        } else {
          await spotifyControl.playTrack(track.uri);
          result = {
            success: true,
            message: `Playing: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`
          };
        }

        // Add alternatives if we found multiple good matches
        if (ranked.length > 1) {
          (result as any).alternatives = ranked.slice(1, 5).map(t => ({
            name: t.name,
            artists: t.artists.map(a => a.name).join(', '),
            popularity: t.popularity,
            uri: t.uri
          }));
        }
      }
    } else if (intent === 'pause') {
      result = await spotifyControl.pause();
    } else if (intent === 'play' || intent === 'resume') {
      result = await spotifyControl.play();
    } else if (intent === 'skip' || intent === 'next') {
      result = await spotifyControl.skip();
    } else if (intent === 'previous' || intent === 'back') {
      result = await spotifyControl.previous();
    } else if (intent?.includes('volume') || intent === 'set_volume') {
      const volume = interpretation.volume || interpretation.volume_level || interpretation.value;
      if (volume !== undefined) {
        // Convert volume strings to numbers if needed
        let volumeValue = volume;
        if (typeof volume === 'string') {
          if (volume.toLowerCase() === 'full' || volume.toLowerCase() === 'max') {
            volumeValue = 100;
          } else if (volume.toLowerCase() === 'half' || volume.toLowerCase() === 'medium') {
            volumeValue = 50;
          } else if (volume.toLowerCase() === 'low' || volume.toLowerCase() === 'min') {
            volumeValue = 10;
          } else {
            volumeValue = parseInt(volume) || 50;
          }
        }
        result = await spotifyControl.setVolume(volumeValue);
      } else {
        result = { success: false, message: 'No volume level specified' };
      }
    } else if (intent === 'get_current_track' || intent?.includes('current') || intent?.includes('playing')) {
      result = await spotifyControl.getCurrentTrack();
    } else if (intent === 'set_shuffle' || intent?.includes('shuffle')) {
      const enabled = interpretation.enabled !== undefined ? interpretation.enabled : 
                     (interpretation.state !== 'off' && interpretation.state !== 'false');
      result = await spotifyControl.setShuffle(enabled);
    } else if (intent === 'set_repeat' || intent?.includes('repeat')) {
      const enabled = interpretation.enabled !== undefined ? interpretation.enabled : 
                     (interpretation.state !== 'off' && interpretation.state !== 'false');
      result = await spotifyControl.setRepeat(enabled);
    } else if (intent === 'get_devices' || intent?.includes('devices')) {
      result = await spotifyControl.getDevices();
    } else if (intent === 'search' && !intent?.includes('play')) {
      const searchQuery = buildSearchQuery(interpretation);
      if (!searchQuery) {
        result = { success: false, message: "I need something to search for" };
      } else {
        const tracks = await spotifyControl.search(searchQuery);
        const ranked = rankTracks(tracks, interpretation);
        result = {
          success: true,
          message: `Found ${tracks.length} tracks for: "${searchQuery}"`,
          tracks: ranked.slice(0, 10).map(t => ({
            name: t.name,
            artists: t.artists.map(a => a.name).join(', '),
            album: t.album.name,
            popularity: t.popularity,
            uri: t.uri
          }))
        };
      }
    } else if (intent === 'queue_add' || intent?.includes('queue')) {
      const searchQuery = buildSearchQuery(interpretation);
      if (!searchQuery) {
        result = { success: false, message: "I need something to add to the queue" };
      } else {
        result = await spotifyControl.queueTrack(searchQuery);
      }
    } else if (intent === 'get_recommendations' || intent?.includes('recommend')) {
      const trackId = interpretation.track_id || interpretation.trackId;
      if (!trackId) {
        result = { success: false, message: "I need a track ID to get recommendations" };
      } else {
        result = await spotifyControl.getRecommendations(trackId);
      }
    } else if (intent === 'get_playlists' || intent?.includes('playlists')) {
      result = await spotifyControl.getPlaylists();
    } else if (intent === 'get_playlist_tracks' || intent?.includes('playlist_tracks')) {
      const playlistId = interpretation.playlist_id || interpretation.playlistId;
      if (!playlistId) {
        result = { success: false, message: "I need a playlist ID to get tracks" };
      } else {
        result = await spotifyControl.getPlaylistTracks(playlistId);
      }
    } else if (intent === 'play_playlist' || intent?.includes('play_playlist')) {
      const playlistUri = interpretation.playlist_uri || interpretation.playlistUri;
      const searchQuery = interpretation.query || interpretation.search_query;
      
      console.log(`[DEBUG] play_playlist intent detected. URI: ${playlistUri}, Query: ${searchQuery}`);
      
      if (playlistUri) {
        // Play playlist by URI
        console.log(`[DEBUG] Playing playlist by URI: ${playlistUri}`);
        result = await spotifyControl.playPlaylist(playlistUri);
      } else if (searchQuery) {
        // Search for playlist and play it
        console.log(`[DEBUG] Searching for playlist: ${searchQuery}`);
        result = await spotifyControl.searchAndPlayPlaylist(searchQuery);
      } else {
        console.log(`[DEBUG] No playlist URI or query provided`);
        result = { success: false, message: "I need a playlist name or URI to play" };
      }
    } else if (intent === 'queue_playlist' || intent?.includes('queue_playlist')) {
      const playlistUri = interpretation.playlist_uri || interpretation.playlistUri;
      const searchQuery = interpretation.query || interpretation.search_query;
      
      console.log(`[DEBUG] queue_playlist intent detected. URI: ${playlistUri}, Query: ${searchQuery}`);
      
      if (playlistUri) {
        // Queue playlist by URI (extract ID from URI)
        const playlistId = playlistUri.split(':').pop() || playlistUri.split('/').pop();
        console.log(`[DEBUG] Queuing playlist by URI/ID: ${playlistId}`);
        result = await spotifyControl.queuePlaylist(playlistId);
      } else if (searchQuery) {
        // Search for playlist and queue it
        console.log(`[DEBUG] Searching and queuing playlist: ${searchQuery}`);
        result = await spotifyControl.searchAndQueuePlaylist(searchQuery);
      } else {
        console.log(`[DEBUG] No playlist URI or query provided for queue`);
        result = { success: false, message: "I need a playlist name or URI to queue" };
      }
    } else if (intent === 'get_recently_played' || intent?.includes('recently') || intent?.includes('history')) {
      result = await spotifyControl.getRecentlyPlayed();
    } else if (intent === 'transfer_playback' || intent?.includes('transfer')) {
      const deviceId = interpretation.device_id || interpretation.deviceId;
      if (!deviceId) {
        result = { success: false, message: "I need a device ID to transfer playback" };
      } else {
        const play = interpretation.play !== undefined ? interpretation.play : true;
        result = await spotifyControl.transferPlayback(deviceId, play);
      }
    } else if (intent === 'seek' || intent?.includes('seek')) {
      const position = interpretation.position || interpretation.seconds || interpretation.time;
      if (position === undefined) {
        result = { success: false, message: "I need a position in seconds to seek to" };
      } else {
        result = await spotifyControl.seekToPosition(position);
      }
    } else if (intent === 'clear_queue' || intent?.includes('clear')) {
      console.log(`[DEBUG] clear_queue intent detected`);
      result = await spotifyControl.clearQueue();
    } else {
      result = { 
        success: false, 
        message: `I don't know how to: ${intent || command}`
      };
    }

    const responseData = {
      ...result,
      interpretation: {
        command: command,
        intent: interpretation.intent,
        confidence: interpretation.confidence,
        searchQuery: buildSearchQuery(interpretation),
        ...(interpretation.reasoning && { reasoning: interpretation.reasoning }),
        ...(interpretation.alternatives && { alternatives: interpretation.alternatives }),
        model: 'unknown' // Add model info
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(responseData);
    
    // Record successful interpretation
    llmMonitor.recordInterpretation(command, interpretation, startTime, true);
    
    // Store conversation entry and update dialog state in Redis for future context
    if (sessionId && conversationManager) {
      // Get current dialog state
      const currentDialogState = await conversationManager.getDialogState(sessionId);
      
      // Store conversation entry
      const conversationEntry: ConversationEntry = {
        command: command,
        interpretation: interpretation,
        timestamp: Date.now(),
        response: {
          success: result.success || false,
          message: result.message || ''
        }
      };
      
      // Update dialog state based on the action
      const updatedDialogState = conversationManager.updateDialogStateFromAction(
        currentDialogState,
        interpretation,
        interpretation.alternatives || []
      );
      
      // Save both conversation and dialog state
      await Promise.all([
        conversationManager.append(sessionId, conversationEntry),
        conversationManager.updateDialogState(sessionId, updatedDialogState)
      ]);
      
      console.log(`Dialog state updated: mode=${updatedDialogState.interaction_mode}, last_action=${updatedDialogState.last_action?.type || 'none'}`);
    }

  } catch (error) {
    console.error('Command error:', error);
    
    // More specific error handling
    let errorMessage = 'Failed to process command';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('No active device')) {
        errorMessage = 'No active Spotify device found. Please start playing music on a device first.';
        statusCode = 400;
      } else if (error.message.includes('Premium required')) {
        errorMessage = 'This feature requires Spotify Premium.';
        statusCode = 403;
      } else if (error.message.includes('Rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
        statusCode = 429;
      } else if (error.message.includes('Invalid API key') || error.message.includes('Unauthorized')) {
        errorMessage = 'Spotify authentication expired. Please reconnect.';
        statusCode = 401;
      }
    }
    
    // Record failed interpretation
    llmMonitor.recordInterpretation(
      command, 
      null, 
      startTime, 
      false, 
      error instanceof Error ? error.message : 'Unknown error'
    );
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test endpoint
simpleLLMInterpreterRouter.get('/test', async (req, res) => {
  const testCommands = [
    "play something mellow",
    "play the song about friendship bracelets",
    "play the most obscure Taylor Swift song"
  ];

  const results = [];
  for (const cmd of testCommands) {
    try {
      const interpretation = await interpretCommand(cmd);
      results.push({ command: cmd, interpretation });
    } catch (error) {
      results.push({ command: cmd, error: error instanceof Error ? error.message : 'Failed' });
    }
  }

  res.json({ results });
});

// Extended test endpoint with custom command
simpleLLMInterpreterRouter.post('/test-interpret', async (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }

  try {
    const startTime = Date.now();
    const sessionId = req.sessionID;
    const interpretation = await interpretCommand(command, sessionId);
    const responseTime = Date.now() - startTime;
    
    // Store conversation entry for testing (same as main endpoint)
    if (sessionId && conversationManager) {
      // Get current dialog state
      const currentDialogState = await conversationManager.getDialogState(sessionId);
      
      // Store conversation entry
      const conversationEntry: ConversationEntry = {
        command: command,
        interpretation: interpretation,
        timestamp: Date.now(),
        response: {
          success: true,
          message: 'Test interpretation'
        }
      };
      
      // Update dialog state based on the action
      const updatedDialogState = conversationManager.updateDialogStateFromAction(
        currentDialogState,
        interpretation,
        interpretation.alternatives || []
      );
      
      // Save both conversation and dialog state
      await Promise.all([
        conversationManager.append(sessionId, conversationEntry),
        conversationManager.updateDialogState(sessionId, updatedDialogState)
      ]);
      
      console.log(`[TEST] Conversation stored for session ${sessionId}`);
    }
    
    res.json({
      command,
      interpretation,
      responseTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      command,
      error: error instanceof Error ? error.message : 'Failed to interpret',
      timestamp: new Date().toISOString()
    });
  }
});

// Monitoring stats endpoint
simpleLLMInterpreterRouter.get('/stats', ensureValidToken, (req, res) => {
  const stats = llmMonitor.getStats();
  res.json({
    interpreter: 'flexible',
    ...stats
  });
});