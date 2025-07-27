import * as Sentry from '@sentry/react';

interface JWTPayload {
  sub?: string; // Spotify user ID
  spotify_user_id?: string; // Alternative field
  email?: string;
  display_name?: string;
  exp?: number;
}

/**
 * Decode a JWT token to extract the payload
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Set Sentry user context from JWT token
 */
export function setSentryUserContext(jwtToken: string | null) {
  if (!jwtToken) {
    Sentry.setUser(null);
    return;
  }
  
  const payload = decodeJWT(jwtToken);
  if (!payload) {
    return;
  }
  
  const userId = payload.sub || payload.spotify_user_id;
  if (userId) {
    Sentry.setUser({
      id: userId,
      email: payload.email,
      username: payload.display_name,
    });
    
    // Add custom context
    Sentry.setContext('spotify', {
      user_id: userId,
      token_exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
    });
  }
}

/**
 * Clear Sentry user context (for logout)
 */
export function clearSentryUserContext() {
  Sentry.setUser(null);
  Sentry.setContext('spotify', null);
}