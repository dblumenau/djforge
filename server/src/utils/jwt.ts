import jwt from 'jsonwebtoken';
import { SpotifyAuthTokens } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'spotify-claude-jwt-secret';
const JWT_EXPIRES_IN = '30d'; // 30 days

export interface JWTPayload {
  spotifyTokens: SpotifyAuthTokens;
  tokenTimestamp: number;
  iat?: number;
  exp?: number;
}

export function generateJWT(spotifyTokens: SpotifyAuthTokens): string {
  const payload: JWTPayload = {
    spotifyTokens,
    tokenTimestamp: Date.now()
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
}