import { Router } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { SpotifyAuthTokens } from '../types';

export const authRouter = Router();

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

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
  'user-library-read',
  'user-read-recently-played',
  'user-top-read'
].join(' ');

// Initiate OAuth flow
authRouter.get('/login', (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  // Store code verifier in session for later use
  req.session.codeVerifier = codeVerifier;
  
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });
  
  res.redirect(`${SPOTIFY_AUTH_URL}?${params.toString()}`);
});

// Handle OAuth callback
authRouter.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.redirect('http://localhost:5173?error=' + error);
  }
  
  if (!code || typeof code !== 'string') {
    return res.redirect('http://localhost:5173?error=no_code');
  }
  
  const codeVerifier = req.session.codeVerifier;
  if (!codeVerifier) {
    return res.redirect('http://localhost:5173?error=no_verifier');
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
    
    // Clear the code verifier
    delete req.session.codeVerifier;
    
    res.redirect('http://localhost:5173?success=true');
  } catch (error) {
    console.error('Token exchange error:', error);
    res.redirect('http://localhost:5173?error=token_exchange_failed');
  }
});

// Middleware to check and refresh token if needed
export async function ensureValidToken(req: any, res: any, next: any) {
  if (!req.session.spotifyTokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const tokens = req.session.spotifyTokens;
  const tokenAge = Date.now() - (req.session.tokenTimestamp || 0);
  const expiresIn = tokens.expires_in * 1000; // Convert to milliseconds
  
  // Refresh if token is older than 50 minutes (leaving 10 min buffer)
  if (tokenAge > expiresIn - 600000) {
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      req.session.spotifyTokens = { ...tokens, ...newTokens };
      req.session.tokenTimestamp = Date.now();
      console.log('Token refreshed successfully');
    } catch (error) {
      console.error('Token refresh failed:', error);
      return res.status(401).json({ error: 'Token refresh failed' });
    }
  }
  
  next();
}

// Check authentication status
authRouter.get('/status', (req, res) => {
  console.log('Auth status check - Session ID:', req.sessionID);
  console.log('Has tokens:', !!req.session.spotifyTokens);
  
  const tokens = req.session.spotifyTokens;
  const isAuthenticated = !!tokens?.access_token;
  
  if (isAuthenticated && req.session.tokenTimestamp) {
    // Calculate if token is expired (Spotify tokens last 1 hour)
    const tokenAge = Date.now() - req.session.tokenTimestamp;
    const expiresIn = (tokens.expires_in || 3600) * 1000; // Convert to ms
    const isExpired = tokenAge >= expiresIn;
    
    // If expired but we have a refresh token, we can still consider it authenticated
    const effectivelyAuthenticated = isAuthenticated && (!isExpired || !!tokens.refresh_token);
    
    res.json({ 
      authenticated: effectivelyAuthenticated,
      tokenExpired: isExpired,
      hasRefreshToken: !!tokens.refresh_token,
      accessToken: effectivelyAuthenticated ? tokens.access_token : null
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Logout
authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

// Refresh token if needed
export async function refreshAccessToken(refreshToken: string): Promise<SpotifyAuthTokens> {
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
  
  return response.data;
}