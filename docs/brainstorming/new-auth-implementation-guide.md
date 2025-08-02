# Spotify Auth System - Complete Rebuild Implementation Guide

## 🚀 Implementation Status

**✅ Phase 1 COMPLETE** - Old auth system removed  
**✅ Phase 2 COMPLETE** - New server auth system implemented  
**✅ Phase 3 COMPLETE** - Client implementation complete  
**📋 Phase 4+ PENDING** - Route updates and testing needed  

**Last Updated**: January 2025

## Overview

This guide provides step-by-step instructions for completely replacing the current JWT-based authentication system with a new Hybrid Token Handler architecture. This is a COMPLETE REPLACEMENT - all existing auth code will be removed.

## Architecture Summary

- **Server** stores all tokens in Redis
- **Client** receives only access tokens and session IDs
- **High-frequency calls** go direct from client to Spotify
- **LLM/write operations** proxy through server
- **Refresh tokens** never leave the server

## Phase 1: Complete Removal of Current Auth System

### Files to Delete Entirely

```bash
# These files will be completely removed
/server/src/spotify/auth.ts
/server/src/utils/jwt.ts
/client/src/hooks/useSpotifyAuth.ts
/client/src/utils/api.ts  # Will be replaced
```

### Code to Remove from Existing Files

1. **server.ts**
   - Remove all JWT-related imports
   - Remove JWT middleware setup
   - Remove auth route mounting

2. **All route files**
   - Remove `ensureValidToken` middleware usage
   - Remove JWT extraction code
   - Remove token refresh logic

3. **Client components**
   - Remove JWT storage in localStorage
   - Remove token refresh detection
   - Remove auth state management

---
**✅ PHASE 1 IMPLEMENTATION COMPLETE** *(January 2025)*
- All old auth files successfully deleted
- JWT dependencies removed from package.json
- Import references cleaned up
- Server and client codebases ready for new auth system
---

## Phase 2: New Server Implementation

### 2.1 New Session Management System

**File: `/server/src/auth/session-manager.ts`**
```typescript
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../config/redis';

export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export class SessionManager {
  private readonly SESSION_TTL = 48 * 60 * 60; // 48 hours
  
  async createSession(userId: string, tokens: any): Promise<Session> {
    const sessionId = uuidv4();
    const session: Session = {
      id: sessionId,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + (this.SESSION_TTL * 1000)
    };
    
    // Store session metadata
    await redis.setex(
      `session:${sessionId}:meta`,
      this.SESSION_TTL,
      JSON.stringify(session)
    );
    
    // Store tokens separately
    await redis.setex(
      `session:${sessionId}:tokens`,
      this.SESSION_TTL,
      JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in * 1000)
      })
    );
    
    // Add to user's session set
    await redis.sadd(`user:${userId}:sessions`, sessionId);
    
    return session;
  }
  
  async getSession(sessionId: string): Promise<Session | null> {
    const data = await redis.get(`session:${sessionId}:meta`);
    return data ? JSON.parse(data) : null;
  }
  
  async getTokens(sessionId: string): Promise<StoredTokens | null> {
    const data = await redis.get(`session:${sessionId}:tokens`);
    return data ? JSON.parse(data) : null;
  }
  
  async updateTokens(sessionId: string, tokens: any): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
    
    await redis.setex(
      `session:${sessionId}:tokens`,
      ttl,
      JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || (await this.getTokens(sessionId))?.refresh_token,
        expires_at: Date.now() + (tokens.expires_in * 1000)
      })
    );
  }
  
  async destroySession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;
    
    await redis.del(`session:${sessionId}:meta`);
    await redis.del(`session:${sessionId}:tokens`);
    // Note: refresh-lock cleanup handled by SpotifyAuthService
    await redis.srem(`user:${session.userId}:sessions`, sessionId);
  }
}
```

### 2.2 New Spotify Auth Service

**File: `/server/src/auth/spotify-auth.service.ts`**
```typescript
import axios from 'axios';
import crypto from 'crypto';
import { SessionManager } from './session-manager';
import { redis } from '../config/redis';

export class SpotifyAuthService {
  private sessionManager: SessionManager;
  
  constructor() {
    this.sessionManager = new SessionManager();
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
    redis.setex(`auth:state:${state}`, 300, codeVerifier);
    
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
    // Retrieve and validate PKCE verifier
    const codeVerifier = await redis.get(`auth:state:${state}`);
    if (!codeVerifier) {
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
    await redis.del(`auth:state:${state}`);
    
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
    const lock = await redis.set(lockKey, '1', 'NX', 'EX', 10);
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
      if (tokens.expires_at > Date.now() + 300000) {
        return {
          accessToken: tokens.access_token,
          expiresIn: Math.floor((tokens.expires_at - Date.now()) / 1000)
        };
      }
      
      // Refresh the token
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
        // Refresh token revoked, destroy session
        await this.sessionManager.destroySession(sessionId);
        throw new Error('Authentication expired. Please log in again.');
      }
      throw error;
    } finally {
      await redis.del(lockKey);
    }
  }
  
  // Logout - clean up session and associated resources
  async logout(sessionId: string): Promise<void> {
    await this.sessionManager.destroySession(sessionId);
    // Clean up any refresh locks that might exist
    await redis.del(`session:${sessionId}:refresh-lock`);
  }
}
```

### 2.3 New Auth Routes

**File: `/server/src/routes/auth.ts`**
```typescript
import { Router } from 'express';
import { SpotifyAuthService } from '../auth/spotify-auth.service';

const router = Router();
const authService = new SpotifyAuthService();

// Initiate OAuth flow
router.get('/login', (req, res) => {
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
    
    if (error) {
      return res.redirect(`${CLIENT_URL}/?error=${error}`);
    }
    
    const storedState = req.cookies.spotify_auth_state;
    if (!state || state !== storedState) {
      return res.redirect(`${CLIENT_URL}/?error=state_mismatch`);
    }
    
    const { session, accessToken, expiresIn } = await authService.handleCallback(
      code as string,
      state as string
    );
    
    // Clear state cookie
    res.clearCookie('spotify_auth_state');
    
    // Store initial token info in Redis temporarily (5 min TTL)
    await redis.setex(
      `auth:initial:${session.id}`,
      300,
      JSON.stringify({ accessToken, expiresIn })
    );
    
    // Redirect with only session ID (more secure)
    res.redirect(`${CLIENT_URL}/auth-success?sessionId=${session.id}`);
  } catch (error) {
    console.error('Auth callback error:', error);
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
  const sessionId = req.headers['x-session-id'] as string;
  
  if (!sessionId) {
    return res.status(401).json({ error: 'No session ID provided' });
  }
  
  // Retrieve and delete the temporary initial token
  const tokenData = await redis.get(`auth:initial:${sessionId}`);
  if (!tokenData) {
    return res.status(404).json({ error: 'Initial token not found' });
  }
  
  await redis.del(`auth:initial:${sessionId}`);
  
  const { accessToken, expiresIn } = JSON.parse(tokenData);
  res.json({
    access_token: accessToken,
    expires_in: expiresIn
  });
});

// Logout
router.post('/logout', async (req, res) => {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (sessionId) {
    await authService.logout(sessionId);
  }
  
  res.json({ success: true });
});

// Session status
router.get('/status', async (req, res) => {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (!sessionId) {
    return res.json({ authenticated: false });
  }
  
  const sessionManager = new SessionManager();
  const session = await sessionManager.getSession(sessionId);
  
  if (!session || session.expiresAt < Date.now()) {
    return res.json({ authenticated: false });
  }
  
  const tokens = await sessionManager.getTokens(sessionId);
  const tokenValid = tokens && tokens.expires_at > Date.now();
  
  res.json({
    authenticated: true,
    userId: session.userId,
    tokenValid,
    sessionExpiry: session.expiresAt
  });
});

export default router;
```

### 2.4 New Middleware for Protected Routes

**File: `/server/src/middleware/session-auth.ts`**
```typescript
import { Request, Response, NextFunction } from 'express';
import { SessionManager } from '../auth/session-manager';
import { SpotifyAuthService } from '../auth/spotify-auth.service';

const sessionManager = new SessionManager();
const authService = new SpotifyAuthService();

// For routes that need valid tokens (server-side Spotify calls)
export async function requireValidTokens(
  req: Request & { tokens?: any, userId?: string },
  res: Response,
  next: NextFunction
) {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'No session provided' });
    }
    
    const session = await sessionManager.getSession(sessionId);
    if (!session || session.expiresAt < Date.now()) {
      return res.status(401).json({ 
        error: 'Session expired',
        requiresReauth: true 
      });
    }
    
    // Get current tokens (this handles refresh if needed)
    const { accessToken } = await authService.refreshAccessToken(sessionId);
    const tokens = await sessionManager.getTokens(sessionId);
    
    req.tokens = {
      access_token: accessToken,
      refresh_token: tokens!.refresh_token
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
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// For routes that only need session validation (no Spotify calls)
export async function requireSession(
  req: Request & { userId?: string },
  res: Response,
  next: NextFunction
) {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (!sessionId) {
    return res.status(401).json({ error: 'No session provided' });
  }
  
  const session = await sessionManager.getSession(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ 
      error: 'Session expired',
      requiresReauth: true 
    });
  }
  
  req.userId = session.userId;
  next();
}
```

---
**✅ PHASE 2 IMPLEMENTATION COMPLETE** *(January 2025)*
- Session management system with Redis storage ✅
- PKCE OAuth 2.0 flow with refresh token management ✅  
- New auth routes mounted at `/api/auth` ✅
- Session validation middleware for protected routes ✅
- Server integration complete and ready for client ✅
---

## Phase 3: New Client Implementation

### 3.1 New Auth Service

**File: `/client/src/services/auth.service.ts`**
```typescript
export class AuthService {
  private sessionId: string | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private refreshPromise: Promise<string> | null = null;
  
  constructor() {
    this.loadFromStorage();
  }
  
  private loadFromStorage() {
    this.sessionId = localStorage.getItem('spotify_session_id');
    this.accessToken = localStorage.getItem('spotify_access_token');
    const expiry = localStorage.getItem('spotify_token_expiry');
    this.tokenExpiry = expiry ? parseInt(expiry) : 0;
  }
  
  private saveToStorage() {
    if (this.sessionId) {
      localStorage.setItem('spotify_session_id', this.sessionId);
    }
    if (this.accessToken) {
      localStorage.setItem('spotify_access_token', this.accessToken);
      localStorage.setItem('spotify_token_expiry', this.tokenExpiry.toString());
    }
  }
  
  // Handle auth callback - now fetches token securely
  async handleAuthCallback(params: URLSearchParams) {
    const sessionId = params.get('sessionId');
    
    if (!sessionId) {
      throw new Error('Invalid auth callback parameters');
    }
    
    this.sessionId = sessionId;
    this.saveToStorage();
    
    // Fetch the initial token from the server
    const response = await fetch('/api/auth/initial-token', {
      headers: {
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to retrieve initial token');
    }
    
    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    this.saveToStorage();
  }
  
  // Get current session ID
  getSessionId(): string | null {
    return this.sessionId;
  }
  
  // Get valid access token (refreshes if needed)
  async getAccessToken(): Promise<string> {
    // Check if token is still valid (5 min buffer)
    if (this.accessToken && this.tokenExpiry > Date.now() + 300000) {
      return this.accessToken;
    }
    
    // If a refresh is already in progress, return its promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    // If no session, we can't refresh
    if (!this.sessionId) {
      throw new Error('No active session');
    }
    
    // Start a new refresh process
    this.refreshPromise = this.performRefresh();
    
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      // Clear the promise once it's resolved or rejected
      this.refreshPromise = null;
    }
  }
  
  private async performRefresh(): Promise<string> {
    if (!this.sessionId) throw new Error('No session ID to perform refresh');
    
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'X-Session-ID': this.sessionId,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (error.requiresReauth) {
        this.logout();
        window.location.href = '/landing';
      }
      throw new Error('Token refresh failed');
    }
    
    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    this.saveToStorage();
    
    return this.accessToken;
  }
  
  // Check if authenticated
  isAuthenticated(): boolean {
    return !!this.sessionId;
  }
  
  // Logout
  logout() {
    localStorage.removeItem('spotify_session_id');
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expiry');
    
    this.sessionId = null;
    this.accessToken = null;
    this.tokenExpiry = 0;
  }
}

export const authService = new AuthService();
```

### 3.2 New Spotify API Client

**File: `/client/src/services/spotify-client.ts`**
```typescript
import { authService } from './auth.service';

export class SpotifyClient {
  // Direct Spotify API call (for high-frequency endpoints)
  async spotifyRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await authService.getAccessToken();
    
    try {
      const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (response.status === 401) {
        // Token expired, force refresh and retry
        const newToken = await authService.getAccessToken();
        
        // Retry with new token
        return fetch(`https://api.spotify.com/v1${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        });
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }
  
  // Server API call (for proxied endpoints)
  async serverRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const sessionId = authService.getSessionId();
    
    if (!sessionId) {
      throw new Error('No active session');
    }
    
    return fetch(`/api${endpoint}`, {
      ...options,
      headers: {
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }
  
  // High-frequency direct calls
  async getCurrentPlayback() {
    const response = await this.spotifyRequest('/me/player');
    return response.status === 204 ? null : response.json();
  }
  
  async getDevices() {
    const response = await this.spotifyRequest('/me/player/devices');
    return response.json();
  }
  
  async getQueue() {
    const response = await this.spotifyRequest('/me/player/queue');
    return response.json();
  }
  
  // Server-proxied calls
  async sendCommand(command: string) {
    const response = await this.serverRequest('/llm/command', {
      method: 'POST',
      body: JSON.stringify({ command })
    });
    return response.json();
  }
  
  async play() {
    const response = await this.serverRequest('/control/play', {
      method: 'POST'
    });
    return response.json();
  }
  
  async pause() {
    const response = await this.serverRequest('/control/pause', {
      method: 'POST'
    });
    return response.json();
  }
  
  async queueTrack(uri: string) {
    const response = await this.serverRequest('/control/queue', {
      method: 'POST',
      body: JSON.stringify({ uri })
    });
    return response.json();
  }
}

export const spotifyClient = new SpotifyClient();
```

### 3.3 Updated React Hook

**File: `/client/src/hooks/useAuth.ts`**
```typescript
import { useState, useEffect } from 'react';
import { authService } from '../services/auth.service';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    checkAuthStatus();
  }, []);
  
  const checkAuthStatus = async () => {
    try {
      const sessionId = authService.getSessionId();
      if (!sessionId) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/auth/status', {
        headers: {
          'X-Session-ID': sessionId
        }
      });
      
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      console.error('Auth status check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };
  
  const login = () => {
    window.location.href = '/api/auth/login';
  };
  
  const logout = async () => {
    const sessionId = authService.getSessionId();
    if (sessionId) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId
        }
      });
    }
    
    authService.logout();
    setIsAuthenticated(false);
    window.location.href = '/landing';
  };
  
  return {
    isAuthenticated,
    loading,
    login,
    logout
  };
}
```

---
**✅ PHASE 3 IMPLEMENTATION COMPLETE** *(January 2025)*
- Session-based AuthService with secure token management ✅
- Hybrid SpotifyClient supporting direct and proxied API calls ✅  
- New useAuth hook for React component integration ✅
- AuthSuccess component for OAuth callback processing ✅
- Updated App.tsx with `/auth-success` route ✅
- Core components migrated to new auth system ✅
- Backward compatibility layer for gradual migration ✅
- Web Player temporarily disabled pending auth integration ✅
---

## Phase 4: Update Route Handlers

### 4.1 Example: Updated Control Routes

**File: `/server/src/routes/control.ts`**
```typescript
import { Router } from 'express';
import { requireValidTokens } from '../middleware/session-auth';
import { SpotifyWebAPI } from '../spotify/api';

const router = Router();

// All control routes need valid tokens
router.use(requireValidTokens);

// Play
router.post('/play', async (req: any, res) => {
  try {
    const spotifyApi = new SpotifyWebAPI(req.tokens);
    await spotifyApi.play(req.body.deviceId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Queue
router.post('/queue', async (req: any, res) => {
  try {
    const { uri } = req.body;
    const spotifyApi = new SpotifyWebAPI(req.tokens);
    await spotifyApi.addToQueue(uri);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 4.2 Example: Updated LLM Routes

**File: `/server/src/routes/llm.ts`**
```typescript
import { Router } from 'express';
import { requireValidTokens } from '../middleware/session-auth';
import { SpotifyControl } from '../spotify/control';

const router = Router();

router.post('/command', requireValidTokens, async (req: any, res) => {
  try {
    const { command } = req.body;
    
    // Create SpotifyControl with server-side tokens
    const spotifyControl = new SpotifyControl(req.tokens);
    
    // Process LLM command
    const result = await processLLMCommand(command, spotifyControl, req.userId);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

## Phase 5: Migration Steps

### 5.1 Server Migration Order

1. **Install new dependencies**
   ```bash
   npm install uuid
   npm uninstall jsonwebtoken
   ```

2. **Create new auth files**
   - `/server/src/auth/session-manager.ts`
   - `/server/src/auth/spotify-auth.service.ts`
   - `/server/src/middleware/session-auth.ts`
   - `/server/src/routes/auth.ts`

3. **Update server.ts**
   ```typescript
   // Remove
   import { authRouter } from './spotify/auth';
   
   // Add
   import authRouter from './routes/auth';
   
   // Update route mounting
   app.use('/api/auth', authRouter);
   ```

4. **Update each route file**
   - Replace `ensureValidToken` with `requireValidTokens` or `requireSession`
   - Update token access from `req.spotifyTokens` to `req.tokens`
   - Add session ID headers to all endpoints

5. **Update SpotifyWebAPI class**
   - Remove token refresh logic (now handled by auth service)
   - Simplify to just make API calls with provided tokens

### 5.2 Client Migration Order

1. **Create new service files**
   - `/client/src/services/auth.service.ts`
   - `/client/src/services/spotify-client.ts`

2. **Update hooks**
   - Replace `useSpotifyAuth` with `useAuth`
   - Update all components using auth

3. **Update API calls**
   - High-frequency: Use `spotifyClient.spotifyRequest()`
   - Others: Use `spotifyClient.serverRequest()`

4. **Update auth callback handling**
   - Create new `/auth-success` route
   - Handle session ID param and fetch initial token
   - Store auth data securely

## Phase 6: Testing Plan

### 6.1 Auth Flow Tests
1. Login flow with PKCE
2. Token refresh with lock
3. Session expiry handling
4. Logout cleanup

### 6.2 API Call Tests
1. Direct client calls (playback state)
2. Server proxy calls (LLM commands)
3. Concurrent refresh handling
4. 401 retry logic

### 6.3 Edge Case Tests
1. Multiple tabs/devices
2. Spotify token revocation
3. Redis connection loss
4. High-frequency polling

## Phase 7: Deployment Considerations

### 7.1 Environment Variables
```env
# Remove
JWT_SECRET=xxx

# Keep/Add
SPOTIFY_CLIENT_ID=xxx
SPOTIFY_CLIENT_SECRET=xxx
SPOTIFY_REDIRECT_URI=http://127.0.0.1:4001/callback
REDIS_URL=redis://xxx
```

### 7.2 Redis Keys to Clear
```bash
# Clear all old JWT-related keys
redis-cli --scan --pattern "user:*:jwt:*" | xargs redis-cli del
redis-cli --scan --pattern "token:*" | xargs redis-cli del
```

### 7.3 User Migration
- All users will need to re-authenticate
- Clear announcement about the auth system upgrade
- Monitor for any issues during rollout

## Implementation Checklist

- [x] **Phase 1: Remove all current auth code** ✅ **COMPLETED**
  - Deleted `/server/src/spotify/auth.ts`
  - Deleted `/server/src/utils/jwt.ts`
  - Deleted `/client/src/hooks/useSpotifyAuth.ts`
  - Deleted `/client/src/utils/api.ts`
  - Removed JWT-related imports and middleware
  - Removed jsonwebtoken dependency
  
- [x] **Phase 2: Implement new server auth system** ✅ **COMPLETED**
  - Created `/server/src/auth/session-manager.ts` - Redis-based session management
  - Created `/server/src/auth/spotify-auth.service.ts` - PKCE OAuth 2.0 flow
  - Created `/server/src/routes/auth.ts` - New auth endpoints
  - Created `/server/src/middleware/session-auth.ts` - Session validation middleware
  - Updated `server.ts` to mount `/api/auth` routes
  - Added uuid dependency, removed jsonwebtoken
  
- [x] **Phase 3: Implement new client auth system** ✅ **COMPLETED**
  - Created `/client/src/services/auth.service.ts` - Session-based auth service
  - Created `/client/src/services/spotify-client.ts` - Hybrid API client (direct + proxied)
  - Created `/client/src/hooks/useAuth.ts` - New authentication hook
  - Created `/client/src/components/AuthSuccess.tsx` - OAuth callback handler
  - Updated `/client/src/App.tsx` - Added `/auth-success` route
  - Updated core components (`AppLayout`, `MainApp`, `MobileMenu`) to use new auth
  - Created `/client/src/utils/temp-auth.ts` - Backward compatibility layer
  - Temporarily disabled Web Player components pending auth integration

- [x] **Phase 4: Update all route handlers** ✅ **COMPLETED** *(January 2025)*
  - Updated `/server/src/routes/direct-action.ts` - Replaced `tempAuthMiddleware` with `requireValidTokens`
  - Updated `/server/src/routes/llm-interpreter.ts` - Migrated to session-based token handling
  - Updated `/server/src/routes/simple-llm-interpreter.ts` - All endpoints now use new auth middleware
  - Updated `/server/src/routes/user-data.ts` - Replaced temp auth with session-based approach
  - Updated `/server/src/routes/feedback.ts` - User ID now extracted from session middleware
  - Updated `/server/src/routes/model-preferences.ts` - All routes migrated to new auth system
  - Updated `/server/src/routes/llm-logs.ts` - Admin middleware now works with session tokens
  - Updated `/server/src/routes/debug-token.ts` - Test endpoints updated for new auth
  - Updated `/server/src/routes/song-verification.ts` - Token handling modernized
  - **Key Changes Made**:
    - All `req.spotifyTokens` references replaced with `req.tokens`
    - All user ID extraction now uses `req.userId` from middleware
    - Removed all `tempAuthMiddleware` imports and usage
    - Updated `ConversationManager.getUserIdFromRequest()` for session-based auth
    - Fixed `sentry-auth.ts` middleware to work with new session system
    - Cleaned up legacy JWT imports from removed auth files
    - Updated `spotify/api.ts` to remove dependency on deleted `auth.ts`
    - Fixed all TypeScript compilation errors related to Request type extensions
  - **Verification**: All routes now use `requireValidTokens` middleware ✅
  - **Compilation**: TypeScript compilation passes without errors ✅

- [ ] Phase 5: Execute migration steps
- [ ] Phase 6: Complete testing
- [ ] Phase 7: Deploy with proper monitoring

## Notes for Implementing Agent

1. **Start Fresh**: Delete ALL existing auth code first. Don't try to migrate piece by piece.

2. **Test Early**: After implementing the core auth service, test the login flow before updating all routes.

3. **Session Security**: Ensure session IDs are cryptographically secure UUIDs.

4. **Error Messages**: Provide clear error messages that distinguish between expired sessions and revoked tokens.

5. **Monitoring**: Add logging for all auth operations to debug issues.

6. **Gradual Rollout**: Consider feature flag for switching between old and new auth during transition.

This guide provides a complete blueprint for rebuilding the auth system from scratch. The implementing agent should follow these phases in order and test thoroughly at each step.