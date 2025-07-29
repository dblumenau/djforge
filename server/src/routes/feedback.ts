import { Router } from 'express';
import { requireValidTokens } from '../middleware/session-auth';
import { SpotifyControl } from '../spotify/control';
import { UserDataService } from '../services/UserDataService';
// TODO: Replace with new auth system
import { AIDiscoveredTrack } from '../types';

export const feedbackRouter = Router();

// Shared Redis client instance
let redisClient: any = null;

export function setRedisClient(client: any) {
  redisClient = client;
  console.log('✅ Redis client initialized for feedback routes');
}

// Helper to get user ID from session
function getUserIdFromSession(req: any): string | null {
  return req.userId || null; // Provided by requireValidTokens middleware
}

// Record AI discovery feedback
feedbackRouter.post('/ai-discovery', requireValidTokens, async (req: any, res) => {
  try {
    const { trackUri, feedback } = req.body;
    
    if (!trackUri || !feedback) {
      return res.status(400).json({ error: 'Missing trackUri or feedback' });
    }
    
    if (!['loved', 'disliked', 'remove'].includes(feedback)) {
      return res.status(400).json({ error: 'Invalid feedback value' });
    }
    
    const userId = getUserIdFromSession(req);
    if (!userId || !redisClient) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const spotifyControl = new SpotifyControl(
      req.tokens!,
      (tokens) => { req.tokens = tokens; }
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
feedbackRouter.get('/ai-discoveries', requireValidTokens, async (req: any, res) => {
  try {
    const userId = getUserIdFromSession(req);
    if (!userId || !redisClient) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const spotifyControl = new SpotifyControl(
      req.tokens!,
      (tokens) => { req.tokens = tokens; }
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
feedbackRouter.get('/dashboard', requireValidTokens, async (req: any, res) => {
  try {
    const userId = getUserIdFromSession(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID not found' });
    }

    const spotifyControl = new SpotifyControl(
      req.tokens!,
      (tokens) => { req.tokens = tokens; }
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