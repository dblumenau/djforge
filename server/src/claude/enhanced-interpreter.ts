import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SpotifyControl } from '../spotify/control';
import { tempAuthMiddleware } from '../middleware/temp-auth';
import { SpotifyTrack } from '../types';

const execAsync = promisify(exec);

export const enhancedClaudeRouter = Router();

interface InterpretationResult {
  intent: string;
  query?: string;
  artist?: string;
  track?: string;
  value?: number;
  modifiers?: {
    obscurity?: 'obscure' | 'rare' | 'deep_cut' | 'popular' | 'mainstream';
    version?: 'original' | 'remix' | 'acoustic' | 'live' | 'demo' | 'radio_edit';
    mood?: string;
    exclude?: string[];
  };
  confidence: number;
  reasoning?: string;
  alternatives?: (string | {
    intent?: string;
    query?: string;
    theme?: string;
    enhancedQuery?: string;
    isAIDiscovery?: boolean;
    aiReasoning?: string;
  })[];
}

interface TrackWithScore extends SpotifyTrack {
  relevanceScore: number;
}

// Multi-stage interpretation with better understanding
async function interpretCommand(command: string): Promise<InterpretationResult> {
  const prompt = `You are an advanced Spotify command interpreter with deep understanding of music queries.
  
  Analyze this command and return a detailed JSON object with intent, parameters, and modifiers.
  
  IMPORTANT: When the user asks for obscure/rare songs, cultural references, or mood-based queries, 
  use your knowledge to suggest SPECIFIC songs that match their request. Don't just parse - INTERPRET and RECOMMEND.
  
  Examples:
  - "most obscure Taylor Swift song" → artist: "Taylor Swift", track: "It's Time To Go"
  - "play a lesser known Enya song" → artist: "Enya", track: "Lazy Days"
  - "song from desert driving scene" → artist: "The Doors", track: "Riders on the Storm"
  - "something that sounds like rain" → suggest specific ambient/peaceful tracks
  
  GUIDELINES:
  1. For obscurity requests: Use your knowledge of deep cuts, B-sides, bonus tracks
  2. For cultural references: Identify the specific song from movies/shows/events
  3. For mood queries: Suggest songs that actually match that mood/vibe
  4. For version requests: Be specific about which version to search for
  
  Return JSON with:
  {
    "intent": "play|pause|skip|previous|volume|play_specific_song|get_current_track|queue_specific_song",
    "query": "full search query for backwards compatibility",
    "artist": "artist name for precise search (if play_specific_song/queue_specific_song)",
    "track": "track name for precise search (if play_specific_song/queue_specific_song)",
    "value": "volume level if applicable",
    "modifiers": {
      "obscurity": "obscure|rare|deep_cut|popular|mainstream",
      "version": "original|remix|acoustic|live|demo|radio_edit",
      "mood": "detected mood/vibe",
      "exclude": ["terms to exclude"]
    },
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation of why you chose this specific song",
    "alternatives": ["other specific songs that could work"]
  }
  
  Command: "${command}"`;

  try {
    const { stdout } = await execAsync(
      `echo '${prompt.replace(/'/g, "'\\''")}' | claude -p 'Analyze deeply and respond with detailed JSON only' --output-format text`
    );

    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('Failed to interpret command:', error);
    return {
      intent: 'unknown',
      confidence: 0,
      alternatives: ['Could not understand the command']
    };
  }
}

// Apply modifiers to filter and rank search results
function applySearchModifiers(
  tracks: SpotifyTrack[], 
  modifiers?: InterpretationResult['modifiers']
): TrackWithScore[] {
  if (!modifiers || tracks.length === 0) {
    return tracks.map(t => ({ ...t, relevanceScore: 1.0 }));
  }

  return tracks.map(track => {
    let score = 1.0;
    const trackName = track.name.toLowerCase();
    const albumName = track.album.name.toLowerCase();

    // Handle obscurity modifier
    if (modifiers.obscurity) {
      const popularity = track.popularity || 50;
      switch (modifiers.obscurity) {
        case 'obscure':
        case 'rare':
        case 'deep_cut':
          // Prefer low popularity tracks
          score *= (100 - popularity) / 100;
          break;
        case 'popular':
        case 'mainstream':
          // Prefer high popularity tracks
          score *= popularity / 100;
          break;
      }
    }

    // Handle version modifier
    if (modifiers.version) {
      const version = modifiers.version.toLowerCase();
      
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
    if (modifiers.exclude && modifiers.exclude.length > 0) {
      for (const exclude of modifiers.exclude) {
        if (trackName.includes(exclude.toLowerCase()) || 
            albumName.includes(exclude.toLowerCase())) {
          score *= 0.1;
        }
      }
    }

    return { ...track, relevanceScore: score };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Enhanced command endpoint
enhancedClaudeRouter.post('/command', tempAuthMiddleware, async (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }

  if (!req.session.spotifyTokens) {
    return res.status(401).json({ error: 'Not authenticated with Spotify' });
  }

  console.log('Processing enhanced command:', command);

  try {
    const interpretation = await interpretCommand(command);
    console.log('Enhanced interpretation:', interpretation);

    const spotifyControl = new SpotifyControl(
      req.spotifyTokens!,
      (tokens) => { req.spotifyTokens = tokens; }
    );
    let result;

    switch (interpretation.intent) {
      case 'play_specific_song':
        if (interpretation.query || (interpretation.artist && interpretation.track)) {
          // Use precise Spotify search syntax if we have artist and track
          let searchQuery = interpretation.query || '';
          if (interpretation.artist && interpretation.track) {
            searchQuery = `artist:"${interpretation.artist}" track:"${interpretation.track}"`;
            console.log(`Claude interpreted: "${command}" → artist:"${interpretation.artist}" track:"${interpretation.track}"`);
          } else {
            console.log(`Claude interpreted: "${command}" → "${searchQuery}"`);
          }
          
          if (interpretation.reasoning) {
            console.log(`Reasoning: ${interpretation.reasoning}`);
          }

          const searchResults = await spotifyControl.search(searchQuery);
          const rankedTracks = applySearchModifiers(searchResults, interpretation.modifiers);
          
          if (rankedTracks.length === 0) {
            result = { success: false, message: `No tracks found for: "${searchQuery}"` };
          } else {
            const topTrack = rankedTracks[0];
            await spotifyControl.playTrack(topTrack.uri);
            
            result = {
              success: true,
              message: `Playing: ${topTrack.name} by ${topTrack.artists.map(a => a.name).join(', ')}`,
              track: topTrack,
              alternatives: rankedTracks.slice(1, 5).map(t => ({
                name: t.name,
                artists: t.artists.map(a => a.name).join(', '),
                popularity: t.popularity,
                relevanceScore: t.relevanceScore
              })),
              interpretation: {
                confidence: interpretation.confidence,
                modifiers: interpretation.modifiers,
                enhancedQuery: searchQuery !== interpretation.query ? searchQuery : undefined,
                reasoning: interpretation.reasoning
              }
            };
          }
        } else {
          result = { success: false, message: 'No search query provided' };
        }
        break;
        
      case 'queue_specific_song':
        if (interpretation.query || (interpretation.artist && interpretation.track)) {
          // Use precise Spotify search syntax if we have artist and track
          let searchQuery = interpretation.query || '';
          if (interpretation.artist && interpretation.track) {
            searchQuery = `artist:"${interpretation.artist}" track:"${interpretation.track}"`;
            console.log(`Claude interpreted for queue: "${command}" → artist:"${interpretation.artist}" track:"${interpretation.track}"`);
          } else {
            console.log(`Claude interpreted for queue: "${command}" → "${searchQuery}"`);
          }

          const searchResults = await spotifyControl.search(searchQuery);
          const rankedTracks = applySearchModifiers(searchResults, interpretation.modifiers);
          
          if (rankedTracks.length === 0) {
            result = { success: false, message: `No tracks found for: "${searchQuery}"` };
          } else {
            const topTrack = rankedTracks[0];
            await spotifyControl.queueTrackByUri(topTrack.uri);
            
            result = {
              success: true,
              message: `Added to queue: ${topTrack.name} by ${topTrack.artists.map(a => a.name).join(', ')}`,
              track: topTrack,
              interpretation: {
                confidence: interpretation.confidence,
                modifiers: interpretation.modifiers
              }
            };
          }
        } else {
          result = { success: false, message: 'No search query provided' };
        }
        break;
        
      // Handle other intents...
      case 'play':
        result = await spotifyControl.play();
        break;
      case 'pause':
        result = await spotifyControl.pause();
        break;
      case 'skip':
      case 'next':
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
      case 'get_current_track':
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
    console.error('Enhanced command processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process command',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mood-based search endpoint (Phase 2 preview)
enhancedClaudeRouter.post('/mood-search', tempAuthMiddleware, async (req, res) => {
  const { mood } = req.body;
  
  if (!mood) {
    return res.status(400).json({ error: 'No mood provided' });
  }

  // Simple mood to audio feature mapping
  const moodMappings: Record<string, any> = {
    'chill': { min_energy: 0.0, max_energy: 0.4, min_valence: 0.3, max_valence: 0.7 },
    'energetic': { min_energy: 0.7, max_energy: 1.0, min_tempo: 120 },
    'melancholy': { min_valence: 0.0, max_valence: 0.3, min_energy: 0.0, max_energy: 0.5 },
    'upbeat': { min_valence: 0.7, max_valence: 1.0, min_energy: 0.6, max_energy: 1.0 },
    'peaceful': { min_energy: 0.0, max_energy: 0.3, min_tempo: 60, max_tempo: 90 }
  };

  const features = moodMappings[mood.toLowerCase()] || {};
  
  res.json({
    message: `Mood mapping for "${mood}"`,
    features,
    note: 'Full mood-based search coming in Phase 2'
  });
});

