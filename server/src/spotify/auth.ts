import { Router } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { SpotifyAuthTokens } from '../types';
import { verifyJWT, extractTokenFromHeader } from '../utils/jwt';

export const authRouter = Router();

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:5173';

// Generate random string for state
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// PKCE helper functions
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

// Spotify scopes we need
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read',
  'user-library-modify',
  'user-read-recently-played',
  'user-top-read'
].join(' ');

// Initiate OAuth flow
authRouter.get('/login', (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  // Store code verifier in session for local dev fallback
  req.session.codeVerifier = codeVerifier;
  
  // For production, encode codeVerifier in state parameter
  const stateData = {
    random: generateRandomString(16), // For CSRF protection
    codeVerifier: codeVerifier
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');
  
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    scope: SCOPES,
    state: state, // Include state parameter
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });
  
  res.redirect(`${SPOTIFY_AUTH_URL}?${params.toString()}`);
});

// Handle OAuth callback
authRouter.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.redirect(`${CLIENT_URL}/?error=${error}`);
  }
  
  if (!code || typeof code !== 'string') {
    return res.redirect(`${CLIENT_URL}/?error=no_code`);
  }
  
  const codeVerifier = req.session.codeVerifier;
  if (!codeVerifier) {
    return res.redirect(`${CLIENT_URL}/?error=no_verifier`);
  }
  
  try {
    const response = await axios.post(
      SPOTIFY_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        code_verifier: codeVerifier
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const tokens: SpotifyAuthTokens = response.data;
    req.session.spotifyTokens = tokens;
    req.session.tokenTimestamp = Date.now();
    
    // Get user profile to get the Spotify user ID
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });
    
    const spotifyUserId = userResponse.data.id;
    
    // Generate JWT token
    const { generateJWT } = require('../utils/jwt');
    const jwtToken = generateJWT(tokens, spotifyUserId);
    
    // Clear the code verifier
    delete req.session.codeVerifier;
    
    // Redirect with JWT token
    res.redirect(`${CLIENT_URL}/callback?success=true&token=${encodeURIComponent(jwtToken)}`);
  } catch (error) {
    console.error('Token exchange error:', error);
    res.redirect(`${CLIENT_URL}/?error=token_exchange_failed`);
  }
});

// Middleware to check and refresh token if needed (now uses JWT)
export async function ensureValidToken(req: any, res: any, next: any) {
  // Try JWT first, then fallback to session for backwards compatibility
  const authHeader = req.headers.authorization;
  const jwtToken = extractTokenFromHeader(authHeader);
  
  let tokens: SpotifyAuthTokens | null = null;
  let tokenTimestamp = 0;
  
  if (jwtToken) {
    // JWT-based authentication
    const payload = verifyJWT(jwtToken);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid JWT token' });
    }
    tokens = payload.spotifyTokens;
    tokenTimestamp = payload.tokenTimestamp;
  } else if (req.session.spotifyTokens) {
    // Fallback to session-based auth (for local dev)
    tokens = req.session.spotifyTokens;
    tokenTimestamp = req.session.tokenTimestamp || 0;
  } else {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const tokenAge = Date.now() - tokenTimestamp;
  const expiresIn = tokens.expires_in * 1000; // Convert to milliseconds
  
  // Refresh if token is older than 50 minutes (leaving 10 min buffer)
  if (tokenAge > expiresIn - 600000) {
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      // CRITICAL: Always use the new refresh_token if Spotify provides one
      const refreshedTokens = {
        ...tokens,
        ...newTokens,
        // Explicitly ensure refresh_token is updated if present in response
        refresh_token: newTokens.refresh_token || tokens.refresh_token
      };
      
      if (jwtToken) {
        // For JWT auth, we can't refresh in place - client needs to get new JWT
        // BUT we must use the refreshed tokens with the NEW refresh_token
        req.spotifyTokens = refreshedTokens; // Use refreshed tokens, not old ones!
        
        // CRITICAL: Tell client to refresh their JWT!
        res.setHeader('X-Token-Refreshed', 'true');
        console.log('🚨 Token refreshed - client needs new JWT');
      } else {
        // Session-based: update session
        req.session.spotifyTokens = refreshedTokens;
        req.session.tokenTimestamp = Date.now();
        req.spotifyTokens = refreshedTokens;
      }
      console.log('Token refreshed successfully');
    } catch (error: any) {
      console.error('Token refresh failed:', error.response?.data || error.message || 'Unknown error');
      return res.status(401).json({ error: 'Token refresh failed' });
    }
  } else {
    req.spotifyTokens = tokens;
  }
  
  next();
}

// Check authentication status (supports both JWT and session)
authRouter.get('/status', (req, res) => {
  // Try JWT first
  const authHeader = req.headers.authorization;
  const jwtToken = extractTokenFromHeader(authHeader);
  
  let tokens: SpotifyAuthTokens | null = null;
  let tokenTimestamp = 0;
  
  if (jwtToken) {
    // JWT-based authentication
    const payload = verifyJWT(jwtToken);
    if (payload) {
      tokens = payload.spotifyTokens;
      tokenTimestamp = payload.tokenTimestamp;
      console.log('Auth status check - JWT token valid');
    } else {
      console.log('Auth status check - JWT token invalid');
    }
  } else if (req.session.spotifyTokens) {
    // Fallback to session-based auth
    tokens = req.session.spotifyTokens;
    tokenTimestamp = req.session.tokenTimestamp || 0;
    console.log('Auth status check - Session ID:', req.sessionID);
    console.log('Has tokens:', !!tokens);
  } else {
    console.log('Auth status check - No JWT or session tokens');
  }
  
  const isAuthenticated = !!tokens?.access_token;
  
  if (isAuthenticated && tokens && tokenTimestamp) {
    // Calculate if token is expired (Spotify tokens last 1 hour)
    const tokenAge = Date.now() - tokenTimestamp;
    const expiresIn = (tokens.expires_in || 3600) * 1000; // Convert to ms
    const isExpired = tokenAge >= expiresIn;
    
    // User is authenticated if tokens are valid or if we can potentially refresh them
    const effectivelyAuthenticated = isAuthenticated && !isExpired;
    
    // User is authenticated if they have a valid JWT/session, regardless of Spotify token expiry
    // This allows the client to attempt refresh without forcing re-login
    const hasValidAuth = !!tokens?.refresh_token; // Valid if we have refresh capability
    
    res.json({ 
      authenticated: hasValidAuth, // True as long as we have refresh capability
      tokenExpired: isExpired,
      hasRefreshToken: !!tokens.refresh_token,
      accessToken: effectivelyAuthenticated ? tokens.access_token : null
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Refresh tokens and generate new JWT
authRouter.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const jwtToken = extractTokenFromHeader(authHeader);
    
    if (!jwtToken) {
      return res.status(401).json({ error: 'No JWT token provided' });
    }
    
    const payload = verifyJWT(jwtToken);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid JWT token' });
    }
    
    const { spotifyTokens } = payload;
    
    if (!spotifyTokens.refresh_token) {
      return res.status(401).json({ error: 'No refresh token available' });
    }
    
    // Refresh the Spotify tokens
    const newTokens = await refreshAccessToken(spotifyTokens.refresh_token);
    // CRITICAL: Always use the new refresh_token if Spotify provides one
    const refreshedTokens = {
      ...spotifyTokens,
      ...newTokens,
      // Explicitly ensure refresh_token is updated if present in response
      refresh_token: newTokens.refresh_token || spotifyTokens.refresh_token
    };
    
    // Generate new JWT with refreshed tokens
    const { generateJWT } = require('../utils/jwt');
    const newJwtToken = generateJWT(refreshedTokens, payload.spotify_user_id);
    
    res.json({ 
      success: true, 
      newJwtToken,
      accessToken: refreshedTokens.access_token
    });
    
  } catch (error: any) {
    console.error('Token refresh error:', error.response?.data || error.message || 'Unknown error');
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// DEBUG endpoints (development only)
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  // Test automatic refresh by simulating expired tokens
  authRouter.post('/debug/simulate-expired', (req, res) => {
    const authHeader = req.headers.authorization;
    const jwtToken = extractTokenFromHeader(authHeader);
    
    if (!jwtToken) {
      return res.status(401).json({ error: 'No JWT token provided' });
    }
    
    const payload = verifyJWT(jwtToken);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid JWT token' });
    }
    
    // Just modify the timestamp to simulate expiry WITHOUT hitting Spotify API
    const jwt = require('jsonwebtoken');
    const { getJWTSecret } = require('../utils/jwt');
    
    const simulatedPayload = {
      sub: payload.spotify_user_id,
      spotify_user_id: payload.spotify_user_id,
      spotifyTokens: payload.spotifyTokens, // Keep existing tokens
      tokenTimestamp: Date.now() - (61 * 60 * 1000) // 61 minutes ago (just past 1 hour expiry)
    };
    
    const simulatedToken = jwt.sign(simulatedPayload, getJWTSecret(), { expiresIn: '30d' });
    
    console.log('Debug: Simulated expired tokens for user:', payload.spotify_user_id);
    
    res.json({ 
      success: true, 
      simulatedToken,
      message: 'Created JWT with expired timestamp. Refresh the page to test auto-refresh.' 
    });
  });
  
  // Test what happens when refresh token is revoked
  authRouter.post('/debug/simulate-revoked', (req, res) => {
    const authHeader = req.headers.authorization;
    const jwtToken = extractTokenFromHeader(authHeader);
    
    if (!jwtToken) {
      return res.status(401).json({ error: 'No JWT token provided' });
    }
    
    const payload = verifyJWT(jwtToken);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid JWT token' });
    }
    
    // Create a JWT with fake/revoked refresh token
    const jwt = require('jsonwebtoken');
    const { getJWTSecret } = require('../utils/jwt');
    
    const revokedPayload = {
      sub: payload.spotify_user_id,
      spotify_user_id: payload.spotify_user_id,
      spotifyTokens: {
        ...payload.spotifyTokens,
        access_token: 'fake_access_token',
        refresh_token: 'REVOKED_REFRESH_TOKEN_FOR_TESTING'
      },
      tokenTimestamp: Date.now() - (61 * 60 * 1000) // Expired
    };
    
    const revokedToken = jwt.sign(revokedPayload, getJWTSecret(), { expiresIn: '30d' });
    
    res.json({ 
      success: true, 
      revokedToken,
      message: 'Created JWT with revoked refresh token to test error handling.' 
    });
  });
}

// Logout
authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

// In-memory refresh promise cache to prevent thundering herd
const refreshPromises = new Map<string, Promise<SpotifyAuthTokens>>();

// Refresh token if needed
export async function refreshAccessToken(refreshToken: string): Promise<SpotifyAuthTokens> {
  // Use first 20 chars as key (tokens are longer but this is enough for uniqueness)
  const tokenKey = refreshToken.substring(0, 20);
  
  // Check if a refresh is already in progress for this token
  const existingPromise = refreshPromises.get(tokenKey);
  if (existingPromise) {
    console.log('🔄 Reusing existing refresh request for token...');
    return existingPromise;
  }
  
  console.log('🔄 Attempting to refresh access token...');
  console.log('Refresh token:', tokenKey + '...');
  
  // Create the refresh promise and store it
  const refreshPromise = (async () => {
    try {
      const response = await axios.post(
        SPOTIFY_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.SPOTIFY_CLIENT_ID!
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      console.log('✅ Token refresh successful');
      console.log('Refresh response contains:', Object.keys(response.data));
      console.log('New refresh_token in response:', !!response.data.refresh_token);
      if (response.data.refresh_token) {
        console.log('🔄 Spotify rotated refresh token - old token now invalid');
      }
      return response.data;
    } catch (error: any) {
      console.error('❌ Token refresh failed:', error.response?.data || error.message);
      throw error;
    } finally {
      // Clean up the promise from the cache after 1 second
      // This delay prevents issues if there are follow-up requests
      setTimeout(() => {
        refreshPromises.delete(tokenKey);
      }, 1000);
    }
  })();
  
  refreshPromises.set(tokenKey, refreshPromise);
  return refreshPromise;
}