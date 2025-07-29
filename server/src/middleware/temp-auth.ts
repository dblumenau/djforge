// Temporary middleware during auth system refactor
// TODO: Remove this file once new auth system is implemented

import { Request, Response, NextFunction } from 'express';

// Temporary middleware to replace ensureValidToken during Phase 1
export const tempAuthMiddleware = (req: Request & { spotifyTokens?: any, user?: any }, res: Response, next: NextFunction) => {
  // During Phase 1, we disable auth validation
  console.warn('WARNING: Using temporary auth bypass during auth system refactor');
  
  // Set temporary user data for routes that expect it
  req.user = { spotifyId: 'temp_user_id' };
  req.spotifyTokens = {
    access_token: 'temp_token',
    refresh_token: 'temp_refresh',
    expires_at: Date.now() + 3600000 // 1 hour from now
  };
  
  next();
};