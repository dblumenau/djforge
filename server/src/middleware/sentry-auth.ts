import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';
import { verifyJWT, extractTokenFromHeader } from '../utils/jwt';

/**
 * Middleware to set Sentry user context from JWT token
 * This should be applied after authentication middleware
 */
export function setSentryUserContext(req: Request, res: Response, next: NextFunction) {
  try {
    // Try to get JWT from Authorization header
    const authHeader = req.headers.authorization;
    const jwtToken = extractTokenFromHeader(authHeader);
    
    if (jwtToken) {
      const payload = verifyJWT(jwtToken);
      if (payload && payload.sub) {
        // Set Sentry user context
        Sentry.setUser({
          id: payload.sub,
          ip_address: req.ip,
        });
        
        // Add custom context
        Sentry.setContext('auth', {
          spotify_user_id: payload.spotify_user_id,
          token_timestamp: payload.tokenTimestamp,
          token_age_hours: payload.tokenTimestamp ? 
            Math.floor((Date.now() - payload.tokenTimestamp) / (1000 * 60 * 60)) : 
            undefined,
        });
      }
    } else if (req.session?.spotifyUserId) {
      // Fallback to session-based auth
      Sentry.setUser({
        id: req.session.spotifyUserId,
        ip_address: req.ip,
      });
    }
  } catch (error) {
    // Don't fail the request if Sentry context fails
    console.error('Failed to set Sentry user context:', error);
  }
  
  next();
}

/**
 * Middleware to clear Sentry context (useful for logout endpoints)
 */
export function clearSentryContext(req: Request, res: Response, next: NextFunction) {
  Sentry.setUser(null);
  Sentry.setContext('auth', null);
  next();
}