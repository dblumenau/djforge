import { Router } from 'express';
import { ensureValidToken } from '../spotify/auth';
import { SpotifyControl } from '../spotify/control';
import { LLMLoggingService } from '../services/llm-logging.service';

export const llmLogsRouter = Router();

// Helper function to check if user is admin
const isAdmin = (spotifyUserId: string): boolean => {
  const adminId = process.env.ADMIN_SPOTIFY_ID || '';
  return spotifyUserId === adminId;
};

// Admin middleware
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    // Ensure we have valid Spotify tokens
    if (!req.spotifyTokens) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Create SpotifyControl instance
    const spotifyControl = new SpotifyControl(
      req.spotifyTokens,
      (tokens) => { req.spotifyTokens = tokens; }
    );
    
    // Get user profile
    const profile = await spotifyControl.getUserProfile();
    
    // Check if user is admin
    if (!isAdmin(profile.id)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Attach profile to request for later use
    req.userProfile = profile;
    next();
  } catch (error: any) {
    console.error('Admin authentication failed:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Initialize LLM logging service with Redis
let loggingService: LLMLoggingService | null = null;

export function setRedisClientForLogs(client: Redis) {
  loggingService = new LLMLoggingService(client);
  console.log('✅ LLM logging service initialized');
}

// Get recent logs
llmLogsRouter.get('/api/llm-logs/recent', ensureValidToken, requireAdmin, async (req, res) => {
  try {
    if (!loggingService) {
      return res.status(500).json({ error: 'Logging service not initialized' });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await loggingService.getLogs({
      limit,
      offset
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Failed to get recent logs:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// Search logs
llmLogsRouter.get('/api/llm-logs/search', ensureValidToken, requireAdmin, async (req, res) => {
  try {
    if (!loggingService) {
      return res.status(500).json({ error: 'Logging service not initialized' });
    }

    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const logs = await loggingService.searchLogs(query);
    
    res.json({
      logs,
      pagination: {
        page: 1,
        limit: logs.length,
        total: logs.length
      }
    });
  } catch (error: any) {
    console.error('Failed to search logs:', error);
    res.status(500).json({ error: 'Failed to search logs' });
  }
});

// Get logs by date
llmLogsRouter.get('/api/llm-logs/by-date', ensureValidToken, requireAdmin, async (req, res) => {
  try {
    if (!loggingService) {
      return res.status(500).json({ error: 'Logging service not initialized' });
    }

    const date = req.query.date as string;
    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }
    
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    
    const result = await loggingService.getLogs({
      startDate,
      endDate,
      limit: parseInt(req.query.limit as string) || 100
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Failed to get logs by date:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// Get logs by flow type
llmLogsRouter.get('/api/llm-logs/by-flow/:flow', ensureValidToken, requireAdmin, async (req, res) => {
  try {
    if (!loggingService) {
      return res.status(500).json({ error: 'Logging service not initialized' });
    }

    const flow = req.params.flow as 'openrouter' | 'gemini-direct';
    if (!['openrouter', 'gemini-direct'].includes(flow)) {
      return res.status(400).json({ error: 'Invalid flow type' });
    }
    
    const logs = await loggingService.getLogsByFlow(flow);
    
    res.json({
      logs,
      pagination: {
        page: 1,
        limit: logs.length,
        total: logs.length
      }
    });
  } catch (error: any) {
    console.error('Failed to get logs by flow:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// Get logs by provider
llmLogsRouter.get('/api/llm-logs/by-provider/:provider', ensureValidToken, requireAdmin, async (req, res) => {
  try {
    if (!loggingService) {
      return res.status(500).json({ error: 'Logging service not initialized' });
    }

    const provider = req.params.provider;
    const logs = await loggingService.getLogsByProvider(provider);
    
    res.json({
      logs,
      pagination: {
        page: 1,
        limit: logs.length,
        total: logs.length
      }
    });
  } catch (error: any) {
    console.error('Failed to get logs by provider:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// Get usage statistics
llmLogsRouter.get('/api/llm-logs/stats', ensureValidToken, requireAdmin, async (req, res) => {
  try {
    if (!loggingService) {
      return res.status(500).json({ error: 'Logging service not initialized' });
    }

    // Get stats for the last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const result = await loggingService.getLogs({
      startDate,
      endDate,
      limit: 10000 // Get all logs for stats calculation
    });
    
    // Calculate additional statistics
    const flowDistribution: Record<string, number> = {};
    const providerDistribution: Record<string, number> = {};
    const intentDistribution: Record<string, number> = {};
    const errorRate = result.logs.filter(log => !log.result.success).length / result.logs.length;
    
    result.logs.forEach(log => {
      // Flow distribution
      const flow = log.llmRequest.flow || 'unknown';
      flowDistribution[flow] = (flowDistribution[flow] || 0) + 1;
      
      // Provider distribution
      const provider = log.llmRequest.provider || 'unknown';
      providerDistribution[provider] = (providerDistribution[provider] || 0) + 1;
      
      // Intent distribution
      const intent = (log.interpretation as any)?.intent || 'unknown';
      intentDistribution[intent] = (intentDistribution[intent] || 0) + 1;
    });
    
    res.json({
      ...result.stats,
      flowDistribution,
      providerDistribution,
      intentDistribution,
      errorRate: Math.round(errorRate * 1000) / 10, // Percentage with 1 decimal
      periodDays: 30
    });
  } catch (error: any) {
    console.error('Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// Get logs for current user (non-admin)
llmLogsRouter.get('/api/llm-logs/my-logs', ensureValidToken, async (req, res) => {
  try {
    if (!loggingService) {
      return res.status(500).json({ error: 'Logging service not initialized' });
    }

    // Get user profile
    const spotifyControl = new SpotifyControl(
      req.spotifyTokens!,
      (tokens) => { req.spotifyTokens = tokens; }
    );
    const profile = await spotifyControl.getUserProfile();
    
    // Get logs for this user only
    const logs = await loggingService.getLogsByUser(profile.id);
    
    res.json({
      logs: logs.slice(0, 50), // Limit to last 50 for non-admins
      pagination: {
        page: 1,
        limit: 50,
        total: logs.length
      }
    });
  } catch (error: any) {
    console.error('Failed to get user logs:', error);
    res.status(500).json({ error: 'Failed to retrieve your logs' });
  }
});

export default llmLogsRouter;