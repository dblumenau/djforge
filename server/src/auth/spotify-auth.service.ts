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
  private refreshPromises: Map<string, Promise<{ accessToken: string; expiresIn: number }>>;
  
  constructor(redisClient: any) {
    this.redis = redisClient;
    this.sessionManager = new SessionManager(redisClient);
    this.refreshPromises = new Map();
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
  async refreshAccessToken(sessionId: string, retryCount: number = 0): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    // Check if there's already a refresh in progress for this session
    const existingPromise = this.refreshPromises.get(sessionId);
    if (existingPromise) {
      console.log('🔒 Reusing existing refresh promise for session:', sessionId);
      return existingPromise;
    }
    
    // Create a new refresh promise
    const refreshPromise = this._performTokenRefresh(sessionId, retryCount);
    
    // Store it for deduplication
    this.refreshPromises.set(sessionId, refreshPromise);
    
    // Clean up after completion (success or failure)
    refreshPromise.finally(() => {
      this.refreshPromises.delete(sessionId);
    });
    
    return refreshPromise;
  }
  
  private async _performTokenRefresh(sessionId: string, retryCount: number = 0): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    let tokens: any;
    try {
      tokens = await this.sessionManager.getTokens(sessionId);
      if (!tokens) {
        throw new Error('Session not found');
      }
      
      // Check if token is still valid (5 min buffer)
      const now = Date.now();
      const expiresAt = tokens.expires_at;
      const bufferTime = now + 300000; // 5 minutes from now
      
      if (expiresAt > bufferTime) {
        return {
          accessToken: tokens.access_token,
          expiresIn: Math.floor((expiresAt - now) / 1000)
        };
      }
      
      // Refresh the token
      if (retryCount > 0) {
        console.log(`🔄 Token refresh retry attempt ${retryCount + 1}/6, calling Spotify...`);
      } else {
        console.log('🔄 Token needs refresh, calling Spotify...');
      }
      
      // Create Basic Auth header with client credentials
      const clientId = process.env.SPOTIFY_CLIENT_ID!;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      
      const requestBody = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token
      });
      
      const requestHeaders = { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      };
      
      // Uncomment for debugging token refresh issues
      // console.log('📤 Sending refresh request to Spotify:', {
      //   url: 'https://accounts.spotify.com/api/token',
      //   method: 'POST',
      //   headers: {
      //     ...requestHeaders,
      //     'Authorization': `Basic ${basicAuth.substring(0, 10)}...` // Truncate for security
      //   },
      //   body: requestBody.toString(),
      //   refreshTokenPreview: tokens.refresh_token.substring(0, 20) + '...'
      // });
      
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        requestBody,
        { headers: requestHeaders }
      );
      
      // Uncomment for debugging token refresh issues
      // console.log('📥 Spotify refresh response:', {
      //   status: response.status,
      //   statusText: response.statusText,
      //   headers: response.headers,
      //   data: {
      //     access_token: response.data.access_token ? response.data.access_token.substring(0, 20) + '...' : 'none',
      //     token_type: response.data.token_type,
      //     scope: response.data.scope,
      //     expires_in: response.data.expires_in,
      //     refresh_token: response.data.refresh_token ? response.data.refresh_token.substring(0, 20) + '...' : 'none (reusing existing)'
      //   }
      // });
      
      const newTokens = response.data;
      
      // Update stored tokens
      await this.sessionManager.updateTokens(sessionId, newTokens);
      
      return {
        accessToken: newTokens.access_token,
        expiresIn: newTokens.expires_in
      };
    } catch (error: any) {
      // Enhanced logging for debugging token refresh failures
      const errorData = error.response?.data;
      const errorStatus = error.response?.status;
      const errorDescription = errorData?.error_description;
      
      console.error('❌ Token refresh failed:', {
        sessionId,
        timestamp: new Date().toISOString(),
        error: {
          type: errorData?.error || 'unknown',
          description: errorDescription,
          status: errorStatus,
          statusText: error.response?.statusText,
        },
        request: {
          url: error.config?.url,
          method: error.config?.method,
          refreshTokenLength: tokens?.refresh_token?.length,
          refreshTokenPreview: tokens?.refresh_token ? 
            `${tokens.refresh_token.substring(0, 10)}...${tokens.refresh_token.slice(-10)}` : 
            'missing',
        },
        response: {
          status: errorStatus,
          statusText: error.response?.statusText,
          headers: {
            'request-id': error.response?.headers?.['request-id'],
            'sp-trace-id': error.response?.headers?.['sp-trace-id'],
            'x-envoy-upstream-service-time': error.response?.headers?.['x-envoy-upstream-service-time'],
          },
          data: errorData
        },
        message: error.message
      });
      
      // Handle Spotify 500 errors specifically with retry logic
      if (errorStatus === 500 && errorData?.error === 'server_error') {
        console.error('🔥 Spotify API returned 500 Internal Server Error');
        
        // Check if it's the specific "Failed to remove token" error
        if (errorDescription === 'Failed to remove token') {
          console.error('⚠️ Spotify failed to remove token during refresh. This is a Spotify-side issue.');
          console.error('💡 Possible causes:');
          console.error('  1. Spotify internal service issue');
          console.error('  2. Token already removed/invalidated on Spotify side');
          console.error('  3. Race condition in Spotify\'s token management');
          console.error('  4. Database consistency issue on Spotify\'s end');
          
          // Implement retry with exponential backoff
          const maxRetries = 6;
          if (retryCount < maxRetries) {
            const delayMs = Math.min(1000 * Math.pow(2, retryCount), 16000); // 1s, 2s, 4s, 8s, 16s, 16s
            console.log(`🔁 Retrying token refresh in ${delayMs}ms (attempt ${retryCount + 1}/${maxRetries})...`);
            
            // Wait with exponential backoff
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
            // Retry the refresh (will create a new promise)
            return this._performTokenRefresh(sessionId, retryCount + 1);
          }
          
          // Max retries reached
          console.error(`❌ Token refresh failed after ${maxRetries} attempts`);
          throw new Error('Spotify service error during token refresh. Maximum retries exceeded.');
        }
        
        // Generic 500 error - also retry
        if (retryCount < 6) {
          const delayMs = Math.min(1000 * Math.pow(2, retryCount), 16000);
          console.log(`🔁 Retrying after Spotify 500 error in ${delayMs}ms (attempt ${retryCount + 1}/6)...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return this._performTokenRefresh(sessionId, retryCount + 1);
        }
        
        throw new Error('Spotify service temporarily unavailable. Please try again later.');
      }
      
      // Handle invalid_grant errors
      if (errorData?.error === 'invalid_grant') {
        console.error(`⚠️ Token refresh failed with invalid_grant for session ${sessionId}`);
        console.error(`  Error description: ${errorDescription}`);
        
        // Only destroy session for clearly permanent issues
        if (errorDescription && (
          errorDescription.includes('revoked') || 
          errorDescription.includes('expired') ||
          errorDescription.includes('invalid')
        )) {
          console.log(`🗑️ Destroying session ${sessionId} due to permanent token issue: ${errorDescription}`);
          await this.sessionManager.destroySession(sessionId);
          throw new Error('Authentication expired. Please log in again.');
        }
        
        // For temporary invalid_grant errors, don't destroy session
        throw new Error('Token refresh temporarily failed. Please try again.');
      }
      
      // Log any other unexpected errors
      console.error('🔍 Unexpected error during token refresh:', {
        errorCode: errorData?.error,
        errorDescription: errorDescription,
        httpStatus: errorStatus
      });
      
      throw error;
    }
  }
  
  // Logout - clean up session and associated resources
  async logout(sessionId: string): Promise<void> {
    await this.sessionManager.destroySession(sessionId);
    // Clean up any refresh locks that might exist
    await this.redis.del(`session:${sessionId}:refresh-lock`);
  }
}