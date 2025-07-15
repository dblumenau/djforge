  import { Router } from 'express';
import { SpotifyControl } from '../spotify/control';
import { ensureValidToken } from '../spotify/auth';
import { SpotifyTrack, SpotifyAuthTokens } from '../types';
import { llmOrchestrator, OPENROUTER_MODELS } from '../llm/orchestrator';
import { llmMonitor } from '../llm/monitoring';
import { RedisConversation, createConversationManager, ConversationEntry, DialogState } from '../utils/redisConversation';
import { verifyJWT, extractTokenFromHeader } from '../utils/jwt';

export const simpleLLMInterpreterRouter = Router();

// Conversation manager instance (will be set when Redis is available)
let conversationManager: RedisConversation | null = null;

// Redis client reference for model preferences
let redisClient: any = null;

export function setRedisClient(client: any) {
  redisClient = client;
  if (client) {
    conversationManager = createConversationManager(client);
    console.log('✅ Conversation manager initialized for contextual understanding');
  }
}

// Helper to get user ID from JWT
function getUserIdFromRequest(req: any): string | null {
  const authHeader = req.headers.authorization;
  const jwtToken = extractTokenFromHeader(authHeader);
  
  if (!jwtToken) return null;
  
  const payload = verifyJWT(jwtToken);
  if (!payload) return null;
  
  // Return the stable Spotify user ID from JWT
  return payload.sub || payload.spotify_user_id || null;
}

// Get user's model preference from Redis
async function getUserModelPreference(userId: string): Promise<string | null> {
  if (!redisClient) return null;
  
  try {
    const key = `user:${userId}:model_preference`;
    const preference = await redisClient.get(key);
    return preference;
  } catch (error) {
    console.error('Error getting model preference from Redis:', error);
    return null;
  }
}

// Security constants
const MAX_RESPONSE_SIZE = 10_000; // characters
const INTERPRETATION_TIMEOUT = 120000; // 120 seconds - support slow models like Gemini
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
async function interpretCommand(command: string, userId?: string, retryCount = 0, preferredModel?: string): Promise<any> {
  let conversationHistory: ConversationEntry[] = [];
  let dialogState: DialogState | null = null;
  
  // Fetch conversation history and dialog state if we have a user ID
  if (userId && conversationManager) {
    // Get both conversation history and dialog state
    const [history, state] = await Promise.all([
      conversationManager.getHistory(userId, 8),
      conversationManager.getDialogState(userId)
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

CRITICAL FIRST STEP: Determine if this is a QUESTION/CONVERSATION or a MUSIC ACTION command.

AVAILABLE INTENTS - Choose the most appropriate one:

=== CONVERSATIONAL INTENTS (return text, NO Spotify action) ===
• chat - General music discussion ("what do you think of this artist", "how's the song")
• ask_question - Questions about collaborations, facts ("did he collaborate with X", "has she ever worked with Y")
• get_info - Information requests ("tell me about this song", "what's this album about")

CONVERSATIONAL TRIGGERS (these are NOT music actions):
- Questions starting with: "did", "does", "has", "tell me about", "what do you think", "how is", "what's"
- Information requests: "tell me about", "what about", "info on"
- General discussion: "what do you think", "how do you feel", "your opinion"

=== SONG INTENTS (require specific song recommendations) ===
• play_specific_song - Play a specific song based on vague/mood/cultural descriptions
• queue_specific_song - Queue a specific song based on vague/mood/cultural descriptions
• queue_multiple_songs - Queue multiple songs (5-10) based on similarity, mood, or theme

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

=== OTHER INTENTS ===
• search - Search without playing (requires query)
• get_devices - List available devices
• get_playlists - Get user's playlists
• get_recently_played - Get recently played tracks

CRITICAL DISTINCTIONS:

1. SPECIFIC SONG REQUESTS (use play_specific_song, queue_specific_song, or queue_multiple_songs):
   - "play something for assassins creed" → play_specific_song with "Ezio's Family" by Jesper Kyd
   - "queue the most obscure Taylor Swift song" → queue_specific_song with "I'd Lie"
   - "play taylor swift" → play_specific_song with a popular Taylor Swift song
   - "queue taylor swift" → queue_specific_song with a popular Taylor Swift song
   - "add something melancholy to queue" → queue_specific_song with specific sad song
   - "play bohemian rhapsody" → play_specific_song (even though it's specific, still use this intent)
   - "queue bohemian rhapsody" → queue_specific_song (for consistency)
   - "queue up many more songs like heaven by beyonce" → queue_multiple_songs with multiple obscure Beyoncé tracks
   - "add several upbeat songs to queue" → queue_multiple_songs with 5-10 upbeat songs
   - "queue multiple taylor swift deep cuts" → queue_multiple_songs with multiple lesser-known Taylor Swift songs

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
   - If asking for MULTIPLE SONGS → use queue_multiple_songs
   - If asking for A PLAYLIST → use play_playlist/queue_playlist
   - If asking QUESTIONS → use conversational intents (chat/ask_question/get_info)
   - The word "playlist" in the command is a strong indicator for playlist intents
   - Words like "multiple", "many", "several", "more songs", "a few songs" indicate queue_multiple_songs

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

For multiple song requests:
{
  "intent": "queue_multiple_songs",
  "songs": [
    {
      "artist": "Artist Name",
      "track": "Song Title",
      "album": "Album Name (optional)"
    },
    {
      "artist": "Artist Name",
      "track": "Song Title",
      "album": "Album Name (optional)"
    },
    ... (5-10 songs total)
  ],
  "confidence": 0.8-1.0,
  "reasoning": "Why these songs match the request theme/mood/similarity",
  "theme": "Brief description of the common theme (e.g., 'obscure Beyoncé tracks', 'upbeat indie songs')"
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
      model: preferredModel || OPENROUTER_MODELS.GEMINI_2_5_FLASH,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });
    
    const response = await Promise.race([responsePromise, timeoutPromise]) as any;
    const normalized = normalizeResponse(response.content);
    
    // Validate we got something useful
    if (normalized.intent === 'unknown' && retryCount < MAX_RETRIES) {
      console.log(`Retry ${retryCount + 1} for command interpretation`);
      return interpretCommand(command, userId, retryCount + 1, preferredModel);
    }
    
    return normalized;
  } catch (error) {
    console.error('LLM interpretation error:', error);
    
    // Retry with a different model if we haven't exhausted retries
    if (retryCount < MAX_RETRIES) {
      const fallbackModels = [
        OPENROUTER_MODELS.CLAUDE_SONNET_4,
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
      intent: lowerCommand.includes('play') ? 'play_specific_song' : 
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
    let query = `artist:"${interpretation.artist}" track:"${interpretation.track}"`;
    // Include album if provided to distinguish between different versions
    if (interpretation.album) {
      query += ` album:"${interpretation.album}"`;
    }
    return query;
  }
  
  // If LLM gave us a specific artist and track (legacy behavior), use precise search
  if (interpretation.artist && interpretation.track) {
    let query = `artist:"${interpretation.artist}" track:"${interpretation.track}"`;
    // Include album if provided to distinguish between different versions
    if (interpretation.album) {
      query += ` album:"${interpretation.album}"`;
    }
    return query;
  }
  
  // Otherwise use whatever the LLM thought was best (for playlists, etc.)
  return interpretation.query || interpretation.searchQuery || 
         `${interpretation.track || ''} ${interpretation.artist || ''}`.trim();
}

// Handle conversational queries by getting actual answers
async function handleConversationalQuery(
  command: string, 
  intent: string, 
  conversationHistory: ConversationEntry[],
  dialogState: DialogState | null,
  preferredModel?: string
): Promise<string> {
  try {
    // Build context about recent music if available
    let musicContext = '';
    if (dialogState?.last_action) {
      const lastAction = dialogState.last_action;
      musicContext = `\nRecent music context: ${lastAction.type === 'play' ? 'Currently playing' : 'Recently queued'} "${lastAction.track || lastAction.query}" by ${lastAction.artist || 'Unknown Artist'}`;
    }

    // Include recent conversation for context
    const recentContext = conversationHistory.slice(-3).map(entry => 
      `User: "${entry.command}" → ${entry.interpretation.artist ? `${entry.interpretation.artist} - ${entry.interpretation.track || ''}` : entry.interpretation.query || ''}`
    ).join('\n');

    const conversationalPrompt = `You are a knowledgeable music assistant integrated with Spotify. Answer the user's question conversationally and informatively.

${recentContext ? `Recent conversation:\n${recentContext}` : ''}${musicContext}

User's question: "${command}"

Provide a helpful, informative response. If the question is about music history, collaborations, facts, or seeking information, give accurate details. If asking about the current/recent music, use the context provided. Keep the response concise but informative.`;

    const response = await llmOrchestrator.complete({
      messages: [
        { role: 'system', content: 'You are a friendly and knowledgeable music assistant. Provide accurate, helpful information about music, artists, and songs. Keep responses concise but informative.' },
        { role: 'user', content: conversationalPrompt }
      ],
      model: preferredModel || OPENROUTER_MODELS.GEMINI_2_5_FLASH,
      temperature: 0.7
    });

    return response.content || "I'd be happy to help! Could you clarify what you'd like to know?";
  } catch (error) {
    console.error('Conversational query error:', error);
    return "I'm having trouble processing that question right now. Could you try rephrasing it?";
  }
}

// Canonicalize intent to avoid conflicts between generic and specific patterns
function canonicalizeIntent(raw: string | undefined): string | null {
  const intent = (raw ?? '').toLowerCase().trim();

  // 1. Exact, high-priority matches first
  const exact = [
    'play_specific_song', 'queue_specific_song', 'queue_multiple_songs',
    'pause', 'play', 'resume', 'skip', 'next', 'previous', 'back',
    'set_volume', 'get_current_track',
    'set_shuffle', 'set_repeat', 'get_devices', 'search',
    'get_recommendations', 'get_playlists', 'get_playlist_tracks',
    'play_playlist', 'queue_playlist',
    'get_recently_played', 'transfer_playback', 'seek', 'clear_queue'
  ];
  if (exact.includes(intent)) return intent;

  // 2. Substring/fuzzy matches in STRICT priority order (specific > generic)
  if (intent.includes('volume')) return 'set_volume';
  if (intent.includes('current') || intent.includes('playing')) return 'get_current_track';
  if (intent.includes('recommend')) return 'get_recommendations';
  if (intent.includes('shuffle')) return 'set_shuffle';
  if (intent.includes('repeat')) return 'set_repeat';
  if (intent.includes('devices')) return 'get_devices';
  if (intent.includes('recently') || intent.includes('history')) return 'get_recently_played';
  if (intent.includes('transfer')) return 'transfer_playback';
  if (intent.includes('seek')) return 'seek';
  if (intent.includes('clear')) return 'clear_queue';

  // Playlist-related need disambiguation (specific > generic)
  if (intent.includes('queue') && intent.includes('playlist')) return 'queue_playlist';
  if (intent.includes('play') && intent.includes('playlist')) return 'play_playlist';
  if (intent.includes('tracks') && intent.includes('playlist')) return 'get_playlist_tracks';
  if (intent.includes('playlist')) return 'get_playlists';

  // Generic fallbacks
  if (intent.includes('queue')) return 'queue_specific_song';
  if (intent.includes('play') || intent.includes('search')) return 'play_specific_song';

  return null; // unknown
}

// Simple modifier application
function rankTracks(tracks: SpotifyTrack[], interpretation: any): TrackWithScore[] {
  return tracks.map(track => {
    let score = 1.0;
    
    // If looking for obscure, prefer low popularity
    if (interpretation.obscure || interpretation.modifiers?.obscurity === 'obscure') {
      score *= (100 - (track.popularity || 50)) / 100;
    }
    
    // If we have a specific album name in the interpretation, prefer exact matches
    if (interpretation.album) {
      const targetAlbum = interpretation.album.toLowerCase();
      const actualAlbum = track.album.name.toLowerCase();
      
      // Exact match gets full score
      if (actualAlbum === targetAlbum) {
        score *= 1.0;
      }
      // No match gets lower score
      else {
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

// Get conversation history endpoint
simpleLLMInterpreterRouter.get('/history', ensureValidToken, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    
    if (!userId || !conversationManager) {
      return res.json({ 
        history: [],
        timestamp: new Date().toISOString()
      });
    }
    
    // Get up to 100 most recent conversation entries
    const history = await conversationManager.getHistory(userId, 100);
    
    // Format history to match client's expected structure
    const formattedHistory = history.map(entry => ({
      command: entry.command,
      response: entry.response?.message || '',
      confidence: entry.interpretation?.confidence,
      isEnhanced: true,
      timestamp: entry.timestamp,
      alternatives: entry.interpretation?.alternatives || [],
      interpretation: entry.interpretation,
      model: undefined // Model info not stored in conversation history
    }));
    
    res.json({
      history: formattedHistory,
      count: formattedHistory.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({
      error: 'Failed to fetch conversation history',
      history: [],
      timestamp: new Date().toISOString()
    });
  }
});

// Clear conversation history endpoint
simpleLLMInterpreterRouter.post('/clear-history', ensureValidToken, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    
    if (userId && conversationManager) {
      // Clear both conversation history and dialog state
      await Promise.all([
        conversationManager.clear(userId),
        conversationManager.updateDialogState(userId, {
          last_action: null,
          last_candidates: [],
          interaction_mode: 'music',
          updated_at: Date.now()
        })
      ]);
      
      console.log(`[CLEAR] Conversation history cleared for user ${userId}`);
      
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
    // Get user ID from JWT for both conversation history and model preferences
    const userId = getUserIdFromRequest(req);
    console.log('User ID:', userId);
    
    // Get user's preferred model from Redis
    let preferredModel = OPENROUTER_MODELS.GEMINI_2_5_FLASH;
    
    if (userId) {
      const savedPreference = await getUserModelPreference(userId);
      if (savedPreference) {
        preferredModel = savedPreference;
        console.log(`Using user's preferred model: ${preferredModel}`);
      }
    }
    
    // Use userId for conversation history instead of sessionId
    const interpretation = await interpretCommand(command, userId || undefined, 0, preferredModel);
    console.log('LLM interpretation:', interpretation);

    let refreshedTokens: SpotifyAuthTokens | null = null;
    
    const spotifyControl = new SpotifyControl(
      req.spotifyTokens!,
      (tokens) => { 
        // Store refreshed tokens to include in response
        refreshedTokens = tokens;
        req.spotifyTokens = tokens; 
      }
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
      // Get conversation history for context
      let conversationHistory: ConversationEntry[] = [];
      let dialogState: DialogState | null = null;
      
      if (userId && conversationManager) {
        [conversationHistory, dialogState] = await Promise.all([
          conversationManager.getHistory(userId, 5),
          conversationManager.getDialogState(userId)
        ]);
      }
      
      // Get actual answer from LLM
      const answer = await handleConversationalQuery(
        command,
        intent,
        conversationHistory,
        dialogState,
        preferredModel
      );
      
      result = {
        success: true,
        message: answer,
        conversational: true // Flag to indicate no Spotify action
      };
    } else {
      // Use canonicalized intent for clean switch handling
      const canonicalIntent = canonicalizeIntent(intent);
      
      switch (canonicalIntent) {
        case 'play_specific_song':
        case 'queue_specific_song': {
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
          
          // Debug: Log all tracks returned by Spotify
          console.log(`[DEBUG] Spotify returned ${tracks.length} tracks:`);
          tracks.forEach((track, idx) => {
            console.log(`  ${idx + 1}. "${track.name}" by ${track.artists[0]?.name} - Album: "${track.album.name}" (${track.album.release_date || 'no date'})`);
          });
          
          const ranked = rankTracks(tracks, interpretation);
          
          // Debug: Log ranked tracks
          console.log(`[DEBUG] After ranking:`);
          ranked.forEach((track, idx) => {
            console.log(`  ${idx + 1}. "${track.name}" - Album: "${track.album.name}" - Score: ${track.relevanceScore}`);
          });

          if (ranked.length === 0) {
            result = {
              success: false,
              message: `No tracks found for: "${searchQuery}"`,
            };
          } else {
            const track = ranked[0];
            console.log(`[DEBUG] Selected track: "${track.name}" - Album: "${track.album.name}" - URI: ${track.uri}`);
            
            // Check intent for queue vs play - now properly handles queue_specific_song
            if (canonicalIntent === 'queue_specific_song') {
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
          break;
        }

        case 'queue_multiple_songs': {
          const songs = interpretation.songs || [];
          
          if (!songs || songs.length === 0) {
            result = {
              success: false,
              message: "No songs provided for multiple queue request"
            };
            break;
          }

          console.log(`[DEBUG] Queuing ${songs.length} songs from interpretation`);
          
          const queueResults = [];
          const failures = [];
          
          // Process songs sequentially to avoid overwhelming Spotify API
          for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            try {
              // Build search query for this specific song
              let searchQuery = `artist:"${song.artist}" track:"${song.track}"`;
              if (song.album) {
                searchQuery += ` album:"${song.album}"`;
              }
              
              console.log(`[DEBUG] Searching for song ${i + 1}: "${searchQuery}"`);
              const tracks = await spotifyControl.search(searchQuery);
              
              if (tracks.length > 0) {
                const track = tracks[0]; // Use first result
                await spotifyControl.queueTrackByUri(track.uri);
                queueResults.push({
                  name: track.name,
                  artists: track.artists.map((a: any) => a.name).join(', '),
                  success: true
                });
                console.log(`[DEBUG] Successfully queued: ${track.name} by ${track.artists[0]?.name}`);
              } else {
                failures.push(`${song.artist} - ${song.track}`);
                console.log(`[DEBUG] No tracks found for: ${song.artist} - ${song.track}`);
              }
              
              // Small delay to avoid rate limiting
              if (i < songs.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            } catch (error) {
              console.error(`[DEBUG] Error queuing song ${i + 1}:`, error);
              failures.push(`${song.artist} - ${song.track}`);
            }
          }
          
          // Build result message
          const successCount = queueResults.length;
          const failureCount = failures.length;
          
          if (successCount === 0) {
            result = {
              success: false,
              message: `Failed to queue any songs. ${failureCount} songs not found.`,
              failures
            };
          } else if (failureCount === 0) {
            result = {
              success: true,
              message: `Successfully queued ${successCount} songs${interpretation.theme ? ` (${interpretation.theme})` : ''}`,
              queuedSongs: queueResults
            };
          } else {
            result = {
              success: true,
              message: `Queued ${successCount} songs${interpretation.theme ? ` (${interpretation.theme})` : ''}. ${failureCount} songs not found.`,
              queuedSongs: queueResults,
              failures
            };
          }
          break;
        }

        case 'queue_playlist': {
          const playlistUri = interpretation.playlist_uri || interpretation.playlistUri;
          const searchQuery = interpretation.query || interpretation.search_query;
          
          console.log(`[DEBUG] queue_playlist intent detected. URI: ${playlistUri}, Query: ${searchQuery}`);
          console.log(`[DEBUG] Full interpretation object:`, JSON.stringify(interpretation, null, 2));
          
          if (playlistUri) {
            // Queue playlist by URI (extract ID from URI)
            const playlistId = playlistUri.split(':').pop() || playlistUri.split('/').pop();
            console.log(`[DEBUG] Queuing playlist by URI/ID: ${playlistId}`);
            result = await spotifyControl.queuePlaylist(playlistId);
          } else if (searchQuery) {
            // Search for playlist and queue it
            console.log(`[DEBUG] Searching and queuing playlist: ${searchQuery}`);
            result = await spotifyControl.searchAndQueuePlaylist(searchQuery);
            console.log(`[DEBUG] searchAndQueuePlaylist result:`, JSON.stringify(result, null, 2));
          } else {
            console.log(`[DEBUG] No playlist URI or query provided for queue`);
            result = { success: false, message: "I need a playlist name or URI to queue" };
          }
          break;
        }

        default:
          result = { 
            success: false, 
            message: `I don't know how to: ${intent || command}`
          };
          break;
      }
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
      timestamp: new Date().toISOString(),
      // Include refreshed tokens if they were updated
      ...(refreshedTokens ? { refreshedTokens } : {})
    };
    
    res.json(responseData);
    
    // Record successful interpretation
    llmMonitor.recordInterpretation(command, interpretation, startTime, true);
    
    // Store conversation entry and update dialog state in Redis for future context
    if (userId && conversationManager) {
      // Get current dialog state
      const currentDialogState = await conversationManager.getDialogState(userId);
      
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
        conversationManager.append(userId, conversationEntry),
        conversationManager.updateDialogState(userId, updatedDialogState)
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
      const interpretation = await interpretCommand(cmd, undefined, 0, undefined);
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
    const userId = getUserIdFromRequest(req);
    
    // Get user's preferred model
    let preferredModel = OPENROUTER_MODELS.GEMINI_2_5_FLASH;
    if (userId) {
      const savedPreference = await getUserModelPreference(userId);
      if (savedPreference) {
        preferredModel = savedPreference;
      }
    }
    
    const interpretation = await interpretCommand(command, userId || undefined, 0, preferredModel);
    const responseTime = Date.now() - startTime;
    
    // Store conversation entry for testing (same as main endpoint)
    if (userId && conversationManager) {
      // Get current dialog state
      const currentDialogState = await conversationManager.getDialogState(userId);
      
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
        conversationManager.append(userId, conversationEntry),
        conversationManager.updateDialogState(userId, updatedDialogState)
      ]);
      
      console.log(`[TEST] Conversation stored for user ${userId}`);
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