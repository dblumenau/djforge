import * as Sentry from '@sentry/react';
// WARNING: Using temporary auth bypass during auth system refactor
import { tempAuthUtils } from './temp-auth';

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
 * WARNING: JWT system disabled during auth system refactor
 */
export function setSentryUserContext(jwtToken: string | null) {
  console.warn('WARNING: Sentry user context disabled during auth system refactor');
  
  // Use temp auth utils instead of JWT during refactor
  const tempUserId = tempAuthUtils.getUserId();
  if (tempUserId && tempUserId !== 'temp_user_id') {
    Sentry.setUser({
      id: tempUserId,
      email: 'temp@example.com',
      username: 'temp_user',
    });
    
    Sentry.setContext('spotify', {
      user_id: tempUserId,
      auth_status: 'temp_bypass',
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Clear Sentry user context (for logout)
 */
export function clearSentryUserContext() {
  Sentry.setUser(null);
  Sentry.setContext('spotify', null);
}