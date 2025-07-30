import { promises as fs } from 'fs';
import path from 'path';
import { Session, StoredTokens } from './session-manager';
import { logger } from '../utils/logger';
import { RedisMemoryMonitor } from '../config/redis-memory-monitor';

export class SessionStorageStrategy {
  private redis: any;
  private memoryMonitor: RedisMemoryMonitor;
  private sessionPath: string;
  
  constructor(redisClient: any, sessionPath: string = './sessions') {
    this.redis = redisClient;
    this.memoryMonitor = new RedisMemoryMonitor(redisClient);
    this.sessionPath = sessionPath;
    this.ensureSessionDir();
  }

  private async ensureSessionDir(): Promise<void> {
    try {
      await fs.mkdir(this.sessionPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create session directory:', error);
    }
  }

  /**
   * Save session with automatic fallback to disk if Redis is under pressure
   */
  async saveSession(sessionId: string, session: Session, tokens: StoredTokens, ttl: number): Promise<void> {
    // Check memory status
    const memStatus = await this.memoryMonitor.checkMemoryUsage();
    
    // Always save to Redis first
    try {
      await this.redis.setEx(
        `session:${sessionId}:meta`,
        ttl,
        JSON.stringify(session)
      );
      
      await this.redis.setEx(
        `session:${sessionId}:tokens`,
        ttl,
        JSON.stringify(tokens)
      );
      
      await this.redis.sAdd(`user:${session.userId}:sessions`, sessionId);
    } catch (error) {
      logger.error(`Failed to save session ${sessionId} to Redis:`, error);
    }
    
    // If memory is tight, also save to disk as backup
    if (memStatus.status !== 'ok') {
      await this.saveSessionToDisk(sessionId, session, tokens);
      
      // Clean up old Express sessions if critical
      if (memStatus.status === 'critical') {
        await this.memoryMonitor.cleanupOldExpressSessions(0.5); // 12 hours old
      }
    }
  }

  /**
   * Load session with automatic fallback to disk if not in Redis
   */
  async loadSession(sessionId: string): Promise<{ session: Session; tokens: StoredTokens } | null> {
    // Try Redis first
    try {
      const sessionData = await this.redis.get(`session:${sessionId}:meta`);
      const tokensData = await this.redis.get(`session:${sessionId}:tokens`);
      
      if (sessionData && tokensData) {
        return {
          session: JSON.parse(sessionData),
          tokens: JSON.parse(tokensData)
        };
      }
    } catch (error) {
      logger.error(`Failed to load session ${sessionId} from Redis:`, error);
    }
    
    // Fallback to disk
    logger.info(`Session ${sessionId} not in Redis, checking disk backup...`);
    const diskData = await this.loadSessionFromDisk(sessionId);
    
    if (diskData) {
      // Restore to Redis if we have space
      const memStatus = await this.memoryMonitor.checkMemoryUsage();
      if (memStatus.status === 'ok') {
        const ttl = Math.floor((diskData.session.expiresAt - Date.now()) / 1000);
        if (ttl > 0) {
          await this.saveSession(sessionId, diskData.session, diskData.tokens, ttl);
        }
      }
      
      return diskData;
    }
    
    return null;
  }

  private async saveSessionToDisk(sessionId: string, session: Session, tokens: StoredTokens): Promise<void> {
    try {
      const data = {
        session,
        tokens,
        savedAt: Date.now()
      };
      
      const filePath = path.join(this.sessionPath, `${sessionId}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      logger.info(`📁 Backed up session ${sessionId} to disk`);
    } catch (error) {
      logger.error(`Failed to save session ${sessionId} to disk:`, error);
    }
  }

  private async loadSessionFromDisk(sessionId: string): Promise<{ session: Session; tokens: StoredTokens } | null> {
    try {
      const filePath = path.join(this.sessionPath, `${sessionId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Check if session is still valid
      if (parsed.session.expiresAt < Date.now()) {
        await fs.unlink(filePath);
        return null;
      }
      
      logger.info(`📁 Restored session ${sessionId} from disk backup`);
      return {
        session: parsed.session,
        tokens: parsed.tokens
      };
    } catch (error) {
      return null;
    }
  }

  async cleanupExpiredDiskSessions(): Promise<void> {
    try {
      const files = await fs.readdir(this.sessionPath);
      const now = Date.now();
      let cleaned = 0;
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const filePath = path.join(this.sessionPath, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const parsed = JSON.parse(data);
          
          if (parsed.session.expiresAt < now) {
            await fs.unlink(filePath);
            cleaned++;
          }
        } catch (error) {
          // Skip corrupted files
        }
      }
      
      if (cleaned > 0) {
        logger.info(`🧹 Cleaned up ${cleaned} expired disk sessions`);
      }
    } catch (error) {
      logger.error('Failed to cleanup expired disk sessions:', error);
    }
  }
}