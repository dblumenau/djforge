// Temporary compatibility layer during auth system migration
// This provides the old API interface using the new auth system

import { authService } from '../services/auth.service';
import { spotifyClient } from '../services/spotify-client';

// Legacy API compatibility functions
export const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // For server endpoints, use the new server request method
  if (url.startsWith('/api')) {
    return spotifyClient.serverRequest(url.replace('/api', ''), options);
  }
  
  // For direct Spotify API calls, use the new spotify request method
  if (url.includes('api.spotify.com')) {
    const endpoint = url.replace('https://api.spotify.com/v1', '');
    return spotifyClient.spotifyRequest(endpoint, options);
  }
  
  // For other URLs, use the server request method with session ID
  const sessionId = authService.getSessionId();
  if (!sessionId) {
    throw new Error('No active session');
  }
  
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'X-Session-ID': sessionId,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
};

// Legacy api object compatibility
export const api = {
  get: (url: string) => authenticatedFetch(url),
  post: (url: string, data?: any) => authenticatedFetch(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined
  }),
  put: (url: string, data?: any) => authenticatedFetch(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined
  }),
  delete: (url: string) => authenticatedFetch(url, { method: 'DELETE' }),
  
  // Legacy feedback method compatibility
  recordFeedback: async (trackUri: string, feedback: string) => {
    return authenticatedFetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ trackUri, feedback })
    });
  },
  
  // Legacy AI feedback dashboard method
  getAIFeedbackDashboard: async () => {
    return authenticatedFetch('/api/feedback/dashboard');
  }
};

// Legacy auth status function
export const getAuthStatus = () => {
  return {
    isAuthenticated: authService.isAuthenticated(),
    sessionId: authService.getSessionId()
  };
};

// Legacy temp auth utils for backward compatibility
export const tempAuthUtils = {
  isAuthenticated: () => authService.isAuthenticated(),
  getToken: () => authService.getSessionId(),
  logout: () => authService.logout(),
  getUserId: () => 'temp_user_id' // TODO: Get from session
};