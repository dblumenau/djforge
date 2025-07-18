  import { Router } from 'express';
import { SpotifyControl } from '../spotify/control';
import { ensureValidToken } from '../spotify/auth';
import { SpotifyTrack, SpotifyAuthTokens } from '../types';
import { llmOrchestrator, OPENROUTER_MODELS } from '../llm/orchestrator';
import { llmMonitor } from '../llm/monitoring';
import { ConversationEntry, DialogState } from '../utils/redisConversation';
import { ConversationManager, getConversationManager } from '../services/ConversationManager';
import { LLMLoggingService } from '../services/llm-logging.service';
import { createHash } from 'crypto';

export const simpleLLMInterpreterRouter = Router();

// Shared conversation manager instance
let conversationManager: ConversationManager;
let loggingService: LLMLoggingService | null = null;

export function setRedisClient(client: any) {
  conversationManager = getConversationManager(client);
  console.log('✅ Shared ConversationManager initialized for contextual understanding');
  
  // Initialize logging service
  loggingService = new LLMLoggingService(client);
  llmOrchestrator.setLoggingService(loggingService);
  console.log('✅ LLM logging service initialized in orchestrator');
}

// Helper to get user ID from JWT
function getUserIdFromRequest(req: any): string | null {
  if (!conversationManager) return null;
  return conversationManager.getUserIdFromRequest(req);
}

// Helper to hash user ID for privacy
function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').substring(0, 16);
}

// Get user's model preference from Redis
async function getUserModelPreference(userId: string): Promise<string | null> {
  if (!conversationManager) return null;
  return await conversationManager.getUserModelPreference(userId);
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
  
  // Check if this is a destructive action using Redis conversation logic
  const destructiveIntents = [
    'play_specific_song',
    'queue_specific_song',
    'play_playlist',
    'queue_playlist',
  ];
  
  const isDestructive = destructiveIntents.includes(interpretation.intent) || 
                       interpretation.intent.includes('play') || 
                       interpretation.intent.includes('queue');
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
async function interpretCommand(command: string, userId?: string, retryCount = 0, preferredModel?: string, musicContext?: string, sessionId?: string): Promise<any> {
  let conversationHistory: ConversationEntry[] = [];
  let dialogState: DialogState | null = null;
  
  // Fetch conversation history and dialog state if we have a user ID
  if (userId && conversationManager) {
    // Get both conversation history and dialog state
    const [history, state] = await Promise.all([
      conversationManager.getConversationHistory(userId, 8),
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
• get_playback_info - Get information about what's currently playing ("what's playing", "current song", "what song is this")

CONVERSATIONAL TRIGGERS (these are NOT music actions):
- Questions starting with: "did", "does", "has", "tell me about", "what do you think", "how is", "what's"
- Playback info requests: "what's playing", "what song is this", "current track"
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
• set_volume - Set volume level (requires volume_level field between 0-100)
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
   - "tell me about this song" → ask_question (return info, don't play music)
   - "what do you think of this artist" → chat (return opinion, don't play music)

4. KEY DISTINCTION:
   - If asking for A SONG (even by name) → use play_specific_song/queue_specific_song
   - If asking for MULTIPLE SONGS → use queue_multiple_songs
   - If asking for A PLAYLIST → use play_playlist/queue_playlist
   - If asking QUESTIONS → use conversational intents (chat/ask_question)
   - If asking "what's playing" or "current song" → use get_playback_info
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
  
  IMPORTANT: Always provide 4-5 alternative song suggestions in the alternatives array. These should be similar songs by the same artist or related artists that the user might also enjoy.
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
  "intent": "chat" or "ask_question",
  "confidence": 0.8-1.0,
  "reasoning": "explain why this is conversational and what information to provide",
  "responseMessage": "The actual answer to the user's question about the artist/music. For 'this artist' questions, use the currently playing context to provide information about the specific artist. Include interesting facts, notable achievements, genre influences, and career highlights. Keep it 2-4 sentences."
}

For control intents:
{
  "intent": "set_volume",
  "volume_level": 75,
  "confidence": 0.9,
  "reasoning": "setting volume to specified level"
}

{
  "intent": "pause" or "play" or "skip" or "previous",
  "confidence": 0.9,
  "reasoning": "basic playback control"
}

{
  "intent": "set_shuffle",
  "enabled": true,
  "confidence": 0.9,
  "reasoning": "enabling or disabling shuffle"
}

{
  "intent": "set_repeat",
  "enabled": true,
  "confidence": 0.9,
  "reasoning": "enabling or disabling repeat"
}

Other intents: clear_queue, get_current_track, get_devices, get_playlists, get_recently_played, search

Command: "${command}"

${musicContext || ''}`;

  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('LLM timeout')), INTERPRETATION_TIMEOUT)
    );
    
    const startTime = Date.now();
    const requestModel = preferredModel || OPENROUTER_MODELS.GEMINI_2_5_FLASH;
    const messages = [
      { role: 'system' as const, content: 'Respond with valid JSON. Be helpful and specific. Include confidence scores. CRITICAL: You must use the discriminated union pattern - when intent is "play_specific_song" or "queue_specific_song", you MUST include artist, track, and alternatives fields. ALWAYS provide 4-5 alternative song suggestions in the alternatives array using the format "Artist Name - Song Title". When intent is "play_playlist" or "queue_playlist", use query field. Never use generic search queries for specific song requests - always recommend exact songs using your music knowledge. Distinguish between playing (immediate) and queuing (add to queue) for both songs and playlists. For conversational intents (chat, ask_question), include the actual answer in the responseMessage field.' },
      { role: 'user' as const, content: prompt }
    ];
    
    const responsePromise = llmOrchestrator.complete({
      messages,
      model: requestModel,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      conversationContext: contextBlock.length > 0 ? contextBlock : undefined
    });
    
    const response = await Promise.race([responsePromise, timeoutPromise]) as any;
    const latency = Date.now() - startTime;
    const normalized = normalizeResponse(response.content);
    
    // Add model information to the normalized response
    normalized.model = response.model || preferredModel || 'unknown';
    normalized.provider = response.provider || 'unknown';
    normalized.flow = response.flow || 'unknown';
    normalized.fallbackUsed = response.fallbackUsed || false;
    normalized.actualModel = response.actualModel || response.model;
    
    // Log the LLM interaction
    if (loggingService && userId) {
      try {
        await loggingService.logInteraction({
          timestamp: Date.now(),
          userId: hashUserId(userId),
          sessionId: sessionId || 'unknown',
          command,
          interpretation: normalized,
          llmRequest: {
            model: requestModel,
            provider: response.provider || 'unknown',
            flow: response.flow || 'unknown',
            messages,
            temperature: 0.7,
            jsonMode: true,
            grounding: response.flow === 'gemini-direct' && process.env.GEMINI_SEARCH_GROUNDING === 'true'
          },
          llmResponse: {
            content: response.content,
            usage: response.usage,
            latency,
            fallbackUsed: response.fallbackUsed,
            actualModel: response.actualModel
          },
          result: {
            success: normalized.intent !== 'unknown',
            message: normalized.intent !== 'unknown' ? 'Interpretation successful' : 'Failed to interpret command'
          }
        });
      } catch (error) {
        console.error('Failed to log LLM interaction:', error);
        // Don't throw - logging failure shouldn't break the request
      }
    }
    
    // Validate we got something useful
    if (normalized.intent === 'unknown' && retryCount < MAX_RETRIES) {
      console.log(`Retry ${retryCount + 1} for command interpretation`);
      return interpretCommand(command, userId, retryCount + 1, preferredModel, musicContext, sessionId);
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
        
        const normalized = normalizeResponse(response.content);
        normalized.model = response.model || fallbackModels[retryCount] || 'unknown';
        normalized.provider = response.provider || 'unknown';
        normalized.flow = response.flow || 'unknown';
        normalized.fallbackUsed = response.fallbackUsed || false;
        normalized.actualModel = response.actualModel || response.model;
        
        return normalized;
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
  preferredModel?: string,
  spotifyControl?: SpotifyControl
): Promise<string> {
  try {
    // Build context about recent music if available
    let musicContext = '';
    
    // First, try to get actual current playback state
    if (spotifyControl) {
      try {
        const currentTrack = await spotifyControl.getCurrentTrack();
        if (currentTrack.success && currentTrack.track) {
          const track = currentTrack.track;
          musicContext = `\nCurrently playing: "${track.name}" by ${track.artist} from the album "${track.album}"`;
        }
      } catch (e) {
        console.log('Could not fetch current track for context:', e);
      }
    }
    
    // Fall back to dialog state if we couldn't get current track
    if (!musicContext && dialogState?.last_action) {
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

Provide a helpful, informative response. If the question is about music history, collaborations, facts, or seeking information, give accurate details. If asking about the current/recent music, use the context provided. Keep the response concise but informative.

${!musicContext && (command.toLowerCase().includes('this artist') || command.toLowerCase().includes('this song') || command.toLowerCase().includes('this track')) ? 
  'NOTE: The user is asking about "this" artist/song but no music is currently playing. Politely mention that you need them to play something first.' : ''}`;

    const response = await llmOrchestrator.complete({
      messages: [
        { role: 'system', content: 'You are a friendly and knowledgeable music assistant with deep expertise about artists, their history, musical style, collaborations, and achievements. Provide accurate, engaging information about music, artists, and songs. Include interesting facts, notable achievements, genre influences, and career highlights when relevant. Keep responses concise but informative (2-4 sentences). IMPORTANT: Respond with plain text, not JSON.' },
        { role: 'user', content: conversationalPrompt }
      ],
      model: preferredModel || OPENROUTER_MODELS.GEMINI_2_5_FLASH,
      temperature: 0.7,
      // Don't request JSON format for conversational responses
      response_format: undefined
    });

    // Handle both plain text and JSON responses
    let content = response.content;
    if (typeof content === 'string' && content.startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        // If it's JSON, try to extract a sensible response
        content = parsed.response || parsed.message || parsed.answer || content;
      } catch (e) {
        // Not JSON, use as is
      }
    }

    return content || "I'd be happy to help! Could you clarify what you'd like to know?";
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
    'set_volume', 'get_current_track', 'get_playback_info',
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
    const history = await conversationManager.getConversationHistory(userId, 100);
    
    // Format history to match client's expected structure
    const formattedHistory = history.map((entry: any) => {
      // Debug log for conversational entries
      if (entry.interpretation?.intent === 'chat' || entry.interpretation?.intent === 'ask_question') {
        console.log('📝 Formatting conversational history entry:', {
          command: entry.command,
          responseType: typeof entry.response,
          response: entry.response,
          interpretationIntent: entry.interpretation?.intent
        });
      }
      
      // Handle response field properly
      let responseText = '';
      if (typeof entry.response === 'string') {
        responseText = entry.response;
      } else if (entry.response && typeof entry.response === 'object') {
        // Response is an object with success and message fields
        responseText = entry.response.message || '';
      } else {
        // Fallback
        responseText = '';
      }
      
      return {
        command: entry.command,
        response: responseText,
        confidence: entry.interpretation?.confidence,
        isEnhanced: entry.interpretation?.isEnhanced || false,
        timestamp: entry.timestamp,
        alternatives: entry.interpretation?.alternatives || [],
        interpretation: entry.interpretation,
        model: entry.interpretation?.model || undefined,
        intent: entry.interpretation?.intent,
        reasoning: entry.interpretation?.reasoning
      };
    });
    
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
        conversationManager.clearConversationHistory(userId),
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
    
    // Build music context before interpretation
    let musicContext = '';
    let spotifyControl = new SpotifyControl(
      req.spotifyTokens!,
      (tokens) => { 
        req.spotifyTokens = tokens; 
      }
    );
    
    try {
      const currentTrack = await spotifyControl.getCurrentTrack();
      if (currentTrack.success && currentTrack.track) {
        const track = currentTrack.track;
        musicContext = `\nCurrently playing: "${track.name}" by ${track.artist} from the album "${track.album}"`;
      }
    } catch (e) {
      console.log('Could not fetch current track for context:', e);
    }
    
    // Use userId for conversation history instead of sessionId
    const interpretation = await interpretCommand(command, userId || undefined, 0, preferredModel, musicContext, userId || 'anonymous');
    console.log('LLM interpretation:', interpretation);

    let refreshedTokens: SpotifyAuthTokens | null = null;
    
    // Re-initialize to capture token refresh
    spotifyControl = new SpotifyControl(
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
          model: interpretation.model || preferredModel || 'unknown'
        },
        timestamp: new Date().toISOString()
      });
      
      return;
    }

    // Handle different intents flexibly
    const intent = interpretation.intent || interpretation.action;
    
    // Handle conversational intents (return text, no Spotify action)
    if (intent === 'chat' || intent === 'ask_question') {
      // Check if Gemini already provided the response in responseMessage field
      if (interpretation.responseMessage) {
        // Gemini provided the answer directly in the structured output
        result = {
          success: true,
          message: interpretation.responseMessage,
          conversational: true // Flag to indicate no Spotify action
        };
        
        console.log('📝 Using Gemini responseMessage:', interpretation.responseMessage);
      } else {
        // OpenRouter path or Gemini without responseMessage - get answer separately
        // Get conversation history for context
        let conversationHistory: ConversationEntry[] = [];
        let dialogState: DialogState | null = null;
        
        if (userId && conversationManager) {
          [conversationHistory, dialogState] = await Promise.all([
            conversationManager.getConversationHistory(userId, 5),
            conversationManager.getDialogState(userId)
          ]);
        }
        
        // Get actual answer from LLM
        const answer = await handleConversationalQuery(
          command,
          intent,
          conversationHistory,
          dialogState,
          preferredModel,
          spotifyControl
        );
        
        result = {
          success: true,
          message: answer,
          conversational: true // Flag to indicate no Spotify action
        };
        
        console.log('📝 Conversational answer from separate query:', answer);
      }
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
                message: `Added to queue: ${track.name} by ${track.artists.map((a: any) => a.name).join(', ')}`
              };
            } else {
              await spotifyControl.playTrack(track.uri);
              result = {
                success: true,
                message: `Playing: ${track.name} by ${track.artists.map((a: any) => a.name).join(', ')}`
              };
            }

            // Add alternatives from LLM response if provided, otherwise use search results
            console.log(`[DEBUG] Processing alternatives from LLM: ${JSON.stringify(interpretation.alternatives)}`);
            if (interpretation.alternatives && interpretation.alternatives.length > 0) {
              // Convert LLM-provided alternatives to proper format with URIs
              const alternativesWithUris = [];
              console.log(`[DEBUG] Converting ${interpretation.alternatives.length} alternatives to URI format`);
              for (const altString of interpretation.alternatives.slice(0, 5)) {
                try {
                  // Parse "Artist Name - Song Title" format
                  const parts = altString.split(' - ');
                  if (parts.length >= 2) {
                    const artist = parts[0].trim();
                    const track = parts.slice(1).join(' - ').trim();
                    
                    // Search for this alternative on Spotify
                    const altSearchQuery = `artist:"${artist}" track:"${track}"`;
                    const altTracks = await spotifyControl.search(altSearchQuery);
                    
                    if (altTracks.length > 0) {
                      const altTrack = altTracks[0];
                      alternativesWithUris.push({
                        name: altTrack.name,
                        artists: altTrack.artists.map((a: any) => a.name).join(', '),
                        popularity: altTrack.popularity,
                        uri: altTrack.uri
                      });
                    }
                  }
                } catch (error) {
                  console.error('Error processing alternative:', altString, error);
                }
              }
              
              if (alternativesWithUris.length > 0) {
                console.log(`[DEBUG] Successfully converted ${alternativesWithUris.length} alternatives with URIs`);
                (result as any).alternatives = alternativesWithUris;
              } else {
                console.log(`[DEBUG] No alternatives were successfully converted`);
              }
            } else if (ranked.length > 1) {
              // Fallback to search results if no LLM alternatives
              (result as any).alternatives = ranked.slice(1, 5).map((t: any) => ({
                name: t.name,
                artists: t.artists.map((a: any) => a.name).join(', '),
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

        case 'play_playlist': {
          const playlistUri = interpretation.playlist_uri || interpretation.playlistUri;
          const searchQuery = interpretation.query || interpretation.search_query;
          
          console.log(`[DEBUG] play_playlist intent detected. URI: ${playlistUri}, Query: ${searchQuery}`);
          console.log(`[DEBUG] Full interpretation object:`, JSON.stringify(interpretation, null, 2));
          
          if (playlistUri) {
            // Play playlist by URI (extract ID from URI)
            const playlistId = playlistUri.split(':').pop() || playlistUri.split('/').pop();
            console.log(`[DEBUG] Playing playlist by URI/ID: ${playlistId}`);
            result = await spotifyControl.playPlaylistWithTracks(playlistId);
          } else if (searchQuery) {
            // Search for playlist and play it
            console.log(`[DEBUG] Searching and playing playlist: ${searchQuery}`);
            result = await spotifyControl.searchAndPlayPlaylist(searchQuery);
            console.log(`[DEBUG] searchAndPlayPlaylist result:`, JSON.stringify(result, null, 2));
          } else {
            console.log(`[DEBUG] No playlist URI or query provided for play`);
            result = { success: false, message: "I need a playlist name or URI to play" };
          }
          break;
        }

        case 'pause': {
          result = await spotifyControl.pause();
          break;
        }

        case 'play':
        case 'resume': {
          result = await spotifyControl.play();
          break;
        }

        case 'skip':
        case 'next': {
          result = await spotifyControl.skip();
          break;
        }

        case 'previous':
        case 'back': {
          result = await spotifyControl.previous();
          break;
        }

        case 'get_playback_info':
        case 'get_current_track': {
          result = await spotifyControl.getCurrentTrack();
          
          // Format the response nicely if we have track info
          if (result.success && result.track) {
            const track = result.track;
            const formatTime = (seconds: number) => {
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              return `${mins}:${secs.toString().padStart(2, '0')}`;
            };
            
            result.message = `🎵 Currently playing:\n\n🎤 ${track.name}\n👤 ${track.artist}\n💿 ${track.album}\n\n⏱️ ${formatTime(track.position)} / ${formatTime(track.duration)}`;
          }
          break;
        }

        case 'set_volume': {
          const volumeLevel = interpretation.volume || interpretation.volume_level || interpretation.value;
          
          if (typeof volumeLevel !== 'number' || volumeLevel < 0 || volumeLevel > 100) {
            result = {
              success: false,
              message: 'Volume must be a number between 0 and 100'
            };
          } else {
            result = await spotifyControl.setVolume(volumeLevel);
          }
          break;
        }

        case 'set_shuffle': {
          const enabled = interpretation.enabled !== undefined ? interpretation.enabled : true;
          result = await spotifyControl.setShuffle(enabled);
          break;
        }

        case 'set_repeat': {
          const enabled = interpretation.enabled !== undefined ? interpretation.enabled : true;
          result = await spotifyControl.setRepeat(enabled);
          break;
        }

        case 'clear_queue': {
          result = await spotifyControl.clearQueue();
          break;
        }

        case 'get_devices': {
          result = await spotifyControl.getDevices();
          break;
        }

        case 'get_playlists': {
          result = await spotifyControl.getPlaylists();
          break;
        }

        case 'get_recently_played': {
          result = await spotifyControl.getRecentlyPlayed();
          break;
        }

        case 'search': {
          const searchQuery = interpretation.query || interpretation.search_query || interpretation.q || '';
          
          if (!searchQuery) {
            result = {
              success: false,
              message: 'No search query provided'
            };
          } else {
            const tracks = await spotifyControl.search(searchQuery);
            result = {
              success: true,
              message: `Found ${tracks.length} tracks for "${searchQuery}"`,
              tracks: tracks.slice(0, 10).map(t => ({
                name: t.name,
                artists: t.artists.map((a: any) => a.name).join(', '),
                album: t.album.name,
                uri: t.uri,
                popularity: t.popularity
              }))
            };
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
        // Use converted alternatives from result if available, otherwise use raw alternatives from interpretation
        alternatives: (result as any).alternatives || interpretation.alternatives,
        model: interpretation.model || preferredModel || 'unknown' // Fix model info
      },
      timestamp: new Date().toISOString(),
      // Include refreshed tokens if they were updated
      ...(refreshedTokens ? { refreshedTokens } : {})
    };
    
    // Debug log the final response structure
    console.log(`[DEBUG] Final response alternatives:`, (responseData as any).alternatives);
    console.log(`[DEBUG] Final response interpretation alternatives:`, responseData.interpretation.alternatives);
    
    // Debug logging for conversational responses
    if (interpretation.intent === 'chat' || interpretation.intent === 'ask_question') {
      console.log('📝 Sending conversational response:', {
        success: responseData.success,
        message: responseData.message,
        conversational: (responseData as any).conversational
      });
    }
    
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
      
      // Debug log for conversational responses
      if (interpretation.intent === 'chat' || interpretation.intent === 'ask_question') {
        console.log('📝 Storing conversational entry:', {
          command: conversationEntry.command,
          intent: conversationEntry.interpretation.intent,
          responseMessage: conversationEntry.response?.message
        });
      }
      
      // Update dialog state based on the action
      const updatedDialogState = conversationManager.updateDialogStateFromAction(
        currentDialogState,
        interpretation,
        interpretation.alternatives || []
      );
      
      // Save both conversation and dialog state
      await Promise.all([
        conversationManager.addConversationEntry(userId, conversationEntry),
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
      const interpretation = await interpretCommand(cmd, undefined, 0, undefined, undefined, 'test');
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
    
    const interpretation = await interpretCommand(command, userId || undefined, 0, preferredModel, undefined, userId || 'test');
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
        conversationManager.addConversationEntry(userId, conversationEntry),
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