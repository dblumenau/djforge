import { Router } from 'express';
import { RedisUtils } from '../utils/redis-utils';

export const sessionManagementRouter = Router();

// Add Redis utils instance (will be set when Redis is available)
let redisUtils: RedisUtils | null = null;

export function setRedisUtils(utils: RedisUtils | null) {
  redisUtils = utils;
}

// Get session statistics
sessionManagementRouter.get('/stats', async (req, res) => {
  if (!redisUtils) {
    return res.json({
      error: 'Redis not available',
      sessionStore: 'file-based',
      message: 'Session statistics only available with Redis storage'
    });
  }

  try {
    const sessionCount = await redisUtils.getSessionCount();
    const memoryUsage = await redisUtils.getMemoryUsage();
    
    res.json({
      sessionStore: 'redis',
      sessionCount,
      memoryUsage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get session statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all active sessions (admin endpoint)
sessionManagementRouter.get('/sessions', async (req, res) => {
  if (!redisUtils) {
    return res.status(503).json({
      error: 'Redis not available',
      message: 'Session management only available with Redis storage'
    });
  }

  try {
    const sessions = await redisUtils.getAllSessions();
    
    // Sanitize session data for security
    const sanitizedSessions = sessions.map(session => ({
      id: session.id,
      expires: session.expires,
      hasSpotifyTokens: !!session.data.spotifyTokens,
      lastAccess: session.data.cookie?.lastAccess || null,
      userAgent: session.data.userAgent || null
    }));
    
    res.json({
      sessions: sanitizedSessions,
      total: sessions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete specific session (admin endpoint)
sessionManagementRouter.delete('/sessions/:sessionId', async (req, res) => {
  if (!redisUtils) {
    return res.status(503).json({
      error: 'Redis not available',
      message: 'Session management only available with Redis storage'
    });
  }

  const { sessionId } = req.params;
  
  if (!sessionId) {
    return res.status(400).json({
      error: 'Session ID is required'
    });
  }

  try {
    const deleted = await redisUtils.deleteSession(sessionId);
    
    if (deleted) {
      res.json({
        success: true,
        message: `Session ${sessionId} deleted successfully`
      });
    } else {
      res.status(404).json({
        error: 'Session not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clean expired sessions manually
sessionManagementRouter.post('/cleanup', async (req, res) => {
  if (!redisUtils) {
    return res.status(503).json({
      error: 'Redis not available',
      message: 'Session cleanup only available with Redis storage'
    });
  }

  try {
    const deletedCount = await redisUtils.cleanExpiredSessions();
    
    res.json({
      success: true,
      deletedSessions: deletedCount,
      message: `Cleaned up ${deletedCount} expired sessions`
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to cleanup sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get Redis general information
sessionManagementRouter.get('/redis-info', async (req, res) => {
  if (!redisUtils) {
    return res.status(503).json({
      error: 'Redis not available'
    });
  }

  try {
    const info = await redisUtils.getRedisInfo();
    
    res.json({
      redis: info,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get Redis info',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});