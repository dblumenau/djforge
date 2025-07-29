import { Router, Request, Response } from 'express';
import { requireValidTokens } from '../middleware/session-auth';
import { SpotifyWebAPI } from '../spotify/api';
import { UserDataService } from '../services/UserDataService';
import { TimeRange } from '../types/spotify-data';
import { createRedisClient } from '../config/redis';
// JWT imports removed during auth refactor - no longer needed

const router = Router();

// Apply auth middleware to all routes
router.use(requireValidTokens);

// Helper to get UserDataService instance with new session-auth middleware
async function getUserDataService(req: any): Promise<UserDataService> {
  // Get tokens from requireValidTokens middleware
  const tokens = req.tokens;
  if (!tokens) {
    throw new Error('No Spotify tokens available');
  }
  
  const spotifyApi = new SpotifyWebAPI(tokens, (newTokens) => {
    // Update tokens in request
    req.tokens = newTokens;
  });
  
  // Get user ID from session middleware
  const finalUserId = req.userId;
  
  // Get Redis client
  const redis = await createRedisClient();
  await redis.connect();
  
  return new UserDataService(redis, spotifyApi, finalUserId);
}

// Get all dashboard data
router.get('/dashboard', async (req: any, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    console.log(`📊 Dashboard endpoint called - forceRefresh: ${forceRefresh}`);
    
    const startTime = Date.now();
    const userDataService = await getUserDataService(req);
    console.log(`⏱️ UserDataService initialized in ${Date.now() - startTime}ms`);
    
    console.log('🔄 Fetching all dashboard data...');
    const fetchStart = Date.now();
    const dashboardData = await userDataService.getAllDashboardData(forceRefresh);
    const fetchTime = Date.now() - fetchStart;
    
    console.log(`✅ Dashboard data fetched in ${fetchTime}ms`, {
      forceRefresh,
      profile: dashboardData.profile?.display_name,
      topArtists: {
        short: dashboardData.topArtists.short_term.length,
        medium: dashboardData.topArtists.medium_term.length,
        long: dashboardData.topArtists.long_term.length
      },
      topTracks: {
        short: dashboardData.topTracks.short_term.length,
        medium: dashboardData.topTracks.medium_term.length,
        long: dashboardData.topTracks.long_term.length
      },
      savedTracks: dashboardData.savedTracks.total,
      savedAlbums: dashboardData.savedAlbums.total,
      recentlyPlayed: dashboardData.recentlyPlayed.length,
      playlists: dashboardData.playlists.length,
      totalTime: `${Date.now() - startTime}ms`
    });
    
    res.json({
      success: true,
      data: dashboardData,
      cached: !forceRefresh
    });
  } catch (error: any) {
    console.error('❌ Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch dashboard data'
    });
  }
});

// Get user profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const userDataService = await getUserDataService(req);
    
    const profile = await userDataService.getUserProfile(forceRefresh);
    
    res.json({
      success: true,
      data: profile,
      cached: !forceRefresh
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user profile'
    });
  }
});

// Get top artists
router.get('/top-artists', async (req: Request, res: Response) => {
  try {
    const timeRange = (req.query.timeRange as TimeRange) || 'medium_term';
    const forceRefresh = req.query.refresh === 'true';
    const userDataService = await getUserDataService(req);
    
    const artists = await userDataService.getTopArtists(timeRange, forceRefresh);
    
    res.json({
      success: true,
      data: artists,
      timeRange,
      cached: !forceRefresh
    });
  } catch (error: any) {
    console.error('Error fetching top artists:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch top artists'
    });
  }
});

// Get top tracks
router.get('/top-tracks', async (req: Request, res: Response) => {
  try {
    const timeRange = (req.query.timeRange as TimeRange) || 'medium_term';
    const forceRefresh = req.query.refresh === 'true';
    const userDataService = await getUserDataService(req);
    
    const tracks = await userDataService.getTopTracks(timeRange, forceRefresh);
    
    res.json({
      success: true,
      data: tracks,
      timeRange,
      cached: !forceRefresh
    });
  } catch (error: any) {
    console.error('Error fetching top tracks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch top tracks'
    });
  }
});

// Get saved tracks
router.get('/saved-tracks', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const forceRefresh = req.query.refresh === 'true';
    const userDataService = await getUserDataService(req);
    
    const tracks = await userDataService.getSavedTracks(limit, offset, forceRefresh);
    
    res.json({
      success: true,
      data: tracks,
      cached: !forceRefresh
    });
  } catch (error: any) {
    console.error('Error fetching saved tracks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch saved tracks'
    });
  }
});

// Get saved albums
router.get('/saved-albums', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const forceRefresh = req.query.refresh === 'true';
    const userDataService = await getUserDataService(req);
    
    const albums = await userDataService.getSavedAlbums(limit, offset, forceRefresh);
    
    res.json({
      success: true,
      data: albums,
      cached: !forceRefresh
    });
  } catch (error: any) {
    console.error('Error fetching saved albums:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch saved albums'
    });
  }
});

// Get recently played
router.get('/recently-played', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const userDataService = await getUserDataService(req);
    
    const tracks = await userDataService.getRecentlyPlayed(forceRefresh);
    
    res.json({
      success: true,
      data: tracks,
      cached: !forceRefresh
    });
  } catch (error: any) {
    console.error('Error fetching recently played:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch recently played tracks'
    });
  }
});

// Get playlists
router.get('/playlists', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const userDataService = await getUserDataService(req);
    
    const playlists = await userDataService.getPlaylists(forceRefresh);
    
    res.json({
      success: true,
      data: playlists,
      cached: !forceRefresh
    });
  } catch (error: any) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch playlists'
    });
  }
});

// Force refresh all cached data
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const userDataService = await getUserDataService(req);
    
    // Clear cache first
    await userDataService.clearCache();
    
    // Fetch fresh data
    const dashboardData = await userDataService.getAllDashboardData(true);
    
    res.json({
      success: true,
      message: 'Cache cleared and data refreshed',
      data: dashboardData
    });
  } catch (error: any) {
    console.error('Error refreshing data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to refresh data'
    });
  }
});

// Get taste profile endpoint
router.get('/taste-profile', async (req: Request, res: Response) => {
  try {
    const userDataService = await getUserDataService(req);
    // Allow optional context type via query parameter
    const contextType = req.query.context as 'specific' | 'discovery' | 'conversational' | 'control' | 'info' | undefined;
    const tasteProfile = await userDataService.generateTasteProfile(contextType);
    
    res.json({
      success: true,
      profile: tasteProfile,
      contextType: contextType || 'general',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching taste profile:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch taste profile'
    });
  }
});

// Save tracks to library
router.put('/saved-tracks', async (req: any, res: Response) => {
  try {
    const { trackIds } = req.body;
    
    if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'trackIds array is required'
      });
    }
    
    // Get tokens from requireValidTokens middleware
    const tokens = req.tokens;
    if (!tokens) {
      throw new Error('No Spotify tokens found');
    }
    
    const api = new SpotifyWebAPI(tokens, (newTokens) => {
      // Update tokens in request
      req.tokens = newTokens;
    });
    
    await api.saveTracksToLibrary(trackIds);
    
    res.json({
      success: true,
      message: `Added ${trackIds.length} track${trackIds.length > 1 ? 's' : ''} to your library`
    });
  } catch (error: any) {
    console.error('Error saving tracks to library:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save tracks to library'
    });
  }
});

// Remove tracks from library
router.delete('/saved-tracks', async (req: any, res: Response) => {
  try {
    const { trackIds } = req.body;
    
    if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'trackIds array is required'
      });
    }
    
    // Get tokens from requireValidTokens middleware
    const tokens = req.tokens;
    if (!tokens) {
      throw new Error('No Spotify tokens found');
    }
    
    const api = new SpotifyWebAPI(tokens, (newTokens) => {
      // Update tokens in request
      req.tokens = newTokens;
    });
    
    await api.removeTracksFromLibrary(trackIds);
    
    res.json({
      success: true,
      message: `Removed ${trackIds.length} track${trackIds.length > 1 ? 's' : ''} from your library`
    });
  } catch (error: any) {
    console.error('Error removing tracks from library:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove tracks from library'
    });
  }
});

// Check if tracks are saved
router.get('/saved-tracks/contains', async (req: any, res: Response) => {
  try {
    const { ids } = req.query;
    
    if (!ids || typeof ids !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ids query parameter is required'
      });
    }
    
    const trackIds = ids.split(',').filter(id => id.trim());
    
    if (trackIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid track IDs provided'
      });
    }
    
    // Get tokens from requireValidTokens middleware
    const tokens = req.tokens;
    if (!tokens) {
      throw new Error('No Spotify tokens found');
    }
    
    const api = new SpotifyWebAPI(tokens, (newTokens) => {
      // Update tokens in request
      req.tokens = newTokens;
    });
    
    const savedStatus = await api.checkIfTracksSaved(trackIds);
    
    res.json({
      success: true,
      savedStatus // Array of booleans matching the order of trackIds
    });
  } catch (error: any) {
    console.error('Error checking saved tracks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check saved tracks'
    });
  }
});

export default router;