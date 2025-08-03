import { Router, Request, Response } from 'express';
import { requireValidTokens } from '../middleware/session-auth';
import { SpotifyWebAPI } from '../spotify/api';

const router = Router();

// Apply auth middleware to all routes
router.use(requireValidTokens);

/**
 * Search for playlists on Spotify
 * GET /api/playlist-search?q=search_query&limit=20&offset=0
 */
router.get('/', async (req: any, res: Response) => {
  try {
    const { q, limit = '20', offset = '0' } = req.query;

    // Validate search query
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Parse and validate limit and offset
    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 50);
    const parsedOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

    console.log(`🔍 Searching playlists: query="${q}", limit=${parsedLimit}, offset=${parsedOffset}`);

    // Get tokens from requireValidTokens middleware
    const tokens = req.tokens;
    if (!tokens) {
      throw new Error('No Spotify tokens available');
    }

    // Create Spotify API instance
    const spotifyApi = new SpotifyWebAPI(tokens, (newTokens) => {
      // Update tokens in request if refreshed
      req.tokens = newTokens;
    });

    // Perform the search
    const searchResults = await spotifyApi.searchPlaylists(q.trim(), parsedLimit, parsedOffset);

    console.log(`✅ Playlist search completed:`, {
      query: q,
      totalResults: searchResults.playlists?.total || 0,
      returnedItems: searchResults.playlists?.items?.length || 0,
      hasNext: !!searchResults.playlists?.next,
      hasPrevious: !!searchResults.playlists?.previous
    });

    // Log interesting findings about playlist descriptions
    if (searchResults.playlists?.items?.length > 0) {
      const descriptionsInfo = searchResults.playlists.items
        .filter((playlist: any) => playlist != null)  // Filter out null/undefined items
        .map((playlist: any) => ({
          name: playlist?.name || 'Unknown',
          descriptionLength: playlist?.description?.length || 0,
          hasDescription: !!playlist?.description,
          owner: playlist?.owner?.display_name || 'Unknown'
        }));

      console.log('📝 Playlist descriptions analysis:', {
        totalPlaylists: descriptionsInfo.length,
        withDescriptions: descriptionsInfo.filter((p: any) => p.hasDescription).length,
        avgDescriptionLength: Math.round(
          descriptionsInfo.reduce((sum: number, p: any) => sum + p.descriptionLength, 0) / descriptionsInfo.length
        ),
        longestDescription: Math.max(...descriptionsInfo.map((p: any) => p.descriptionLength))
      });
    }

    // Return the raw Spotify response
    res.json(searchResults);

  } catch (error: any) {
    console.error('❌ Error searching playlists:', error);
    
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
      error: error.message || 'Failed to search playlists'
    });
  }
});

/**
 * Get detailed information about a specific playlist
 * GET /api/playlist-search/:playlistId
 */
router.get('/:playlistId', async (req: any, res: Response) => {
  try {
    const { playlistId } = req.params;

    if (!playlistId) {
      return res.status(400).json({
        success: false,
        error: 'Playlist ID is required'
      });
    }

    console.log(`📋 Fetching playlist details: ${playlistId}`);

    // Get tokens from requireValidTokens middleware
    const tokens = req.tokens;
    if (!tokens) {
      throw new Error('No Spotify tokens available');
    }

    // Create Spotify API instance
    const spotifyApi = new SpotifyWebAPI(tokens, (newTokens) => {
      req.tokens = newTokens;
    });

    // Get playlist details
    const playlist = await spotifyApi.getPlaylist(playlistId);

    console.log(`✅ Playlist details fetched:`, {
      id: playlist.id,
      name: playlist.name,
      owner: playlist.owner?.display_name,
      tracks: playlist.tracks?.total,
      descriptionLength: playlist.description?.length || 0,
      public: playlist.public,
      collaborative: playlist.collaborative
    });

    res.json(playlist);

  } catch (error: any) {
    console.error('❌ Error fetching playlist details:', error);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Playlist not found'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch playlist details'
    });
  }
});

export default router;