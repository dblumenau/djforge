import { v4 as uuidv4 } from 'uuid';

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
  private redis: any;
  private readonly SESSION_TTL = 48 * 60 * 60; // 48 hours
  
  constructor(redisClient: any) {
    this.redis = redisClient;
  }
  
  async createSession(userId: string, tokens: any): Promise<Session> {
    const sessionId = uuidv4();
    const session: Session = {
      id: sessionId,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + (this.SESSION_TTL * 1000)
    };
    
    // Store session metadata
    await this.redis.setEx(
      `session:${sessionId}:meta`,
      this.SESSION_TTL,
      JSON.stringify(session)
    );
    
    // Store tokens separately
    await this.redis.setEx(
      `session:${sessionId}:tokens`,
      this.SESSION_TTL,
      JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in * 1000)
      })
    );
    
    // Add to user's session set
    await this.redis.sAdd(`user:${userId}:sessions`, sessionId);
    
    return session;
  }
  
  async getSession(sessionId: string): Promise<Session | null> {
    const data = await this.redis.get(`session:${sessionId}:meta`);
    return data ? JSON.parse(data) : null;
  }
  
  async getTokens(sessionId: string): Promise<StoredTokens | null> {
    const data = await this.redis.get(`session:${sessionId}:tokens`);
    return data ? JSON.parse(data) : null;
  }
  
  async updateTokens(sessionId: string, tokens: any): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
    
    await this.redis.setEx(
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
    
    await this.redis.del(`session:${sessionId}:meta`);
    await this.redis.del(`session:${sessionId}:tokens`);
    // Note: refresh-lock cleanup handled by SpotifyAuthService
    await this.redis.sRem(`user:${session.userId}:sessions`, sessionId);
  }
}