import { SpotifyAuthTokens } from '../types';

declare global {
  namespace Express {
    interface Request {
      spotifyTokens?: SpotifyAuthTokens;
    }
  }
}

export {};