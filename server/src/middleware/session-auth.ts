import { Request, Response, NextFunction } from 'express';
import { SessionManager } from '../auth/session-manager';
import { SpotifyAuthService } from '../auth/spotify-auth.service';

// Global variable for Redis client - will be set by server.ts
let redisClient: any = null;

export function setRedisClient(client: any) {
  redisClient = client;
}

// For routes that need valid tokens (server-side Spotify calls)
export async function requireValidTokens(
  req: Request & { tokens?: any, userId?: string },
  res: Response,
  next: NextFunction
) {
  try {
    if (!redisClient) {
      console.error('❌ Redis client not initialized in middleware');
      return res.status(503).json({ 
        error: 'Service temporarily unavailable - Redis connection failed',
        requiresReauth: false 
      });
    }
    
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      console.error('❌ No session ID provided');
      return res.status(401).json({ error: 'No session provided' });
    }
    
    const sessionManager = new SessionManager(redisClient);
    const session = await sessionManager.getSession(sessionId);
    
    if (!session) {
      console.error('❌ Session not found in Redis');
      return res.status(401).json({ 
        error: 'Session not found',
        requiresReauth: true 
      });
    }
    
    // Get tokens first and check if refresh is needed
    const tokens = await sessionManager.getTokens(sessionId);
    if (!tokens) {
      return res.status(401).json({ 
        error: 'No tokens found',
        requiresReauth: true 
      });
    }

    // Check if token is still valid (5 min buffer) - same logic as in SpotifyAuthService
    const now = Date.now();
    const expiresAt = tokens.expires_at;
    const bufferTime = now + 300000; // 5 minutes from now

    let accessToken = tokens.access_token;

    // Only refresh if actually needed
    if (expiresAt <= bufferTime) {
      console.log('🔄 Token expired or expiring soon, refreshing...');
      const authService = new SpotifyAuthService(redisClient);
      const refreshResult = await authService.refreshAccessToken(sessionId);
      accessToken = refreshResult.accessToken;
    }

    req.tokens = {
      access_token: accessToken,
      refresh_token: tokens.refresh_token
    };
    req.userId = session.userId;
    
    next();
  } catch (error: any) {
    if (error.message.includes('expired')) {
      return res.status(401).json({ 
        error: 'Authentication expired',
        requiresReauth: true 
      });
    }
    console.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// For routes that only need session validation (no Spotify calls)
export async function requireSession(
  req: Request & { userId?: string },
  res: Response,
  next: NextFunction
) {
  try {
    if (!redisClient) {
      console.error('❌ Redis client not initialized in session middleware');
      return res.status(503).json({ 
        error: 'Service temporarily unavailable - Redis connection failed',
        requiresReauth: false 
      });
    }
    
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'No session provided' });
    }
    
    const sessionManager = new SessionManager(redisClient);
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(401).json({ 
        error: 'Session not found',
        requiresReauth: true 
      });
    }
    
    // Sessions are now permanent - no expiry check needed
    
    req.userId = session.userId;
    next();
  } catch (error) {
    console.error('Session middleware error:', error);
    res.status(500).json({ error: 'Session validation failed' });
  }
}