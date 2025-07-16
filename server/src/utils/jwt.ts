import jwt from 'jsonwebtoken';
import { SpotifyAuthTokens } from '../types';

export const getJWTSecret = () => process.env.JWT_SECRET || process.env.SESSION_SECRET || 'spotify-claude-jwt-secret';
const JWT_EXPIRES_IN = '30d'; // 30 days

export interface JWTPayload {
  sub: string; // The user's stable Spotify ID (standard JWT claim)
  spotify_user_id: string; // Keep for clarity and backward compatibility
  spotifyTokens: SpotifyAuthTokens;
  tokenTimestamp: number;
  iat?: number;
  exp?: number;
}

export function generateJWT(spotifyTokens: SpotifyAuthTokens, spotifyUserId: string): string {
  const payload: JWTPayload = {
    sub: spotifyUserId,
    spotify_user_id: spotifyUserId,
    spotifyTokens,
    tokenTimestamp: Date.now()
  };
  
  return jwt.sign(payload, getJWTSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJWTSecret()) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    console.error('JWT_SECRET being used:', getJWTSecret());
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
}