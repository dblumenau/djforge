import { Router } from 'express';
import { SpotifyAuthService } from '../auth/spotify-auth.service';

const router = Router();

// Global variable for Redis client - will be set by server.ts
let redisClient: any = null;

export function setRedisClient(client: any) {
  console.log('🔧 Auth routes: Redis client being set', client ? 'Successfully' : 'With null!');
  redisClient = client;
}

function getAuthService() {
  if (!redisClient) {
    console.error('❌ Auth route called but Redis client not initialized yet!');
    throw new Error('Redis client not initialized. This usually happens after server restart. Please try again in a moment.');
  }
  console.log('✅ Auth service created with Redis client');
  return new SpotifyAuthService(redisClient);
}

// Initiate OAuth flow
router.get('/login', (req, res) => {
  const authService = getAuthService();
  const { url, state } = authService.generateAuthUrl();
  res.cookie('spotify_auth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300000 // 5 minutes
  });
  res.redirect(url);
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:5173';
    
    console.log('🔄 Auth callback received:', { code: code ? 'present' : 'missing', state: state ? 'present' : 'missing', error });
    
    if (error) {
      console.error('❌ Spotify OAuth error:', error);
      return res.redirect(`${CLIENT_URL}/?error=${error}`);
    }
    
    if (!code) {
      console.error('❌ No authorization code received');
      return res.redirect(`${CLIENT_URL}/?error=no_code`);
    }
    
    const storedState = req.cookies.spotify_auth_state;
    console.log('🔐 State validation:', { received: state, stored: storedState });
    
    if (!state || state !== storedState) {
      console.error('❌ State mismatch or missing');
      return res.redirect(`${CLIENT_URL}/?error=state_mismatch`);
    }
    
    console.log('✅ State validation passed, calling auth service...');
    const authService = getAuthService();
    const { session, accessToken, expiresIn } = await authService.handleCallback(
      code as string,
      state as string
    );
    
    console.log('✅ Auth service completed, session created:', session.id);
    
    // Clear state cookie
    res.clearCookie('spotify_auth_state');
    
    // Store initial token info in Redis temporarily (5 min TTL)
    await redisClient.setEx(
      `auth:initial:${session.id}`,
      300,
      JSON.stringify({ accessToken, expiresIn })
    );
    
    console.log('✅ Initial token stored, redirecting to client');
    
    // Redirect with only session ID (more secure)
    res.redirect(`${CLIENT_URL}/auth-success?sessionId=${session.id}`);
  } catch (error) {
    console.error('❌ Auth callback error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:5173';
    res.redirect(`${CLIENT_URL}/?error=auth_failed`);
  }
});

// Refresh endpoint
router.post('/refresh', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'No session ID provided' });
    }
    
    const authService = getAuthService();
    const { accessToken, expiresIn } = await authService.refreshAccessToken(sessionId);
    
    res.json({
      access_token: accessToken,
      expires_in: expiresIn
    });
  } catch (error: any) {
    if (error.message.includes('expired')) {
      return res.status(401).json({ 
        error: 'Session expired',
        requiresReauth: true 
      });
    }
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Get initial token (called immediately after auth callback)
router.get('/initial-token', async (req, res) => {
  console.log('🔄 Initial token request received:', req.headers['x-session-id']);
  
  const sessionId = req.headers['x-session-id'] as string;
  
  if (!sessionId) {
    console.error('❌ No session ID in initial token request');
    return res.status(401).json({ error: 'No session ID provided' });
  }
  
  console.log('🔍 Looking up initial token for session:', sessionId);
  
  // Retrieve and delete the temporary initial token
  const tokenData = await redisClient.get(`auth:initial:${sessionId}`);
  console.log('📋 Initial token data found:', !!tokenData);
  
  if (!tokenData) {
    console.error('❌ Initial token not found for session:', sessionId);
    return res.status(404).json({ error: 'Initial token not found' });
  }
  
  console.log('🗑️ Deleting temporary initial token');
  await redisClient.del(`auth:initial:${sessionId}`);
  
  const { accessToken, expiresIn } = JSON.parse(tokenData);
  console.log('✅ Returning initial token, expires in:', expiresIn);
  
  res.json({
    access_token: accessToken,
    expires_in: expiresIn
  });
});

// Logout
router.post('/logout', async (req, res) => {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (sessionId) {
    const authService = getAuthService();
    await authService.logout(sessionId);
  }
  
  res.json({ success: true });
});

// Session status
router.get('/status', async (req, res) => {
  const sessionId = req.headers['x-session-id'] as string;
  console.log('🔍 Auth status check for session:', sessionId);
  console.log('🔍 Redis client status:', redisClient ? 'Available' : 'NOT AVAILABLE');
  
  if (!sessionId) {
    console.log('❌ No session ID provided');
    return res.json({ authenticated: false });
  }
  
  try {
    // Check if Redis client is available
    if (!redisClient) {
      console.error('❌ Redis client not initialized for auth status check');
      console.error('❌ This happens when the server just restarted and Redis client hasn\'t been set yet');
      // Return a 503 Service Unavailable to indicate temporary issue
      return res.status(503).json({ 
        authenticated: false, 
        error: 'Service temporarily unavailable', 
        retry: true 
      });
    }
    
    // Create a direct session manager instance for this check
    const { SessionManager } = require('../auth/session-manager');
    const sm = new SessionManager(redisClient);
    
    console.log('🔍 Looking up session in Redis...');
    const session = await sm.getSession(sessionId);
    
    console.log('📋 Session lookup result:', session ? `Found - User: ${session.userId}` : 'Not found');
    
    if (!session) {
      console.log('❌ Session not found in Redis');
      return res.json({ authenticated: false });
    }
    
    if (session.expiresAt < Date.now()) {
      console.log('❌ Session expired:', new Date(session.expiresAt).toISOString());
      return res.json({ authenticated: false });
    }
    
    const tokens = await sm.getTokens(sessionId);
    const tokenValid = tokens && tokens.expires_at > Date.now();
    
    console.log('✅ Session valid, user:', session.userId, 'Token valid:', tokenValid);
    
    res.json({
      authenticated: true,
      userId: session.userId,
      tokenValid,
      sessionExpiry: session.expiresAt
    });
  } catch (error) {
    console.error('❌ Session status check error:', error);
    res.json({ authenticated: false });
  }
});

export default router;