import { Router } from 'express';
import { ensureValidToken } from '../spotify/auth';
import { SpotifyControl } from '../spotify/control';
import { UserDataService } from '../services/UserDataService';
import { verifyJWT } from '../utils/jwt';
import { AIDiscoveredTrack } from '../types';

export const feedbackRouter = Router();

// Shared Redis client instance
let redisClient: any = null;

export function setRedisClient(client: any) {
  redisClient = client;
  console.log('✅ Redis client initialized for feedback routes');
}

// Helper to get user ID from JWT
function getUserIdFromJWT(req: any): string | null {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyJWT(token);
    return decoded?.spotify_user_id || null;
  } catch (error) {
    return null;
  }
}

// Record AI discovery feedback
feedbackRouter.post('/ai-discovery', ensureValidToken, async (req, res) => {
  try {
    const { trackUri, feedback } = req.body;
    
    if (!trackUri || !feedback) {
      return res.status(400).json({ error: 'Missing trackUri or feedback' });
    }
    
    if (!['loved', 'disliked', 'remove'].includes(feedback)) {
      return res.status(400).json({ error: 'Invalid feedback value' });
    }
    
    const userId = getUserIdFromJWT(req);
    if (!userId || !redisClient) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const spotifyControl = new SpotifyControl(
      req.spotifyTokens!,
      (tokens) => { req.spotifyTokens = tokens; }
    );
    
    const userDataService = new UserDataService(redisClient, spotifyControl.getApi(), userId);
    
    if (feedback === 'remove') {
      await userDataService.removeFeedback(trackUri);
    } else {
      await userDataService.recordFeedback(trackUri, feedback);
    }
    
    res.json({
      success: true,
      message: `Feedback recorded: ${feedback}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error recording AI feedback:', error);
    res.status(500).json({
      error: 'Failed to record feedback',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get AI discoveries with feedback
feedbackRouter.get('/ai-discoveries', ensureValidToken, async (req, res) => {
  try {
    const userId = getUserIdFromJWT(req);
    if (!userId || !redisClient) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const spotifyControl = new SpotifyControl(
      req.spotifyTokens!,
      (tokens) => { req.spotifyTokens = tokens; }
    );
    
    const userDataService = new UserDataService(redisClient, spotifyControl.getApi(), userId);
    const feedback = await userDataService.getAIFeedback();
    
    res.json({
      loved: feedback.loved,
      disliked: feedback.disliked,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting AI discoveries:', error);
    res.status(500).json({
      error: 'Failed to get AI discoveries',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/feedback/dashboard - Get all feedback data for dashboard
feedbackRouter.get('/dashboard', ensureValidToken, async (req, res) => {
  try {
    const userId = getUserIdFromJWT(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID not found' });
    }

    const spotifyControl = new SpotifyControl(
      req.spotifyTokens!,
      (tokens) => { req.spotifyTokens = tokens; }
    );

    const userDataService = new UserDataService(
      redisClient,
      spotifyControl.getApi(),
      userId
    );

    const dashboardData = await userDataService.getAIFeedbackDashboard();
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching AI feedback dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback dashboard data'
    });
  }
});