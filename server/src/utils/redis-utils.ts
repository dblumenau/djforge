import { createRedisClient } from '../config/redis';
import { RedisClientType } from 'redis';

/**
 * Redis utility functions for session management and debugging
 */

export interface SessionInfo {
  id: string;
  data: Record<string, any>;
  expires: Date | null;
}

export interface RedisMemoryInfo {
  used_memory: string;
  used_memory_human: string;
  used_memory_rss: string;
  used_memory_rss_human: string;
  used_memory_peak: string;
  used_memory_peak_human: string;
  used_memory_overhead: string;
  [key: string]: string;
}

export interface RedisInfoSection {
  [key: string]: string;
}

export interface RedisInfo {
  [sectionName: string]: RedisInfoSection;
}

export class RedisUtils {
  private client: RedisClientType;
  
  constructor(client: RedisClientType) {
    this.client = client;
  }
  
  // Get all session keys
  async getSessionKeys(): Promise<string[]> {
    try {
      return await this.client.keys('djforge:sess:*');
    } catch (error) {
      console.error('Error getting session keys:', error);
      return [];
    }
  }
  
  // Get session count
  async getSessionCount(): Promise<number> {
    const keys = await this.getSessionKeys();
    return keys.length;
  }
  
  // Get session data by ID
  async getSession(sessionId: string): Promise<SessionInfo | null> {
    try {
      const key = `djforge:sess:${sessionId}`;
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }
      
      const parsed = JSON.parse(data);
      
      return {
        id: sessionId,
        data: parsed,
        expires: parsed.cookie?.expires ? new Date(parsed.cookie.expires) : null
      };
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }
  
  // Delete session by ID
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const key = `djforge:sess:${sessionId}`;
      const result = await this.client.del(key);
      return result === 1;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }
  
  // Get all active sessions
  async getAllSessions(): Promise<SessionInfo[]> {
    const keys = await this.getSessionKeys();
    const sessions: SessionInfo[] = [];
    
    for (const key of keys) {
      const sessionId = key.replace('djforge:sess:', '');
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }
  
  // Clean expired sessions manually
  async cleanExpiredSessions(): Promise<number> {
    const sessions = await this.getAllSessions();
    let deletedCount = 0;
    const now = new Date();
    
    for (const session of sessions) {
      if (session.expires && session.expires < now) {
        const deleted = await this.deleteSession(session.id);
        if (deleted) {
          deletedCount++;
        }
      }
    }
    
    return deletedCount;
  }
  
  // Get Redis memory usage
  async getMemoryUsage(): Promise<RedisMemoryInfo> {
    try {
      const info = await this.client.info('memory');
      const lines = info.split('\r\n');
      const memory: Partial<RedisMemoryInfo> = {};
      
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          if (key.startsWith('used_memory')) {
            memory[key as keyof RedisMemoryInfo] = value;
          }
        }
      }
      
      return memory as RedisMemoryInfo;
    } catch (error) {
      console.error('Error getting memory usage:', error);
      return {} as RedisMemoryInfo;
    }
  }
  
  // Get Redis general info
  async getRedisInfo(): Promise<RedisInfo> {
    try {
      const info = await this.client.info();
      const sections: RedisInfo = {};
      let currentSection = '';
      
      const lines = info.split('\r\n');
      for (const line of lines) {
        if (line.startsWith('# ')) {
          currentSection = line.substring(2);
          sections[currentSection] = {};
        } else if (line.includes(':') && currentSection) {
          const [key, value] = line.split(':');
          sections[currentSection][key] = value;
        }
      }
      
      return sections;
    } catch (error) {
      console.error('Error getting Redis info:', error);
      return {};
    }
  }
}

// Create a Redis utils instance
export async function createRedisUtils(): Promise<RedisUtils | null> {
  try {
    const client = await createRedisClient();
    await client.connect();
    return new RedisUtils(client);
  } catch (error) {
    console.error('Failed to create Redis utils:', error);
    return null;
  }
}