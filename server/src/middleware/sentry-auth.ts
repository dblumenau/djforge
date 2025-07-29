import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to set Sentry user context from session
 * This should be applied after session-auth middleware
 */
export function setSentryUserContext(req: any, res: Response, next: NextFunction) {
  try {
    // Get user ID from session-auth middleware
    if (req.userId) {
      // Set Sentry user context
      Sentry.setUser({
        id: req.userId,
        ip_address: req.ip,
      });
      
      // Add custom context
      Sentry.setContext('auth', {
        spotify_user_id: req.userId,
        auth_type: 'session_based',
        timestamp: Date.now()
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