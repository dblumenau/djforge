import { Router } from 'express';
import { SpotifyControl } from '../spotify/control';
import { requireValidTokens } from '../middleware/session-auth';
import { SpotifyTrack } from '../types';
import { llmOrchestrator, OPENROUTER_MODELS } from '../llm/orchestrator';
import { 
  MusicCommandSchema, 
  SpotifySearchEnhancementSchema,
  MusicKnowledgeSchema,
  createSchemaRequest,
  SYSTEM_PROMPTS,
  type MusicCommand
} from '../llm/schemas';
import { buildSpotifySearchQuery, extractEssentialFields } from '../llm/normalizer';
import { ConversationManager, getConversationManager } from '../services/ConversationManager';
import { ConversationEntry, DialogState } from '../utils/redisConversation';
import { UserDataService } from '../services/UserDataService';
import { createRedisClient } from '../config/redis';
import { detectRequestContextType } from '../utils/requestContext';
import { getWebSocketService } from '../services/websocket.service';

export const llmInterpreterRouter = Router();

// Shared conversation manager instance
let conversationManager: ConversationManager;

export function setRedisClient(client: any) {
  conversationManager = getConversationManager(client);
  console.log('✅ Shared ConversationManager initialized for llm-interpreter');
}

// Helper to get user ID from session
function getUserIdFromRequest(req: any): string | null {
  return req.userId || null; // Provided by requireValidTokens middleware
}

// Get user's model preference from Redis
async function getUserModelPreference(userId: string): Promise<string | null> {
  if (!conversationManager) return null;
  return await conversationManager.getUserModelPreference(userId);
}

interface TrackWithScore extends SpotifyTrack {
  relevanceScore: number;
}

// Helper function to emit WebSocket events for schema-based LLM actions
async function emitSchemaLLMWebSocketEvents(
  userId: string, 
  interpretation: MusicCommand, 
  result: any, 
  spotifyControl: SpotifyControl
): Promise<void> {
  const wsService = getWebSocketService();
  const musicService = wsService?.getMusicService();
  
  if (!musicService || !userId) {
    return;
  }

  try {
    // Emit command execution status
    musicService.emitCommandExecuted(userId, {
      command: `[Schema LLM] ${interpretation.intent}`,
      intent: interpretation.intent,
      success: result.success || false,
      confidence: interpretation.confidence || 0,
      result: result.success ? result.data || result.message : undefined,
      error: result.success ? undefined : result.message,
      timestamp: Date.now()
    });

    // If the action was successful, emit additional events based on intent
    if (result.success && ['play', 'queue_specific_song', 'queue_playlist'].includes(interpretation.intent)) {
      const currentPlayback = await spotifyControl.getCurrentTrack();
      
      // Handle track change events for play actions
      if (interpretation.intent === 'play') {
        if (currentPlayback.success && currentPlayback.track) {
          musicService.emitTrackChange(userId, {
            previous: null,
            current: currentPlayback.track,
            source: 'ai',
            reasoning: interpretation.reasoning,
            isAIDiscovery: interpretation.isAIDiscovery,
            timestamp: Date.now()
          });
        }
        
        // Get full playback state
        const playbackState = await spotifyControl.getApi().getCurrentPlayback();
        if (playbackState) {
          musicService.emitPlaybackStateChange(userId, {
            isPlaying: playbackState.is_playing || false,
            track: playbackState.item,
            position: Math.floor((playbackState.progress_ms || 0) / 1000),
            duration: Math.floor((playbackState.item?.duration_ms || 0) / 1000),
            device: playbackState.device?.name || 'Unknown',
            shuffleState: playbackState.shuffle_state || false,
            repeatState: playbackState.repeat_state || 'off',
            volume: playbackState.device?.volume_percent || 0,
            timestamp: Date.now()
          });
        }
      }
      
      // Handle queue events
      if (['queue_specific_song', 'queue_playlist'].includes(interpretation.intent) && result.track) {
        musicService.emitQueueUpdate(userId, {
          action: 'added',
          tracks: [result.track],
          totalItems: 1,
          source: 'ai',
          timestamp: Date.now()
        });
      }
    }
  } catch (error) {
    console.error('Failed to emit schema LLM WebSocket events:', error);
    // Don't throw - WebSocket failures shouldn't break the main response
  }
}

// Interpret command using LLM orchestrator
async function interpretCommand(command: string, userId?: string, preferredModel?: string, req?: any): Promise<MusicCommand> {
  let conversationContext = '';
  let tasteProfile = '';
  
  // Get conversation context if available
  if (userId && conversationManager) {
    const [history, dialogState] = await Promise.all([
      conversationManager.getConversationHistory(userId, 3),
      conversationManager.getDialogState(userId)
    ]);
    
    conversationContext = conversationManager.formatContextForLLM(command, history, dialogState);
  }
  
  // Get user's taste profile if available
  if (userId && req?.tokens) {
    let redisClient = null;
    try {
      // Create a Redis client for taste profile
      redisClient = await createRedisClient();
      await redisClient.connect();
      
      const spotifyControl = new SpotifyControl(
        req.tokens,
        (tokens) => { req.tokens = tokens; }
      );
      // Detect request context type for adaptive taste profile  
      const contextType = detectRequestContextType(command);
      console.log(`[DEBUG] Detected request context type: ${contextType || 'general'}`);
      
      const userDataService = new UserDataService(redisClient, spotifyControl.getApi(), userId);
      tasteProfile = await userDataService.generateTasteProfile(contextType);
      console.log(`[DEBUG] Fetched ${contextType || 'general'} taste profile for user in llm-interpreter`);
      console.log('[DEBUG] Taste Profile Content:', tasteProfile);
    } catch (error) {
      console.error('Error fetching taste profile in llm-interpreter:', error);
    } finally {
      // Clean up Redis connection
      if (redisClient) {
        await redisClient.disconnect();
      }
    }
  }
  
  // Combine taste profile with conversation context
  let fullContext = '';
  if (tasteProfile) {
    fullContext = tasteProfile + '\n\n';
  }
  if (conversationContext) {
    fullContext += conversationContext;
  }
  
  const request = createSchemaRequest(
    SYSTEM_PROMPTS.MUSIC_INTERPRETER,
    command,
    MusicCommandSchema,
    preferredModel || OPENROUTER_MODELS.GPT_4O // Use preferred model or default
  );
  
  // Add combined context to request
  if (fullContext) {
    request.conversationContext = fullContext;
    console.log('[DEBUG] Full context being sent to LLM:');
    console.log('---START OF CONTEXT---');
    console.log(fullContext);
    console.log('---END OF CONTEXT---');
  }

  try {
    const response = await llmOrchestrator.complete(request);
    return JSON.parse(response.content) as MusicCommand;
  } catch (error: any) {
    console.error('LLM interpretation with schema failed:', error.message);
    
    // Try without schema validation - just get raw response
    try {
      const rawRequest = {
        messages: request.messages,
        model: request.model,
        temperature: 0.7,
        response_format: { type: 'json_object' as const },
        conversationContext: request.conversationContext
      };
      
      const rawResponse = await llmOrchestrator.complete(rawRequest);
      const parsed = JSON.parse(rawResponse.content);
      
      // Extract essential fields even if full validation fails
      const essential = extractEssentialFields(parsed);
      
      console.log('Using essential fields fallback:', essential);
      
      return {
        intent: (essential.intent || 'play_specific_song') as MusicCommand['intent'],
        query: essential.query,
        artist: essential.artist,
        track: essential.track,
        confidence: essential.confidence || 0.7,
        reasoning: 'Interpreted using fallback extraction',
        alternatives: [],
        modifiers: { exclude: [] }
      };
    } catch (fallbackError) {
      console.error('Fallback interpretation also failed:', fallbackError);
      
      // Final fallback - try to extract intent from command
      const lowerCommand = command.toLowerCase();
      if (lowerCommand.includes('play')) {
        return {
          intent: 'play_specific_song',
          query: command.replace(/^play\s+/i, ''),
          confidence: 0.5,
          reasoning: 'Basic keyword matching fallback',
          alternatives: [],
          modifiers: { exclude: [] }
        };
      }
      
      return {
        intent: 'unknown',
        confidence: 0,
        reasoning: 'All interpretation methods failed',
        alternatives: [],
        modifiers: { exclude: [] }
      };
    }
  }
}

// Enhance Spotify search query using LLM
async function enhanceSpotifySearch(interpretation: MusicCommand) {
  if (!interpretation.query && !interpretation.artist && !interpretation.track) {
    return null;
  }

  // Build the original query string
  const originalQuery = interpretation.query || 
    `${interpretation.track || ''} ${interpretation.artist || ''}`.trim();

  const prompt = `Enhance this Spotify search:
Original query: "${originalQuery}"
Artist: ${interpretation.artist || 'not specified'}
Track: ${interpretation.track || 'not specified'}
Modifiers: ${JSON.stringify(interpretation.modifiers)}`;

  const request = createSchemaRequest(
    SYSTEM_PROMPTS.SEARCH_ENHANCER,
    prompt,
    SpotifySearchEnhancementSchema,
    OPENROUTER_MODELS.GPT_4O
  );

  try {
    const response = await llmOrchestrator.complete(request);
    return JSON.parse(response.content);
  } catch (error) {
    console.error('Search enhancement failed:', error);
    return null;
  }
}

// Apply modifiers to filter and rank search results
function applySearchModifiers(
  tracks: SpotifyTrack[], 
  modifiers?: MusicCommand['modifiers']
): TrackWithScore[] {
  if (!modifiers || tracks.length === 0) {
    return tracks.map(t => ({ ...t, relevanceScore: 1.0 }));
  }

  // Ensure modifiers have default values
  const safeModifiers = {
    obscurity: modifiers.obscurity || null,
    version: modifiers.version || null,
    mood: modifiers.mood || null,
    exclude: modifiers.exclude || []
  };

  return tracks.map(track => {
    let score = 1.0;
    const trackName = track.name.toLowerCase();
    const albumName = track.album.name.toLowerCase();

    // Handle obscurity modifier
    if (safeModifiers.obscurity) {
      const popularity = track.popularity || 50;
      switch (safeModifiers.obscurity) {
        case 'obscure':
        case 'rare':
        case 'deep_cut':
        case 'hidden':
          // Prefer low popularity tracks
          score *= (100 - popularity) / 100;
          break;
        case 'popular':
          // Prefer high popularity tracks
          score *= popularity / 100;
          break;
      }
    }

    // Handle version modifier
    if (safeModifiers.version) {
      const version = safeModifiers.version.toLowerCase();
      
      // Positive matching
      if (version === 'original') {
        if (trackName.includes('remaster') || 
            trackName.includes('remix') || 
            trackName.includes('version') ||
            albumName.includes("taylor's version")) {
          score *= 0.3;
        } else {
          score *= 1.5;
        }
      } else if (trackName.includes(version)) {
        score *= 2.0;
      }
    }

    // Handle exclusions
    if (safeModifiers.exclude && safeModifiers.exclude.length > 0) {
      for (const exclude of safeModifiers.exclude) {
        if (trackName.includes(exclude.toLowerCase()) || 
            albumName.includes(exclude.toLowerCase())) {
          score *= 0.1;
        }
      }
    }

    return { ...track, relevanceScore: score };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Main command endpoint
llmInterpreterRouter.post('/command', requireValidTokens, async (req: any, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }

  if (!req.tokens) {
    return res.status(401).json({ error: 'Not authenticated with Spotify' });
  }

  console.log('Processing LLM command:', command);

  try {
    // Get user's preferred model from Redis
    const userId = getUserIdFromRequest(req);
    let preferredModel = OPENROUTER_MODELS.GPT_4O;
    
    if (userId) {
      const savedPreference = await getUserModelPreference(userId);
      if (savedPreference) {
        preferredModel = savedPreference;
        console.log(`Using user's preferred model: ${preferredModel}`);
      }
    }
    
    // Create a request-like object with tokens for taste profile
    const reqLike = {
      tokens: req.tokens
    };
    
    const interpretation = await interpretCommand(command, userId || undefined, preferredModel, reqLike);
    console.log('LLM interpretation:', interpretation);

    const spotifyControl = new SpotifyControl(
      req.tokens!,
      (tokens) => { req.tokens = tokens; }
    );
    let result;

    switch (interpretation.intent) {
      case 'play_specific_song':
      case 'queue_specific_song': {
        // Build precise search query first
        let searchQuery = buildSpotifySearchQuery(interpretation);
        
        // If we have a basic query but no structured data, try to enhance it
        if (!searchQuery && interpretation.query) {
          searchQuery = interpretation.query;
        } else if (searchQuery) {
          // Log the precise search being used
          console.log(`Using precise Spotify search: "${searchQuery}"`);
          if (interpretation.reasoning) {
            console.log(`Reasoning: ${interpretation.reasoning}`);
          }
        }
        
        // Optionally enhance the search query (but prefer precise queries)
        if (!interpretation.artist && !interpretation.track) {
          const enhancement = await enhanceSpotifySearch(interpretation);
          if (enhancement?.enhancedQuery) {
            searchQuery = enhancement.enhancedQuery;
            console.log(`Enhanced search query: "${searchQuery}"`);
          }
        }
        
        if (!searchQuery) {
          result = { 
            success: false, 
            message: 'No search query could be determined from your request' 
          };
          break;
        }
        
        const searchResults = await spotifyControl.search(searchQuery);
        const rankedTracks = applySearchModifiers(searchResults, interpretation.modifiers);
        
        if (rankedTracks.length === 0) {
          result = { 
            success: false, 
            message: `No tracks found for: "${searchQuery}"`,
            interpretation
          };
        } else {
          const topTrack = rankedTracks[0];
          
          if (interpretation.intent === 'play_specific_song') {
            await spotifyControl.playTrack(topTrack.uri);
            result = {
              success: true,
              message: `Playing: ${topTrack.name} by ${topTrack.artists.map(a => a.name).join(', ')}`
            };
          } else {
            const queueResult = await spotifyControl.queueTrackByUri(topTrack.uri);
            result = {
              success: queueResult.success,
              message: queueResult.success 
                ? `Added to queue: ${topTrack.name} by ${topTrack.artists.map(a => a.name).join(', ')}`
                : queueResult.message || 'Failed to add track to queue'
            };
          }
          
          result = {
            ...result,
            track: topTrack,
            alternatives: rankedTracks.slice(1, 5).map(t => ({
              name: t.name,
              artists: t.artists.map(a => a.name).join(', '),
              popularity: t.popularity,
              uri: t.uri
            }))
          };
        }
        break;
      }
        
      case 'play':
        result = await spotifyControl.play();
        break;
        
      case 'pause':
        result = await spotifyControl.pause();
        break;
        
      case 'skip':
        result = await spotifyControl.skip();
        break;
        
      case 'previous':
        result = await spotifyControl.previous();
        break;
        
      case 'volume':
      case 'set_volume':
        const volumeLevel = interpretation.value || interpretation.volume_level;
        if (volumeLevel !== undefined && typeof volumeLevel === 'number') {
          result = await spotifyControl.setVolume(volumeLevel);
        } else {
          result = { success: false, message: 'No volume level specified' };
        }
        break;
        
      case 'resume':
        result = await spotifyControl.play();
        break;
        
      case 'next':
        result = await spotifyControl.skip();
        break;
        
      case 'back':
        result = await spotifyControl.previous();
        break;
        
      case 'get_playback_info':
      case 'get_current_track':
        result = await spotifyControl.getCurrentTrack();
        break;
        
      case 'set_shuffle':
        const shuffleEnabled = interpretation.enabled !== undefined ? interpretation.enabled : true;
        result = await spotifyControl.setShuffle(shuffleEnabled);
        break;
        
      case 'set_repeat':
        const repeatEnabled = interpretation.enabled !== undefined ? interpretation.enabled : true;
        result = await spotifyControl.setRepeat(repeatEnabled);
        break;
        
      case 'clear_queue':
        result = await spotifyControl.clearQueue();
        break;
        
      case 'get_devices':
        result = await spotifyControl.getDevices();
        break;
        
      case 'get_playlists':
        result = await spotifyControl.getPlaylists();
        break;
        
      case 'get_recently_played':
        result = await spotifyControl.getRecentlyPlayed();
        break;
        
      case 'search':
        const searchQuery = interpretation.query;
        if (searchQuery) {
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
        } else {
          result = { success: false, message: 'No search query provided' };
        }
        break;
        
      case 'play_playlist':
        const playPlaylistQuery = interpretation.query;
        if (playPlaylistQuery) {
          result = await spotifyControl.searchAndPlayPlaylist(playPlaylistQuery);
        } else {
          result = { success: false, message: 'No playlist query provided' };
        }
        break;
        
      case 'queue_playlist':
        const queuePlaylistQuery = interpretation.query;
        if (queuePlaylistQuery) {
          result = await spotifyControl.searchAndQueuePlaylist(queuePlaylistQuery);
        } else {
          result = { success: false, message: 'No playlist query provided' };
        }
        break;
        
      case 'queue_multiple_songs':
        const songs = interpretation.songs || [];
        if (songs.length > 0) {
          const queueResults = [];
          const failures = [];
          
          for (const song of songs) {
            try {
              let searchQuery = `artist:"${song.artist}" track:"${song.track}"`;
              if (song.album) {
                searchQuery += ` album:"${song.album}"`;
              }
              
              const tracks = await spotifyControl.search(searchQuery);
              if (tracks.length > 0) {
                const queueResult = await spotifyControl.queueTrackByUri(tracks[0].uri);
                queueResults.push({
                  name: tracks[0].name,
                  artists: tracks[0].artists.map((a: any) => a.name).join(', '),
                  success: queueResult.success,
                  error: queueResult.success ? undefined : queueResult.message
                });
              } else {
                failures.push(`${song.artist} - ${song.track}`);
              }
            } catch (error) {
              failures.push(`${song.artist} - ${song.track}`);
            }
          }
          
          const successCount = queueResults.length;
          const failureCount = failures.length;
          
          if (successCount === 0) {
            result = {
              success: false,
              message: `Failed to queue any songs. ${failureCount} songs not found.`
            };
          } else {
            result = {
              success: true,
              message: `Queued ${successCount} songs${interpretation.theme ? ` (${interpretation.theme})` : ''}${failureCount > 0 ? `. ${failureCount} songs not found.` : ''}`,
              queuedSongs: queueResults
            };
          }
        } else {
          result = { success: false, message: 'No songs provided for multiple queue request' };
        }
        break;
        
      default:
        result = { 
          success: false, 
          message: `Unknown command: ${interpretation.intent}`,
          alternatives: interpretation.alternatives
        };
    }

    res.json({
      message: result.message || `Command executed: ${interpretation.intent}`,
      interpretation,
      result
    });

    // Emit WebSocket events for schema-based LLM actions
    if (userId && ['play', 'queue', 'play_playlist', 'queue_multiple_songs'].includes(interpretation.intent)) {
      emitSchemaLLMWebSocketEvents(userId, interpretation, result, spotifyControl).catch(error => {
        console.error('WebSocket emission failed for schema LLM:', error);
      });
    }

  } catch (error) {
    console.error('LLM command processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process command',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Music knowledge endpoint
llmInterpreterRouter.post('/ask', requireValidTokens, async (req: any, res) => {
  const { question } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: 'No question provided' });
  }

  try {
    const request = createSchemaRequest(
      SYSTEM_PROMPTS.MUSIC_KNOWLEDGE,
      question,
      MusicKnowledgeSchema,
      OPENROUTER_MODELS.GPT_4O // Use better model for knowledge queries
    );

    const response = await llmOrchestrator.complete(request);
    const knowledge = JSON.parse(response.content);

    res.json({
      success: true,
      ...knowledge
    });
  } catch (error) {
    console.error('Music knowledge query failed:', error);
    res.status(500).json({ 
      error: 'Failed to answer question',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test endpoint to check available models
llmInterpreterRouter.get('/models', (req, res) => {
  res.json({
    available: llmOrchestrator.getAvailableModels(),
    recommended: {
      fast: OPENROUTER_MODELS.GPT_4O,
      balanced: OPENROUTER_MODELS.CLAUDE_HAIKU_4,
      quality: OPENROUTER_MODELS.GPT_4O,
      knowledge: OPENROUTER_MODELS.GEMINI_2_5_FLASH
    }
  });
});