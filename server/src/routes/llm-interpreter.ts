import { Router } from 'express';
import { SpotifyControl } from '../spotify/control';
import { ensureValidToken } from '../spotify/auth';
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
import { verifyJWT, extractTokenFromHeader } from '../utils/jwt';
import crypto from 'crypto';

export const llmInterpreterRouter = Router();

// Redis client reference for model preferences
let redisClient: any = null;

export function setRedisClient(client: any) {
  redisClient = client;
}

// Helper to get user ID from JWT
function getUserIdFromRequest(req: any): string | null {
  const authHeader = req.headers.authorization;
  const jwtToken = extractTokenFromHeader(authHeader);
  
  if (!jwtToken) return null;
  
  const payload = verifyJWT(jwtToken);
  if (!payload) return null;
  
  // Create a stable user ID from the Spotify refresh token
  const refreshToken = payload.spotifyTokens.refresh_token;
  return crypto.createHash('sha256').update(refreshToken).digest('hex').substring(0, 16);
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

interface TrackWithScore extends SpotifyTrack {
  relevanceScore: number;
}

// Interpret command using LLM orchestrator
async function interpretCommand(command: string, preferredModel?: string): Promise<MusicCommand> {
  const request = createSchemaRequest(
    SYSTEM_PROMPTS.MUSIC_INTERPRETER,
    command,
    MusicCommandSchema,
    preferredModel || OPENROUTER_MODELS.GPT_4O // Use preferred model or default
  );

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
        response_format: { type: 'json_object' as const }
      };
      
      const rawResponse = await llmOrchestrator.complete(rawRequest);
      const parsed = JSON.parse(rawResponse.content);
      
      // Extract essential fields even if full validation fails
      const essential = extractEssentialFields(parsed);
      
      console.log('Using essential fields fallback:', essential);
      
      return {
        intent: (essential.intent || 'search_and_play') as MusicCommand['intent'],
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
          intent: 'search_and_play',
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
llmInterpreterRouter.post('/command', ensureValidToken, async (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }

  if (!req.session.spotifyTokens) {
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
    
    const interpretation = await interpretCommand(command, preferredModel);
    console.log('LLM interpretation:', interpretation);

    const spotifyControl = new SpotifyControl(
      req.spotifyTokens!,
      (tokens) => { req.spotifyTokens = tokens; }
    );
    let result;

    switch (interpretation.intent) {
      case 'search_and_play':
      case 'search_and_queue': {
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
          
          if (interpretation.intent === 'search_and_play') {
            await spotifyControl.playTrack(topTrack.uri);
            result = {
              success: true,
              message: `Playing: ${topTrack.name} by ${topTrack.artists.map(a => a.name).join(', ')}`
            };
          } else {
            await spotifyControl.queueTrackByUri(topTrack.uri);
            result = {
              success: true,
              message: `Added to queue: ${topTrack.name} by ${topTrack.artists.map(a => a.name).join(', ')}`
            };
          }
          
          result = {
            ...result,
            track: topTrack,
            alternatives: rankedTracks.slice(1, 5).map(t => ({
              name: t.name,
              artists: t.artists.map(a => a.name).join(', '),
              popularity: t.popularity,
              relevanceScore: t.relevanceScore
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
        if (interpretation.value !== undefined) {
          result = await spotifyControl.setVolume(interpretation.value);
        } else {
          result = { success: false, message: 'No volume level specified' };
        }
        break;
        
      case 'get_info':
        result = await spotifyControl.getCurrentTrack();
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

  } catch (error) {
    console.error('LLM command processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process command',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Music knowledge endpoint
llmInterpreterRouter.post('/ask', ensureValidToken, async (req, res) => {
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
      knowledge: OPENROUTER_MODELS.CLAUDE_SONNET_4
    }
  });
});