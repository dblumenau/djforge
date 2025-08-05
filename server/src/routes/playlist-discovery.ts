import { Router, Request, Response } from 'express';
import { requireValidTokens } from '../middleware/session-auth';
import { SpotifyWebAPI } from '../spotify/api';
import { llmOrchestrator, LLMRequest } from '../llm/orchestrator';
import { PlaylistDiscoveryRequest, PlaylistDiscoveryResponse, SelectedPlaylist } from '../types';
import { z } from 'zod';
import crypto from 'crypto';
import { LLMLoggingService } from '../services/llm-logging.service';
import { createHash } from 'crypto';
import { MusicWebSocketService } from '../services/musicWebSocket.service';

// Get the music websocket service instance
const getMusicWebSocketService = () => MusicWebSocketService.getInstance();

const router = Router();

// Redis client for caching (will be set by server.ts)
let redisClient: any = null;

export function setRedisClient(client: any) {
  redisClient = client;
}

// LLM logging service (will be set by server.ts)
let loggingService: LLMLoggingService | null = null;

export function setLoggingService(service: LLMLoggingService) {
  loggingService = service;
}

// Hash function for user IDs
function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').substring(0, 16);
}

// Apply auth middleware to all routes
router.use(requireValidTokens);

// Simplified schema for playlist selection to avoid Gemini parsing issues
const PlaylistSelectionSchema = z.object({
  selectedPlaylistIds: z.array(z.string()).max(50), // Allow more IDs based on renderLimit
  reasoning: z.string().optional()
});

// Simplified schema for playlist summarization to avoid Gemini parsing issues
const PlaylistSummarizationSchema = z.object({
  summary: z.string(),
  alignmentLevel: z.enum(['strong', 'moderate', 'weak', 'tangential']).optional(),
  characteristics: z.object({
    primaryGenre: z.string().optional(),
    mood: z.string().optional(),
    instrumentation: z.array(z.string()).optional(),
    tempo: z.string().optional(),
    decadeRange: z.string().optional() // e.g., "2010s-2020s", "1980s", "Various"
  }).optional(),
  matchScore: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional()
});

/**
 * LLM-powered playlist discovery endpoint
 * POST /api/playlist-discovery/search
 * 
 * Accepts natural language query, performs Spotify search,
 * uses LLM to select top 5 candidates, returns playlist metadata
 */
router.post('/search', async (req: Request & { tokens?: any; userId?: string }, res: Response<PlaylistDiscoveryResponse>) => {
  try {
    const { query, model }: PlaylistDiscoveryRequest & { model?: string } = req.body;
    const sessionId = req.headers['x-session-id'] as string;

    // Validate query
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    console.log(`🤖 LLM Playlist Discovery: "${query}"`);

    // Get tokens from requireValidTokens middleware
    const tokens = req.tokens;
    if (!tokens) {
      throw new Error('No Spotify tokens available');
    }

    // Create Spotify API instance
    const spotifyApi = new SpotifyWebAPI(tokens, (newTokens) => {
      req.tokens = newTokens;
    });

    // Step 1: Perform initial Spotify search for playlists
    console.log('🔍 Step 1: Performing initial Spotify search...');
    const searchResults = await spotifyApi.searchPlaylists(query.trim(), 50, 0);
    
    const playlists = searchResults.playlists?.items || [];
    
    if (playlists.length === 0) {
      return res.json({
        query: query.trim(),
        selectedPlaylists: [],
        message: 'No playlists found for this query'
      });
    }

    console.log(`📦 Found ${playlists.length} playlists from Spotify search`);

    // Step 2: Prepare playlist data for LLM analysis
    const playlistsForAnalysis = playlists
      .filter((playlist: any) => playlist != null)
      .map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name || 'Untitled',
        description: playlist.description || '',
        owner: playlist.owner?.display_name || 'Unknown',
        trackCount: playlist.tracks?.total || 0,
        followers: playlist.followers?.total || 0,
        isPublic: playlist.public !== false,
        images: playlist.images || []
      }));

    // Step 3: Send to LLM for analysis and selection
    console.log('🧠 Step 2: Analyzing playlists with LLM...');

    const llmPrompt = `User is looking for playlists matching: "${query}"

Here are ${playlistsForAnalysis.length} playlists from Spotify search results:

${playlistsForAnalysis.map((p: any, i: number) => 
  `[${i + 1}]
   ID: ${p.id}
   Name: "${p.name}"
   Description: "${p.description || 'No description'}"
   Owner: ${p.owner}
   Tracks: ${p.trackCount}
   Followers: ${p.followers}
   Public: ${p.isPublic}
`).join('\n')}

Analyze these playlists and select up to 10 that best match the user's intent: "${query}"

Consider:
- Name relevance to the query
- Description content and how it matches the intent
- Track count (prefer playlists with reasonable number of tracks, avoid very small ones)
- Follower count as a quality/popularity signal
- Owner credibility (verified accounts or high follower counts often indicate quality)

Return between 5-10 playlist IDs that best match the query.
Include more playlists to provide variety and fallback options.
Focus on quality but aim for at least 8-10 good matches when available.

Respond with a JSON object containing:
- selectedPlaylistIds: array of ONLY the playlist ID strings (e.g., ["035OfvPcp5PUAAogsLxsbM", "7M65Xoo7Mr0XOrF5Dpd4CX"]) without any numbers or prefixes
- reasoning: brief explanation of why these were chosen (optional)`;

    // Scale max_tokens based on the number of playlists being analyzed
    // Base: 8000 tokens, plus 150 tokens per playlist to handle the increased data
    // Gemini 2.5 Flash supports up to 64k output tokens
    const calculatedMaxTokens = Math.min(
      8000 + (playlistsForAnalysis.length * 150),
      60000 // Cap at 60k to leave buffer from Gemini's 64k limit
    );
    
    console.log(`📊 Token Allocation for Playlist Selection:`);
    console.log(`   - Analyzing ${playlistsForAnalysis.length} playlists`);
    console.log(`   - Max output tokens: ${calculatedMaxTokens.toLocaleString()}`);
    console.log(`   - Model limit: 64,000 tokens (Gemini 2.5 Flash)`);

    const llmRequest: LLMRequest & { intentType?: string } = {
      model: model || 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a music curator AI that analyzes playlists and selects the best matches for user queries. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: llmPrompt
        }
      ],
      response_format: { type: 'json_object' },
      schema: PlaylistSelectionSchema,
      temperature: 0.4, // Lower temperature for more consistent selections
      max_tokens: calculatedMaxTokens,
      intentType: 'playlist_selection' // Use dedicated playlist selection schema
    };

    let llmResponse;
    let latency = 0;
    
    try {
      const startTime = Date.now();
      llmResponse = await llmOrchestrator.complete(llmRequest);
      latency = Date.now() - startTime;
    } catch (error: any) {
      console.error('❌ LLM request failed:', error);
      return res.status(500).json({
        success: false,
        error: `Playlist selection failed: ${error.message}`,
        model: llmRequest.model || 'unknown'
      });
    }

    // Step 4: Parse and validate LLM response with lenient validation
    let selectionData;
    try {
      selectionData = JSON.parse(llmResponse.content);
      // Try to parse with schema, but be lenient with missing fields
      const parsed = PlaylistSelectionSchema.safeParse(selectionData);
      if (!parsed.success) {
        console.warn('⚠️ Schema validation failed, attempting lenient parsing:', parsed.error);
        // Extract what we can from the response
        if (selectionData.selectedPlaylistIds && Array.isArray(selectionData.selectedPlaylistIds)) {
          selectionData = {
            selectedPlaylistIds: selectionData.selectedPlaylistIds.slice(0, 5),
            reasoning: selectionData.reasoning || 'No reasoning provided'
          };
        } else {
          throw new Error('No valid selectedPlaylistIds found in response');
        }
      }
    } catch (error: any) {
      console.error('❌ Invalid LLM response format:', error);
      console.error('LLM response content:', llmResponse.content);
      
      return res.status(500).json({
        success: false,
        error: `Playlist selection response parsing failed: ${error.message}`,
        model: llmResponse?.model || llmRequest.model || 'unknown'
      });
    }

    // Step 5: Map selected IDs back to full playlist data
    const selectedPlaylists = selectionData.selectedPlaylistIds
      .map((id: string) => playlistsForAnalysis.find((p: any) => p.id === id))
      .filter((playlist: any) => playlist !== undefined)
      .map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name,
        owner: playlist.owner,
        description: playlist.description || 'No description available',
        trackCount: playlist.trackCount,
        followers: playlist.followers,
        images: playlist.images
      }));

    console.log(`✅ LLM selected ${selectedPlaylists.length} playlists`);
    if (selectionData.reasoning) {
      console.log(`💭 LLM reasoning: ${selectionData.reasoning}`);
    }

    // Log the LLM interaction
    if (loggingService && req.userId) {
      try {
        await loggingService.logInteraction({
          timestamp: Date.now(),
          userId: hashUserId(req.userId),
          sessionId: sessionId || 'unknown',
          command: `Playlist Discovery Search: "${query}"`,
          interpretation: {
            selectedPlaylistIds: selectionData.selectedPlaylistIds,
            reasoning: selectionData.reasoning,
            playlistCount: selectedPlaylists.length,
            fallbackUsed: false,
            playlistsAnalyzed: playlistsForAnalysis.map((p: any) => ({
              id: p.id,
              name: p.name,
              owner: p.owner,
              trackCount: p.trackCount,
              followers: p.followers
            }))
          },
          llmRequest: {
            model: llmRequest.model || 'unknown',
            provider: llmResponse.provider || 'unknown',
            flow: llmResponse.flow || 'unknown',
            messages: llmRequest.messages,
            temperature: llmRequest.temperature || 0,
            jsonMode: llmRequest.response_format?.type === 'json_object',
            fullRequest: llmResponse.fullRequest
          },
          llmResponse: {
            content: llmResponse.content,
            usage: llmResponse.usage,
            latency: latency,
            fallbackUsed: false,
            rawResponse: llmResponse.rawResponse,
            processingSteps: llmResponse.processingSteps
          },
          result: {
            success: selectedPlaylists.length > 0,
            message: selectedPlaylists.length > 0 ? 
              `Successfully selected ${selectedPlaylists.length} playlists` : 
              'No playlists selected'
          }
        });
      } catch (error) {
        console.error('Failed to log LLM interaction:', error);
        // Don't throw - logging failure shouldn't break the request
      }
    }

    // Return the curated results
    const response: any = {
      query: query.trim(),
      selectedPlaylists,
      llmReasoning: selectionData.reasoning,
      totalSearchResults: playlists.length,
      model: llmResponse.model,
      provider: llmResponse.provider
    };
    
    res.json(response);

  } catch (error: any) {
    console.error('❌ Error in playlist discovery:', error);
    
    // Handle specific Spotify API errors
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please log in again.'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to discover playlists'
    });
  }
});

// Zod schema for batch details request validation
const BatchDetailsRequestSchema = z.object({
  playlistIds: z.array(z.string()).min(1).max(10)
});

interface BatchDetailsRequest {
  playlistIds: string[];
}

interface PlaylistDetails {
  id: string;
  name: string;
  owner: string;
  description: string;
  followers: number;
  trackCount: number;
  tracks: any[];
  uniqueArtists: string[];
  images: Array<{
    url: string;
    width?: number;
    height?: number;
  }>;
}

interface BatchDetailsResponse {
  playlists: PlaylistDetails[];
  totalArtists: number;
  fetchedFromCache: string[];
  fetchedFromAPI: string[];
}

interface PlaylistSummarizationRequest {
  playlistId: string;
  originalQuery?: string;
}

interface PlaylistCharacteristics {
  primaryGenre?: string;
  mood?: string;
  instrumentation?: string[];
  tempo?: string;
  decadeRange?: string;
}

interface PlaylistSummarizationResponse {
  playlistId: string;
  summary: string;
  characteristics?: PlaylistCharacteristics;
  matchScore?: number;
  reasoning?: string;
  model: string;
  provider: string;
  fromCache: boolean;
}

/**
 * Batch playlist details fetcher endpoint
 * POST /api/playlist-discovery/batch-details
 * 
 * Accepts array of playlist IDs (up to 5), fetches full details for each,
 * extracts unique artists, implements caching and rate limiting
 */
router.post('/batch-details', async (req: Request & { tokens?: any; userId?: string }, res: Response<BatchDetailsResponse>) => {
  try {
    const { playlistIds }: BatchDetailsRequest = req.body;

    // Validate request body
    try {
      BatchDetailsRequestSchema.parse({ playlistIds });
    } catch (error: any) {
      return res.status(400).json({
        playlists: [],
        totalArtists: 0,
        fetchedFromCache: [],
        fetchedFromAPI: []
      } as any);
    }

    console.log(`📋 Batch Playlist Details: ${playlistIds.length} playlists requested`);

    // Get tokens from requireValidTokens middleware
    const tokens = req.tokens;
    if (!tokens) {
      throw new Error('No Spotify tokens available');
    }

    // Create Spotify API instance
    const spotifyApi = new SpotifyWebAPI(tokens, (newTokens) => {
      req.tokens = newTokens;
    });

    const fetchedFromCache: string[] = [];
    const fetchedFromAPI: string[] = [];
    const playlists: PlaylistDetails[] = [];
    const allUniqueArtists = new Set<string>();

    // Process each playlist sequentially with rate limiting
    for (let i = 0; i < playlistIds.length; i++) {
      const playlistId = playlistIds[i];
      const cacheKey = `playlist:details:${playlistId}`;
      
      let playlistDetails: any = null;

      // Try to get from cache first (if Redis is available)
      if (redisClient) {
        try {
          const cachedData = await redisClient.get(cacheKey);
          if (cachedData) {
            playlistDetails = JSON.parse(cachedData);
            fetchedFromCache.push(playlistId);
            console.log(`💾 Cache hit for playlist ${playlistId}`);
          }
        } catch (error) {
          console.warn('⚠️ Redis cache read failed:', error);
        }
      }

      // If not in cache, fetch from Spotify API
      if (!playlistDetails) {
        try {
          console.log(`🎵 Fetching playlist details from Spotify API: ${playlistId}`);
          
          // Fetch basic playlist info
          const playlist = await spotifyApi.getPlaylist(playlistId);
          
          // Fetch all tracks (handling pagination)
          const tracks: any[] = [];
          let offset = 0;
          const limit = 50;
          
          do {
            const tracksBatch = await spotifyApi.getPlaylistTracks(playlistId, limit, offset);
            const items = tracksBatch.items || [];
            tracks.push(...items);
            offset += limit;
            
            // If we got fewer items than requested, we've reached the end
            if (items.length < limit) break;
            
            // Add small delay between track fetches to be respectful
            if (items.length === limit) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } while (tracks.length < (playlist.tracks?.total || 0));

          // Extract unique artists from all tracks
          const artistsInPlaylist = new Set<string>();
          tracks.forEach((item: any) => {
            if (item.track?.artists) {
              item.track.artists.forEach((artist: any) => {
                if (artist.name) {
                  artistsInPlaylist.add(artist.name);
                  allUniqueArtists.add(artist.name);
                }
              });
            }
          });

          playlistDetails = {
            id: playlist.id,
            name: playlist.name || 'Untitled',
            owner: playlist.owner?.display_name || 'Unknown',
            description: playlist.description || '',
            followers: playlist.followers?.total || 0,
            trackCount: tracks.length,
            tracks: tracks.map((item: any) => ({
              id: item.track?.id,
              name: item.track?.name,
              artists: item.track?.artists?.map((artist: any) => ({
                id: artist.id,
                name: artist.name
              })) || [],
              album: {
                id: item.track?.album?.id,
                name: item.track?.album?.name,
                images: item.track?.album?.images || []
              },
              duration_ms: item.track?.duration_ms,
              uri: item.track?.uri,
              preview_url: item.track?.preview_url
            })).filter(track => track.id), // Filter out null tracks
            uniqueArtists: Array.from(artistsInPlaylist),
            images: playlist.images || []
          };

          fetchedFromAPI.push(playlistId);

          // Cache the result (if Redis is available)
          if (redisClient) {
            try {
              await redisClient.setEx(cacheKey, 86400, JSON.stringify(playlistDetails)); // 24 hour TTL
              console.log(`💾 Cached playlist details for ${playlistId}`);
            } catch (error) {
              console.warn('⚠️ Redis cache write failed:', error);
            }
          }

        } catch (error: any) {
          console.error(`❌ Failed to fetch playlist ${playlistId}:`, error.message);
          // Continue with other playlists on error
          continue;
        }
      } else {
        // Add cached playlist's artists to the total set
        if (playlistDetails.uniqueArtists) {
          playlistDetails.uniqueArtists.forEach((artist: string) => {
            allUniqueArtists.add(artist);
          });
        }
      }

      if (playlistDetails) {
        playlists.push(playlistDetails);
      }

      // Add delay between API requests (300ms as specified)
      if (i < playlistIds.length - 1 && fetchedFromAPI.includes(playlistId)) {
        console.log('⏱️ Rate limiting: waiting 300ms before next API request...');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`✅ Batch fetch complete: ${playlists.length}/${playlistIds.length} playlists processed`);
    console.log(`📊 Cache stats: ${fetchedFromCache.length} from cache, ${fetchedFromAPI.length} from API`);
    console.log(`🎤 Total unique artists across all playlists: ${allUniqueArtists.size}`);

    res.json({
      playlists,
      totalArtists: allUniqueArtists.size,
      fetchedFromCache,
      fetchedFromAPI
    });

  } catch (error: any) {
    console.error('❌ Error in batch playlist details:', error);
    
    // Handle specific Spotify API errors
    if (error.response?.status === 401) {
      return res.status(401).json({
        playlists: [],
        totalArtists: 0,
        fetchedFromCache: [],
        fetchedFromAPI: []
      } as any);
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        playlists: [],
        totalArtists: 0,
        fetchedFromCache: [],
        fetchedFromAPI: []
      } as any);
    }

    res.status(500).json({
      playlists: [],
      totalArtists: 0,
      fetchedFromCache: [],
      fetchedFromAPI: []
    } as any);
  }
});

/**
 * LLM playlist summarization endpoint
 * POST /api/playlist-discovery/summarize
 * 
 * Accepts playlist ID and optional original query, uses LLM to analyze
 * playlist tracks and generate 2-3 sentence description with characteristics
 */
router.post('/summarize', async (req: Request & { tokens?: any; userId?: string }, res: Response<PlaylistSummarizationResponse>) => {
  try {
    const { playlistId, originalQuery, model }: PlaylistSummarizationRequest & { model?: string } = req.body;
    const sessionId = req.headers['x-session-id'] as string;

    // Validate request body
    if (!playlistId || typeof playlistId !== 'string') {
      return res.status(400).json({
        playlistId: '',
        summary: '',
        model: '',
        provider: '',
        fromCache: false
      } as any);
    }

    console.log(`🤖 LLM Playlist Summarization: ${playlistId}${originalQuery ? ` (query: "${originalQuery}")` : ''}`);

    // Create cache key based on playlist ID and query hash
    let cacheKey = `playlist:summary:${playlistId}`;
    if (originalQuery) {
      const queryHash = crypto.createHash('md5').update(originalQuery.trim().toLowerCase()).digest('hex').substring(0, 8);
      cacheKey = `playlist:summary:${playlistId}:${queryHash}`;
    }

    // Try to get from cache first (if Redis is available)
    if (redisClient) {
      try {
        const cachedSummary = await redisClient.get(cacheKey);
        if (cachedSummary) {
          const parsed = JSON.parse(cachedSummary);
          console.log(`💾 Cache hit for playlist summary ${playlistId}`);
          return res.json({
            ...parsed,
            fromCache: true
          });
        }
      } catch (error) {
        console.warn('⚠️ Redis cache read failed:', error);
      }
    }

    // Get tokens from requireValidTokens middleware
    const tokens = req.tokens;
    if (!tokens) {
      throw new Error('No Spotify tokens available');
    }

    // Create Spotify API instance
    const spotifyApi = new SpotifyWebAPI(tokens, (newTokens) => {
      req.tokens = newTokens;
    });

    // First, check if we have detailed playlist data in cache
    const detailsCacheKey = `playlist:details:${playlistId}`;
    let playlistDetails: any = null;

    if (redisClient) {
      try {
        const cachedDetails = await redisClient.get(detailsCacheKey);
        if (cachedDetails) {
          playlistDetails = JSON.parse(cachedDetails);
          console.log(`💾 Using cached playlist details for ${playlistId}`);
        }
      } catch (error) {
        console.warn('⚠️ Redis cache read failed for playlist details:', error);
      }
    }

    // If no cached details, fetch basic playlist info and tracks
    if (!playlistDetails) {
      console.log(`🎵 Fetching playlist details for summarization: ${playlistId}`);
      
      try {
        // Fetch basic playlist info
        const playlist = await spotifyApi.getPlaylist(playlistId);
        
        // Fetch first 30 tracks for analysis (as specified in the plan)
        const tracksBatch = await spotifyApi.getPlaylistTracks(playlistId, 30, 0);
        const tracks = tracksBatch.items || [];

        // Extract unique artists from tracks
        const artistsInPlaylist = new Set<string>();
        tracks.forEach((item: any) => {
          if (item.track?.artists) {
            item.track.artists.forEach((artist: any) => {
              if (artist.name) {
                artistsInPlaylist.add(artist.name);
              }
            });
          }
        });

        playlistDetails = {
          id: playlist.id,
          name: playlist.name || 'Untitled',
          owner: playlist.owner?.display_name || 'Unknown',
          description: playlist.description || '',
          followers: playlist.followers?.total || 0,
          trackCount: playlist.tracks?.total || 0,
          tracks: tracks.map((item: any) => ({
            id: item.track?.id,
            name: item.track?.name,
            artists: item.track?.artists?.map((artist: any) => ({
              id: artist.id,
              name: artist.name
            })) || [],
            duration_ms: item.track?.duration_ms,
            uri: item.track?.uri
          })).filter((track: any) => track.id), // Filter out null tracks
          uniqueArtists: Array.from(artistsInPlaylist)
        };
      } catch (error: any) {
        console.error(`❌ Failed to fetch playlist ${playlistId} for summarization:`, error.message);
        throw new Error(`Failed to fetch playlist details: ${error.message}`);
      }
    }

    // Prepare data for LLM analysis
    const first30Tracks = playlistDetails.tracks.slice(0, 30);
    const trackList = first30Tracks.map((track: any, index: number) => 
      `${index + 1}. "${track.name}" by ${track.artists.map((a: any) => a.name).join(', ')}`
    ).join('\n');

    const uniqueArtists = playlistDetails.uniqueArtists.slice(0, 20); // Limit to first 20 artists for prompt length

    // Create LLM prompt based on the plan specification
    const llmPrompt = `Playlist: ${playlistDetails.name}
Tracks: 
${trackList}

Artists featured: ${uniqueArtists.join(', ')}
${originalQuery ? `User query: ${originalQuery}` : ''}

Write a 2-3 sentence description explaining:
1. How this playlist matches the user's request${originalQuery ? ` ("${originalQuery}")` : ' or general music preferences'}
2. What makes it unique or interesting
3. The general mood/style

Also identify key characteristics including:
- Primary genre (single word/phrase)
- Mood (single word/phrase) 
- Instrumentation (array of key instruments if identifiable)
- Tempo (slow/medium/fast/varied)
- Decade range (e.g., "2010s-2020s", "1980s", "Various")

Provide a match score (0.0-1.0) indicating how well this playlist matches the user's intent${originalQuery ? '' : ' based on general appeal'}.

Respond with a JSON object containing:
- summary: your 2-3 sentence description
- characteristics: object with primaryGenre, mood, instrumentation (array), tempo, decadeRange
- matchScore: number between 0.0 and 1.0
- reasoning: brief explanation of the match score`;

    const llmRequest: LLMRequest & { intentType?: string } = {
      model: model || 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a music analysis AI that creates engaging summaries of Spotify playlists. Always respond with valid JSON. Focus on being informative yet concise.'
        },
        {
          role: 'user',
          content: llmPrompt
        }
      ],
      response_format: { type: 'json_object' },
      schema: PlaylistSummarizationSchema,
      temperature: 0.4, // Slightly creative but consistent
      max_tokens: 16000, // Increased for comprehensive summary generation
      intentType: 'playlist_summarization' // Use dedicated playlist summarization schema
    };

    let llmResponse;
    let latency = 0;
    
    try {
      const startTime = Date.now();
      llmResponse = await llmOrchestrator.complete(llmRequest);
      latency = Date.now() - startTime;
    } catch (error: any) {
      console.error('❌ LLM request failed:', error);
      return res.status(500).json({
        success: false,
        error: `Playlist summarization failed: ${error.message}`,
        model: llmRequest.model || 'unknown'
      } as any);
    }

    // Parse and validate LLM response with lenient validation
    let summaryData;
    try {
      summaryData = JSON.parse(llmResponse.content);
      // Try to parse with schema, but be lenient with missing fields
      const parsed = PlaylistSummarizationSchema.safeParse(summaryData);
      if (!parsed.success) {
        console.warn('⚠️ Schema validation failed for summarization, attempting lenient parsing:', parsed.error);
        // Extract what we can from the response
        summaryData = {
          summary: summaryData.summary || `This playlist "${playlistDetails.name}" contains ${playlistDetails.trackCount} tracks.`,
          characteristics: summaryData.characteristics || {
            primaryGenre: 'Various',
            mood: 'Mixed',
            tempo: 'Varied'
          },
          matchScore: typeof summaryData.matchScore === 'number' ? summaryData.matchScore : 0.7,
          reasoning: summaryData.reasoning || 'Analysis completed with limited schema validation'
        };
      }
    } catch (error: any) {
      console.error('❌ Invalid LLM summarization response format:', error);
      console.error('LLM response content:', llmResponse.content);
      
      return res.status(500).json({
        success: false,
        error: `Playlist summarization response parsing failed: ${error.message}`,
        model: llmResponse?.model || llmRequest.model || 'unknown'
      } as any);
    }

    // Prepare response
    const response: any = {
      playlistId,
      summary: summaryData.summary,
      characteristics: summaryData.characteristics,
      matchScore: summaryData.matchScore,
      reasoning: summaryData.reasoning,
      model: llmResponse.model,
      provider: llmResponse.provider,
      fromCache: false
    };

    // Cache the result with 7-day TTL as specified in the plan
    if (redisClient) {
      try {
        await redisClient.setEx(cacheKey, 604800, JSON.stringify({
          playlistId,
          summary: summaryData.summary,
          characteristics: summaryData.characteristics,
          matchScore: summaryData.matchScore,
          reasoning: summaryData.reasoning,
          model: llmResponse.model,
          provider: llmResponse.provider
        }));
        console.log(`💾 Cached playlist summary for ${playlistId} (7 days TTL)`);
      } catch (error) {
        console.warn('⚠️ Redis cache write failed:', error);
      }
    }

    console.log(`✅ Generated summary for playlist ${playlistId}`);
    console.log(`📝 Summary: ${summaryData.summary}`);
    if (summaryData.matchScore) {
      console.log(`📊 Match score: ${summaryData.matchScore}`);
    }

    // Log the LLM interaction
    if (loggingService && req.userId) {
      try {
        await loggingService.logInteraction({
          timestamp: Date.now(),
          userId: hashUserId(req.userId),
          sessionId: sessionId || 'unknown',
          command: `Playlist Summarization: "${playlistDetails.name}" (${playlistId})`,
          interpretation: {
            summary: summaryData.summary,
            characteristics: summaryData.characteristics,
            matchScore: summaryData.matchScore,
            reasoning: summaryData.reasoning,
            fallbackUsed: false,
            playlistDetails: {
              name: playlistDetails.name,
              trackCount: playlistDetails.trackCount,
              uniqueArtistsCount: uniqueArtists.length,
              first30Tracks: first30Tracks.map((track: any) => ({
                name: track.name,
                artists: track.artists.map((a: any) => a.name).join(', ')
              }))
            }
          },
          llmRequest: {
            model: llmRequest.model || 'unknown',
            provider: llmResponse.provider || 'unknown',
            flow: llmResponse.flow || 'unknown',
            messages: llmRequest.messages,
            temperature: llmRequest.temperature || 0,
            jsonMode: llmRequest.response_format?.type === 'json_object',
            fullRequest: llmResponse.fullRequest
          },
          llmResponse: {
            content: llmResponse.content,
            usage: llmResponse.usage,
            latency: latency,
            fallbackUsed: false,
            rawResponse: llmResponse.rawResponse,
            processingSteps: llmResponse.processingSteps
          },
          result: {
            success: true,
            message: `Successfully generated summary for playlist ${playlistId}`
          }
        });
      } catch (error) {
        console.error('Failed to log LLM interaction:', error);
        // Don't throw - logging failure shouldn't break the request
      }
    }

    res.json(response);

  } catch (error: any) {
    console.error('❌ Error in playlist summarization:', error);
    
    // Handle specific Spotify API errors
    if (error.response?.status === 401) {
      return res.status(401).json({
        playlistId: req.body.playlistId || '',
        summary: '',
        model: '',
        provider: '',
        fromCache: false
      } as any);
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        playlistId: req.body.playlistId || '',
        summary: '',
        model: '',
        provider: '', 
        fromCache: false
      } as any);
    }

    res.status(500).json({
      playlistId: req.body.playlistId || '',
      summary: '',
      model: '',
      provider: '',
      fromCache: false
    } as any);
  }
});

/**
 * Enhanced full workflow endpoint - combines all 3 phases
 * POST /api/playlist-discovery/full-search
 * 
 * Takes user query → search → batch details → summarize → return complete results
 * Provides the complete end-to-end playlist discovery experience in one API call
 */
router.post('/full-search', async (req: Request & { tokens?: any; userId?: string }, res: Response) => {
  try {
    const { query, model, playlistLimit = 40, trackSampleSize = 30, renderLimit = 10 }: PlaylistDiscoveryRequest & { 
      model?: string; 
      playlistLimit?: number; 
      trackSampleSize?: number; 
      renderLimit?: number; 
    } = req.body;

    // Validate query
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Validate and sanitize parameters
    const validatedPlaylistLimit = Math.min(Math.max(parseInt(String(playlistLimit), 10) || 40, 1), 200);
    const validatedTrackSampleSize = Math.min(Math.max(parseInt(String(trackSampleSize), 10) || 30, 10), 100);
    const validatedRenderLimit = Math.min(Math.max(parseInt(String(renderLimit), 10) || 10, 1), 50);

    console.log(`🚀 Full Playlist Discovery Workflow: "${query}" (playlistLimit: ${validatedPlaylistLimit}, trackSampleSize: ${validatedTrackSampleSize}, renderLimit: ${validatedRenderLimit})`);

    // Get tokens from requireValidTokens middleware
    const tokens = req.tokens;
    if (!tokens) {
      throw new Error('No Spotify tokens available');
    }

    // Create Spotify API instance
    const spotifyApi = new SpotifyWebAPI(tokens, (newTokens) => {
      req.tokens = newTokens;
    });

    // Initialize WebSocket service for progress emissions
    const musicWS = getMusicWebSocketService();
    const sessionId = req.headers['x-session-id'] as string;
    
    console.log('🔌 WebSocket Progress - SessionId:', sessionId, 'UserId:', req.userId);

    // Phase 1: Search and LLM Selection
    console.log('📍 Phase 1: Performing search and LLM selection...');
    
    // Progress: Before Spotify search
    if (musicWS && req.userId) {
      musicWS.emitToUser(req.userId, 'playlistDiscoveryProgress', {
        sessionId: sessionId || 'unknown',
        step: `Searching Spotify for '${query}'...`,
        phase: 'searching',
        timestamp: Date.now(),
        progress: 0  // Start at 0% for searching phase
      });
    }
    
    const searchStart = Date.now();
    let allPlaylists: any[] = [];
    
    // Calculate how many requests we need (50 per request)
    const requestsNeeded = Math.ceil(validatedPlaylistLimit / 50);
    
    // Make paginated requests
    for (let i = 0; i < requestsNeeded; i++) {
      const offset = i * 50;
      const limit = Math.min(50, validatedPlaylistLimit - offset);
      
      // Add delay between requests (except for the first one)
      if (i > 0) {
        const delayMs = 2000; // 2 second delay between requests
        console.log(`⏳ Waiting ${delayMs}ms before next request to avoid rate limiting...`);
        
        // Emit progress update about rate limit delay
        if (musicWS && req.userId) {
          // Keep the same progress percentage during the delay
          const currentProgress = (i / requestsNeeded) * 5;  // Current progress before next batch
          
          musicWS.emitToUser(req.userId, 'playlistDiscoveryProgress', {
            sessionId: sessionId || 'unknown',
            step: `Waiting to avoid rate limits... Next batch in 2 seconds`,
            phase: 'searching',
            timestamp: Date.now(),
            progress: currentProgress,  // Maintain current progress during delay
            itemNumber: i,  // Current completed batches
            totalItems: requestsNeeded,  // Total batches
            metadata: {
              isRateLimitDelay: true,
              delayMs: delayMs,
              nextBatch: i + 1,
              totalBatches: requestsNeeded
            }
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      console.log(`📄 Fetching playlists batch ${i + 1}/${requestsNeeded} (offset: ${offset}, limit: ${limit})`);
      
      const searchResults = await spotifyApi.searchPlaylists(query.trim(), limit, offset);
      const batchPlaylists = searchResults.playlists?.items || [];
      allPlaylists = allPlaylists.concat(batchPlaylists);
      
      // Progress update for each batch
      if (musicWS && req.userId) {
        // Calculate progress within the searching phase (0-5%)
        // We want to show progress as we fetch each batch
        const searchProgress = ((i + 1) / requestsNeeded) * 5;  // Maps to 0-5% of total progress
        
        musicWS.emitToUser(req.userId, 'playlistDiscoveryProgress', {
          sessionId: sessionId || 'unknown',
          step: `Fetching playlists page ${i + 1}/${requestsNeeded}... (${allPlaylists.length}/${validatedPlaylistLimit} collected)`,
          phase: 'searching',
          timestamp: Date.now(),
          progress: searchProgress,  // Direct progress value for the searching phase
          itemNumber: i + 1,  // Current batch number
          totalItems: requestsNeeded,  // Total batches
          metadata: {
            batchNumber: i + 1,
            totalBatches: requestsNeeded,
            playlistsFetched: allPlaylists.length,
            targetTotal: validatedPlaylistLimit
          }
        });
      }
      
      // If we got fewer results than requested, we've reached the end
      if (batchPlaylists.length < limit) {
        console.log(`📊 Reached end of results at batch ${i + 1}`);
        break;
      }
    }
    
    const playlists = allPlaylists;
    const searchTime = Date.now() - searchStart;
    
    // Progress: After search results - transition to analyzing phase
    if (musicWS && req.userId) {
      musicWS.emitToUser(req.userId, 'playlistDiscoveryProgress', {
        sessionId: sessionId || 'unknown',
        step: `Found ${playlists.length} playlists, sending to AI for analysis...`,
        phase: 'searching',
        timestamp: Date.now(),
        progress: 5,  // Complete the searching phase at 5%
        metadata: {
          searchTime: searchTime,
          playlistCount: playlists.length
        }
      });
    }
    
    if (playlists.length === 0) {
      return res.json({
        query: query.trim(),
        playlists: [],
        message: 'No playlists found for this query'
      });
    }

    // Prepare playlist data for LLM analysis
    const playlistsForAnalysis = playlists
      .filter((playlist: any) => playlist != null)
      .map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name || 'Untitled',
        description: playlist.description || '',
        owner: playlist.owner?.display_name || 'Unknown',
        trackCount: playlist.tracks?.total || 0,
        followers: playlist.followers?.total || 0,
        isPublic: playlist.public !== false,
        images: playlist.images || []
      }));

    // Progress: Before LLM analysis
    if (musicWS && req.userId) {
      musicWS.emitToUser(req.userId, 'playlistDiscoveryProgress', {
        sessionId: sessionId || 'unknown',
        step: `AI (${model || 'google/gemini-2.5-flash'}) analyzing ${playlistsForAnalysis.length} playlists...`,
        phase: 'analyzing',
        timestamp: Date.now()
      });
    }

    // LLM Selection
    const llmPrompt = `User is looking for playlists matching: "${query}"

Here are ${playlistsForAnalysis.length} playlists from Spotify search results:

${playlistsForAnalysis.map((p: any, i: number) => 
  `[${i + 1}]
   ID: ${p.id}
   Name: "${p.name}"
   Description: "${p.description || 'No description'}"
   Owner: ${p.owner}
   Tracks: ${p.trackCount}
   Followers: ${p.followers}
   Public: ${p.isPublic}
`).join('\n')}

Analyze these playlists and select up to ${validatedRenderLimit} that best match the user's intent: "${query}"

Consider:
- Name relevance to the query
- Description content and how it matches the intent
- Track count (prefer playlists with reasonable number of tracks, avoid very small ones)
- Follower count as a quality/popularity signal
- Owner credibility (verified accounts or high follower counts often indicate quality)

Return between ${Math.min(validatedRenderLimit, 5)}-${validatedRenderLimit} playlist IDs that best match the query.
Include more playlists to provide variety and fallback options.
Focus on quality but aim for at least ${Math.min(validatedRenderLimit, 8)} good matches when available.

Respond with a JSON object containing:
- selectedPlaylistIds: array of ONLY the playlist ID strings (e.g., ["035OfvPcp5PUAAogsLxsbM", "7M65Xoo7Mr0XOrF5Dpd4CX"]) without any numbers or prefixes
- reasoning: brief explanation of why these were chosen (optional)`;

    // Dynamic token allocation based on number of playlists to select
    // Be generous with tokens - we want complete responses
    // Gemini 2.5 Flash supports up to 64k output tokens
    const selectionMaxTokens = Math.min(
      Math.max(16000, 8000 + (validatedRenderLimit * 400)), // At least 16k, scales up generously
      60000 // Cap at 60k to leave buffer from Gemini's 64k limit
    );
    
    const llmRequest: LLMRequest & { intentType?: string } = {
      model: model || 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a music curator AI that analyzes playlists and selects the best matches for user queries. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: llmPrompt
        }
      ],
      response_format: { type: 'json_object' },
      schema: PlaylistSelectionSchema,
      temperature: 0.3,
      max_tokens: selectionMaxTokens,
      intentType: 'playlist_selection' // Use dedicated playlist selection schema
    };
    
    console.log(`📊 Token Allocation for Full Search Selection:`);
    console.log(`   - Selecting from ${playlistsForAnalysis.length} playlists`);
    console.log(`   - Target selection: ${validatedRenderLimit} playlists`);
    console.log(`   - Max output tokens: ${selectionMaxTokens.toLocaleString()}`);
    console.log(`   - Model limit: 64,000 tokens (Gemini 2.5 Flash)`);

    let llmResponse;
    let selectedPlaylistIds: string[] = [];
    let selectionLatency = 0;
    
    try {
      const startTime = Date.now();
      llmResponse = await llmOrchestrator.complete(llmRequest);
      selectionLatency = Date.now() - startTime;
      const selectionData = JSON.parse(llmResponse.content);
      
      // Progress: After LLM selection
      if (musicWS && req.userId) {
        musicWS.emitToUser(req.userId, 'playlistDiscoveryProgress', {
          sessionId: sessionId || 'unknown',
          step: `AI selected ${selectionData.selectedPlaylistIds?.length || 0} best matches in ${selectionLatency}ms`,
          phase: 'analyzing',
          timestamp: Date.now(),
          metadata: {
            model: llmResponse.model || model || 'google/gemini-2.5-flash',
            latency: selectionLatency,
            tokensUsed: llmResponse.usage?.total_tokens || 0
          }
        });
      }
      // Try schema parsing, but be lenient
      const parsed = PlaylistSelectionSchema.safeParse(selectionData);
      if (parsed.success) {
        selectedPlaylistIds = selectionData.selectedPlaylistIds;
      } else {
        console.warn('⚠️ Schema validation failed for selection, extracting IDs:', parsed.error);
        if (selectionData.selectedPlaylistIds && Array.isArray(selectionData.selectedPlaylistIds)) {
          selectedPlaylistIds = selectionData.selectedPlaylistIds.slice(0, validatedRenderLimit);
        } else {
          throw new Error('No valid selectedPlaylistIds found in response');
        }
      }
    } catch (error: any) {
      console.error('❌ LLM request failed:', error);
      return res.status(500).json({
        success: false,
        error: `Playlist selection failed: ${error.message}`,
        model: llmRequest.model || 'unknown'
      });
    }

    // Log the selection LLM interaction
    if (loggingService && req.userId && llmResponse) {
      try {
        await loggingService.logInteraction({
          timestamp: Date.now(),
          userId: hashUserId(req.userId),
          sessionId: sessionId || 'unknown',
          command: `Full Search - Playlist Selection: "${query}"`,
          interpretation: {
            selectedPlaylistIds,
            playlistCount: selectedPlaylistIds.length,
            fallbackUsed: false,
            playlistsAnalyzed: playlistsForAnalysis.map((p: any) => ({
              id: p.id,
              name: p.name,
              owner: p.owner,
              trackCount: p.trackCount,
              followers: p.followers
            }))
          },
          llmRequest: {
            model: llmRequest.model || 'unknown',
            provider: llmResponse.provider || 'unknown',
            flow: llmResponse.flow || 'unknown',
            messages: llmRequest.messages,
            temperature: llmRequest.temperature || 0,
            jsonMode: llmRequest.response_format?.type === 'json_object',
            fullRequest: llmResponse.fullRequest
          },
          llmResponse: {
            content: llmResponse.content,
            usage: llmResponse.usage,
            latency: selectionLatency,
            fallbackUsed: false,
            rawResponse: llmResponse.rawResponse,
            processingSteps: llmResponse.processingSteps
          },
          result: {
            success: selectedPlaylistIds.length > 0,
            message: selectedPlaylistIds.length > 0 ? 
              `Successfully selected ${selectedPlaylistIds.length} playlists for full analysis` : 
              'No playlists selected'
          }
        });
      } catch (error) {
        console.error('Failed to log LLM interaction:', error);
        // Don't throw - logging failure shouldn't break the request
      }
    }

    if (selectedPlaylistIds.length === 0) {
      return res.json({
        query: query.trim(),
        playlists: [],
        message: 'No suitable playlists found'
      });
    }

    console.log(`📍 Phase 2: Fetching details for ${selectedPlaylistIds.length} selected playlists (up to 10)...`);

    // Phase 2: Batch Details Fetching
    const playlistDetails: any[] = [];
    
    for (let i = 0; i < selectedPlaylistIds.length; i++) {
      const playlistId = selectedPlaylistIds[i];
      const cacheKey = `playlist:details:${playlistId}`;
      
      let details: any = null;
      let fromCache = false;

      // Try cache first
      if (redisClient) {
        try {
          const cachedData = await redisClient.get(cacheKey);
          if (cachedData) {
            details = JSON.parse(cachedData);
            fromCache = true;
          }
        } catch (error) {
          console.warn('⚠️ Redis cache read failed:', error);
        }
      }

      // Progress: For each playlist details fetch
      if (musicWS && req.userId) {
        const message = fromCache 
          ? `Loading cached data for playlist ${i + 1} of ${selectedPlaylistIds.length}...`
          : `Getting tracks and artists for playlist ${i + 1} of ${selectedPlaylistIds.length}...`;
        
        musicWS.emitToUser(req.userId, 'playlistDiscoveryProgress', {
          sessionId: sessionId || 'unknown',
          step: message,
          phase: 'fetching',
          timestamp: Date.now(),
          itemNumber: i + 1,
          totalItems: selectedPlaylistIds.length
        });
      }

      // If not in cache, fetch from API
      if (!details) {
        try {
          const playlist = await spotifyApi.getPlaylist(playlistId);
          const tracksBatch = await spotifyApi.getPlaylistTracks(playlistId, validatedTrackSampleSize, 0);
          const tracks = tracksBatch.items || [];

          const artistsInPlaylist = new Set<string>();
          tracks.forEach((item: any) => {
            if (item.track?.artists) {
              item.track.artists.forEach((artist: any) => {
                if (artist.name) {
                  artistsInPlaylist.add(artist.name);
                }
              });
            }
          });

          details = {
            id: playlist.id,
            name: playlist.name || 'Untitled',
            owner: playlist.owner?.display_name || 'Unknown',
            description: playlist.description || '',
            followers: playlist.followers?.total || 0,
            trackCount: playlist.tracks?.total || 0,
            tracks: tracks.map((item: any) => ({
              id: item.track?.id,
              name: item.track?.name,
              artists: item.track?.artists?.map((artist: any) => ({
                id: artist.id,
                name: artist.name
              })) || [],
              duration_ms: item.track?.duration_ms,
              uri: item.track?.uri
            })).filter((track: any) => track.id),
            uniqueArtists: Array.from(artistsInPlaylist),
            images: playlist.images || []
          };

          // Cache for 24 hours
          if (redisClient) {
            try {
              await redisClient.setEx(cacheKey, 86400, JSON.stringify(details));
            } catch (error) {
              console.warn('⚠️ Redis cache write failed:', error);
            }
          }

          // Rate limiting delay
          if (i < selectedPlaylistIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (error: any) {
          console.error(`❌ Failed to fetch playlist ${playlistId}:`, error.message);
          continue;
        }
      }

      if (details) {
        playlistDetails.push(details);
      }
    }

    console.log(`📍 Phase 3: Generating summaries for ${playlistDetails.length} playlists...`);

    // Phase 3: LLM Summarization for each playlist
    const finalResults: any[] = [];

    for (let playlistIndex = 0; playlistIndex < playlistDetails.length; playlistIndex++) {
      const playlist = playlistDetails[playlistIndex];
      const cacheKey = `playlist:summary:${playlist.id}:${crypto.createHash('md5').update(query.trim().toLowerCase()).digest('hex').substring(0, 8)}`;
      
      let summary: any = null;

      // Try cache first
      if (redisClient) {
        try {
          const cachedSummary = await redisClient.get(cacheKey);
          if (cachedSummary) {
            summary = JSON.parse(cachedSummary);
          }
        } catch (error) {
          console.warn('⚠️ Redis cache read failed:', error);
        }
      }

      // If not cached, generate summary
      if (!summary) {
        // Progress: Starting playlist summary (emit before starting the work)
        if (musicWS && req.userId) {
          // For progress calculation, we want to show we're STARTING to work on this playlist
          // So we use playlistIndex (0-based) to show partial progress
          const startingProgress = playlistIndex / playlistDetails.length;
          musicWS.emitToUser(req.userId, 'playlistDiscoveryProgress', {
            sessionId: sessionId || 'unknown',
            step: `AI analyzing music style of '${playlist.name}' (${playlistIndex + 1}/${playlistDetails.length})...`,
            phase: 'summarizing',
            timestamp: Date.now(),
            itemNumber: playlistIndex,  // 0-based to show we're starting this one
            totalItems: playlistDetails.length
          });
        }
        
        try {
          const tracksForAnalysis = playlist.tracks.slice(0, validatedTrackSampleSize);
          const trackList = tracksForAnalysis.map((track: any, index: number) => 
            `${index + 1}. "${track.name}" by ${track.artists.map((a: any) => a.name).join(', ')}`
          ).join('\n');

          const uniqueArtists = playlist.uniqueArtists.slice(0, 20);

          const summaryPrompt = `Analyze this playlist against the user query: "${query}"

Playlist: ${playlist.name}
Sample tracks (${tracksForAnalysis.length} shown):
${trackList}

Artists featured: ${uniqueArtists.join(', ')}

Provide an HONEST assessment following these rules:

STYLE GUIDE - MANDATORY:
DO:
- Use measured language: "partially", "mostly", "about half", "roughly 60%"
- Cite specific evidence: "7 of ${tracksForAnalysis.length} tracks are...", "tracks like X and Y show..."
- Acknowledge mismatches: "later tracks drift into...", "some tracks don't align..."

DON'T use these words (BANNED):
- perfect, perfectly, iconic, legendary, masterpiece, epitomizes
- amazing, incredible, fantastic, essential, definitive
- must-have, sultry, cruising, windows-down

GOOD example: "8 of 10 sampled tracks are 90s hip-hop classics, directly matching the 'old school hip hop' query. The remaining 2 are early 2000s R&B, slightly diluting the old school focus."

BAD example: "This playlist perfectly captures summer vibes with iconic anthems from legendary artists."

ANALYSIS STRUCTURE:
1. Match Analysis (2-3 sentences with evidence):
   - What percentage/fraction of tracks align with "${query}"?
   - Which specific elements match vs don't match?
   - Reference actual track names or artists as evidence

2. Alignment Level: Choose one: "strong" | "moderate" | "weak" | "tangential"

3. Characteristics:
   - Primary genre(s)
   - Mood/energy 
   - Era focus (decade or range)

Respond with JSON:
{
  "summary": "Your evidence-based match analysis",
  "alignmentLevel": "strong|moderate|weak|tangential",
  "characteristics": {
    "primaryGenre": "...",
    "mood": "...",
    "instrumentation": [...],
    "tempo": "slow|medium|fast|varied",
    "decadeRange": "..."
  },
  "matchScore": 0.0-1.0,
  "reasoning": "Brief explanation of why this score"
}`;

          // Dynamic token allocation for summaries - be generous
          // Gemini 2.5 Flash supports up to 64k output tokens
          const summaryMaxTokens = Math.min(
            Math.max(20000, 10000 + (validatedRenderLimit * 500)), // At least 20k, scales up for multiple summaries
            60000 // Cap at 60k to leave buffer from Gemini's 64k limit
          );
          
          const summaryLLMRequest: LLMRequest & { intentType?: string } = {
            model: model || 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are an impartial music analyst providing evidence-based assessments. Goal: Explain concisely HOW and WHY a playlist matches (or does not match) the user\'s query. Tone: Analytical, neutral, objective. NO marketing language or superlatives. Output: Valid JSON only.'
              },
              {
                role: 'user',
                content: summaryPrompt
              }
            ],
            response_format: { type: 'json_object' },
            schema: PlaylistSummarizationSchema,
            temperature: 0.3,  // Lower temperature for more analytical, less creative responses
            max_tokens: summaryMaxTokens,
            intentType: 'playlist_summarization' // Use dedicated playlist summarization schema
          };
          
          console.log(`📊 Token Allocation for Full Search Summary ${playlistIndex + 1}/${playlistDetails.length}:`);
          console.log(`   - Playlist: ${playlist.name}`);
          console.log(`   - Max output tokens: ${summaryMaxTokens.toLocaleString()}`);
          console.log(`   - Model limit: 64,000 tokens (Gemini 2.5 Flash)`);

          let summaryLLMResponse;
          let summaryLatency = 0;
          try {
            const summaryStartTime = Date.now();
            summaryLLMResponse = await llmOrchestrator.complete(summaryLLMRequest);
            summaryLatency = Date.now() - summaryStartTime;
          } catch (summaryError: any) {
            console.error('❌ LLM request failed:', summaryError.message);
            throw summaryError;
          }
          
          const summaryData = JSON.parse(summaryLLMResponse.content);
          // Try schema parsing, but be lenient
          const parsed = PlaylistSummarizationSchema.safeParse(summaryData);
          if (!parsed.success) {
            console.warn('⚠️ Schema validation failed for summary, using lenient parsing:', parsed.error);
          }

          summary = {
            summary: summaryData.summary || `This playlist "${playlist.name}" contains ${playlist.trackCount} tracks.`,
            alignmentLevel: summaryData.alignmentLevel || 'moderate',
            characteristics: summaryData.characteristics || {
              primaryGenre: 'Various',
              mood: 'Mixed',
              tempo: 'Varied'
            },
            matchScore: typeof summaryData.matchScore === 'number' ? summaryData.matchScore : 0.7,
            reasoning: summaryData.reasoning || 'Analysis completed'
          };
          
          // Progress: After playlist summary
          if (musicWS && req.userId) {
            const scorePercent = Math.round((summary.matchScore || 0) * 100);
            musicWS.emitToUser(req.userId, 'playlistDiscoveryProgress', {
              sessionId: sessionId || 'unknown',
              step: `'${playlist.name}' scored ${scorePercent}% match!`,
              phase: 'summarizing',
              timestamp: Date.now(),
              itemNumber: playlistIndex + 1,
              totalItems: playlistDetails.length,
              metadata: {
                latency: summaryLatency,
                tokensUsed: summaryLLMResponse.usage?.total_tokens || 0
              }
            });
          }

          // Log the LLM interaction for summarization
          if (loggingService && req.userId) {
            try {
              await loggingService.logInteraction({
                timestamp: Date.now(),
                userId: hashUserId(req.userId),
                sessionId: sessionId || 'unknown',
                command: `Full Search - Playlist Summarization: "${playlist.name}" (${playlist.id})`,
                interpretation: {
                  summary: summary.summary,
                  characteristics: summary.characteristics,
                  matchScore: summary.matchScore,
                  reasoning: summary.reasoning,
                  playlistDetails: {
                    name: playlist.name,
                    trackCount: playlist.trackCount,
                    uniqueArtistsCount: uniqueArtists.length,
                    tracksForAnalysis: tracksForAnalysis.map((track: any) => ({
                      name: track.name,
                      artists: track.artists.map((a: any) => a.name).join(', ')
                    }))
                  }
                },
                llmRequest: {
                  model: summaryLLMRequest.model || 'unknown',
                  provider: summaryLLMResponse.provider || 'unknown',
                  flow: summaryLLMResponse.flow || 'unknown',
                  messages: summaryLLMRequest.messages,
                  temperature: summaryLLMRequest.temperature || 0,
                  jsonMode: summaryLLMRequest.response_format?.type === 'json_object',
                  fullRequest: summaryLLMResponse.fullRequest
                },
                llmResponse: {
                  content: summaryLLMResponse.content,
                  usage: summaryLLMResponse.usage,
                  latency: summaryLatency,
                  fallbackUsed: false,
                  rawResponse: summaryLLMResponse.rawResponse,
                  processingSteps: summaryLLMResponse.processingSteps
                },
                result: {
                  success: true,
                  message: `Successfully generated summary for playlist ${playlist.id} in full search`
                }
              });
            } catch (error) {
              console.error('Failed to log LLM interaction:', error);
              // Don't throw - logging failure shouldn't break the request
            }
          }

          // Cache for 7 days
          if (redisClient) {
            try {
              await redisClient.setEx(cacheKey, 604800, JSON.stringify(summary));
            } catch (error) {
              console.warn('⚠️ Redis cache write failed:', error);
            }
          }
        } catch (error: any) {
          console.error(`❌ Failed to generate summary for ${playlist.id}:`, error.message);
          return res.status(500).json({
            success: false,
            error: `Playlist summarization failed: ${error.message}`,
            model: model || 'google/gemini-2.5-flash'
          });
        }
      }

      // Combine playlist details with summary
      finalResults.push({
        id: playlist.id,
        name: playlist.name,
        owner: playlist.owner,
        description: playlist.description,
        followers: playlist.followers,
        trackCount: playlist.trackCount,
        images: playlist.images,
        uniqueArtists: playlist.uniqueArtists,
        summary: summary.summary,
        alignmentLevel: summary.alignmentLevel,
        characteristics: summary.characteristics,
        matchScore: summary.matchScore,
        reasoning: summary.reasoning
      });
    }

    // Sort by match score (highest first)
    finalResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    console.log(`✅ Full workflow complete: ${finalResults.length} enhanced playlists returned`);
    
    // Progress: Almost done - finalizing results (90-95%)
    if (musicWS && req.userId) {
      musicWS.emitToUser(req.userId, 'playlistDiscoveryProgress', {
        sessionId: sessionId || 'unknown',
        step: `Finalizing your ${finalResults.length} best matches...`,
        phase: 'summarizing',
        timestamp: Date.now(),
        itemNumber: playlistDetails.length,  // All playlists processed
        totalItems: playlistDetails.length,
        metadata: {
          finalizing: true
        }
      });
    }
    
    // Small delay to show the finalizing step
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Progress: Final complete
    if (musicWS && req.userId) {
      musicWS.emitToUser(req.userId, 'playlistDiscoveryProgress', {
        sessionId: sessionId || 'unknown',
        step: `Complete! Found ${finalResults.length} perfect playlists for you`,
        phase: 'complete',
        timestamp: Date.now()
      });
    }

    const response: any = {
      query: query.trim(),
      playlists: finalResults,
      totalSearchResults: playlists.length,
      selectedCount: selectedPlaylistIds.length,
      finalCount: finalResults.length,
      phases: {
        search: '✅ Complete',
        selection: '✅ LLM',
        details: '✅ Complete',
        summarization: '✅ Complete'
      }
    };
    
    // Cache the search results in Redis
    if (redisClient && req.userId) {
      try {
        const userId = req.userId;
        const searchHash = createHash('md5').update(`${userId}:${query.trim().toLowerCase()}:${model || 'google/gemini-2.5-flash'}`).digest('hex');
        
        // Store the complete response in Redis with 30-day TTL
        const cacheKey = `playlist:search:result:${userId}:${searchHash}`;
        await redisClient.setEx(cacheKey, 2592000, JSON.stringify(response)); // 30 days = 2592000 seconds
        
        // Add to search history sorted set
        const historyKey = `playlist:search:history:${userId}`;
        const historyMetadata = {
          searchHash,
          query: query.trim(),
          model: model || 'google/gemini-2.5-flash',
          timestamp: Date.now(),
          resultCount: finalResults.length
        };
        
        await redisClient.zAdd(historyKey, { score: Date.now(), value: JSON.stringify(historyMetadata) });
        
        console.log(`💾 Cached search results for user ${userId}, hash: ${searchHash}`);
      } catch (cacheError) {
        console.warn('⚠️ Failed to cache search results:', cacheError);
        // Don't fail the request if caching fails
      }
    }
    
    res.json(response);

  } catch (error: any) {
    console.error('❌ Error in full playlist discovery workflow:', error);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please log in again.'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete playlist discovery workflow'
    });
  }
});

/**
 * GET /api/playlist-discovery/history
 * Retrieve user's search history from Redis sorted set
 */
router.get('/history', async (req: Request & { userId?: string }, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!redisClient) {
      return res.status(503).json({
        success: false,
        error: 'Search history not available'
      });
    }

    // Get last 100 searches, newest first (ZREVRANGE)
    const historyKey = `playlist:search:history:${userId}`;
    const historyEntries = await redisClient.zRange(historyKey, 0, 99, { REV: true });
    
    const searchHistory = [];
    
    for (const entry of historyEntries) {
      try {
        const metadata = JSON.parse(entry);
        
        // Check if the cached result still exists
        const resultKey = `playlist:search:result:${userId}:${metadata.searchHash}`;
        const exists = await redisClient.exists(resultKey);
        
        searchHistory.push({
          ...metadata,
          cached: exists === 1
        });
      } catch (parseError) {
        console.warn('Failed to parse history entry:', parseError);
        // Skip malformed entries
      }
    }

    res.json({
      success: true,
      history: searchHistory
    });

  } catch (error: any) {
    console.error('❌ Error retrieving search history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve search history'
    });
  }
});

/**
 * GET /api/playlist-discovery/cached-result/:searchHash
 * Retrieve cached search result by hash
 */
router.get('/cached-result/:searchHash', async (req: Request & { userId?: string }, res: Response) => {
  try {
    const userId = req.userId;
    const { searchHash } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!redisClient) {
      return res.status(503).json({
        success: false,
        error: 'Cache not available'
      });
    }

    if (!searchHash || typeof searchHash !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid search hash'
      });
    }

    // Retrieve cached result
    const resultKey = `playlist:search:result:${userId}:${searchHash}`;
    const cachedResult = await redisClient.get(resultKey);
    
    if (!cachedResult) {
      return res.status(404).json({
        success: false,
        error: 'Search result has expired'
      });
    }

    try {
      const result = JSON.parse(cachedResult);
      res.json(result);
    } catch (parseError) {
      console.error('Failed to parse cached result:', parseError);
      return res.status(500).json({
        success: false,
        error: 'Corrupted cache data'
      });
    }

  } catch (error: any) {
    console.error('❌ Error retrieving cached result:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cached result'
    });
  }
});

export default router;