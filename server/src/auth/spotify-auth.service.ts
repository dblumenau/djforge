import axios from 'axios';
import crypto from 'crypto';
import { SessionManager, Session } from './session-manager';

const REQUIRED_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-library-modify',
  'user-read-recently-played',
  'user-top-read'
];

export class SpotifyAuthService {
  private sessionManager: SessionManager;
  private redis: any;
  
  constructor(redisClient: any) {
    this.redis = redisClient;
    this.sessionManager = new SessionManager(redisClient);
  }
  
  // OAuth flow initiation
  generateAuthUrl(): { url: string; state: string } {
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    // Store PKCE verifier in Redis (5 min TTL)
    this.redis.setEx(`auth:state:${state}`, 300, codeVerifier);
    
    const params = new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      response_type: 'code',
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      scope: REQUIRED_SCOPES.join(' '),
      state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge
    });
    
    return {
      url: `https://accounts.spotify.com/authorize?${params}`,
      state
    };
  }
  
  // Handle OAuth callback
  async handleCallback(code: string, state: string): Promise<{
    session: Session;
    accessToken: string;
    expiresIn: number;
  }> {
    console.log('🔄 Auth service handleCallback called:', { code: code.substring(0, 10) + '...', state });
    
    // Retrieve and validate PKCE verifier
    const codeVerifier = await this.redis.get(`auth:state:${state}`);
    console.log('🔐 Code verifier lookup:', { found: !!codeVerifier, state });
    
    if (!codeVerifier) {
      console.error('❌ No code verifier found for state:', state);
      throw new Error('Invalid state parameter');
    }
    
    // Exchange code for tokens
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        code_verifier: codeVerifier
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    
    const tokens = response.data;
    
    // Get user profile
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    
    const userId = userResponse.data.id;
    
    // Create session
    const session = await this.sessionManager.createSession(userId, tokens);
    
    // Clean up
    await this.redis.del(`auth:state:${state}`);
    
    return {
      session,
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in
    };
  }
  
  // Refresh access token
  async refreshAccessToken(sessionId: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const lockKey = `session:${sessionId}:refresh-lock`;
    
    // Try to acquire lock
    const lock = await this.redis.set(lockKey, '1', 'NX', 'EX', 10);
    if (!lock) {
      // Another refresh in progress, wait and then check if tokens were refreshed
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if the other process already refreshed the tokens
      const tokens = await this.sessionManager.getTokens(sessionId);
      if (!tokens) {
        throw new Error('Session not found');
      }
      
      // If tokens are still valid, return them
      if (tokens.expires_at > Date.now() + 300000) {
        return {
          accessToken: tokens.access_token,
          expiresIn: Math.floor((tokens.expires_at - Date.now()) / 1000)
        };
      }
      
      // Otherwise, try again
      return this.refreshAccessToken(sessionId);
    }
    
    try {
      const tokens = await this.sessionManager.getTokens(sessionId);
      if (!tokens) {
        throw new Error('Session not found');
      }
      
      // Check if token is still valid (5 min buffer)
      const now = Date.now();
      const expiresAt = tokens.expires_at;
      const bufferTime = now + 300000; // 5 minutes from now
      
      console.log('🕒 Token expiry check:', {
        now: new Date(now),
        expiresAt: new Date(expiresAt),
        bufferTime: new Date(bufferTime),
        isValid: expiresAt > bufferTime,
        timeUntilExpiry: Math.floor((expiresAt - now) / 1000 / 60) + ' minutes'
      });
      
      if (expiresAt > bufferTime) {
        console.log('✅ Token still valid, returning existing token');
        return {
          accessToken: tokens.access_token,
          expiresIn: Math.floor((expiresAt - now) / 1000)
        };
      }
      
      // Refresh the token
      console.log('🔄 Token needs refresh, calling Spotify...');
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: process.env.SPOTIFY_CLIENT_ID!
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );
      
      const newTokens = response.data;
      
      // Update stored tokens
      await this.sessionManager.updateTokens(sessionId, newTokens);
      
      return {
        accessToken: newTokens.access_token,
        expiresIn: newTokens.expires_in
      };
    } catch (error: any) {
      if (error.response?.data?.error === 'invalid_grant') {
        // Don't immediately destroy session - Spotify can return invalid_grant for temporary issues
        // Log the error and let the caller decide what to do
        console.error(`⚠️ Token refresh failed with invalid_grant for session ${sessionId}:`, error.response?.data);
        
        // Only destroy session after multiple consecutive failures or specific error descriptions
        const errorDescription = error.response?.data?.error_description;
        if (errorDescription && (
          errorDescription.includes('revoked') || 
          errorDescription.includes('expired') ||
          errorDescription.includes('invalid')
        )) {
          console.log(`🗑️ Destroying session ${sessionId} due to permanent token issue: ${errorDescription}`);
          await this.sessionManager.destroySession(sessionId);
          throw new Error('Authentication expired. Please log in again.');
        }
        
        // For temporary invalid_grant errors, don't destroy session - just throw error
        throw new Error('Token refresh temporarily failed. Please try again.');
      }
      throw error;
    } finally {
      await this.redis.del(lockKey);
    }
  }
  
  // Logout - clean up session and associated resources
  async logout(sessionId: string): Promise<void> {
    await this.sessionManager.destroySession(sessionId);
    // Clean up any refresh locks that might exist
    await this.redis.del(`session:${sessionId}:refresh-lock`);
  }
}