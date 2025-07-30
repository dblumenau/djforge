import { logger } from '../utils/logger';

export class RedisMemoryMonitor {
  private redis: any;
  private warningThreshold = 0.8; // 80% of max memory
  private criticalThreshold = 0.9; // 90% of max memory
  
  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async checkMemoryUsage(): Promise<{
    used: number;
    max: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical';
  }> {
    try {
      const info = await this.redis.info('memory');
      const lines = info.split('\r\n');
      
      let usedMemory = 0;
      let maxMemory = 67108864; // 64MB default for Upstash
      
      for (const line of lines) {
        if (line.startsWith('used_memory:')) {
          usedMemory = parseInt(line.split(':')[1]);
        } else if (line.startsWith('maxmemory:')) {
          const parsed = parseInt(line.split(':')[1]);
          if (parsed > 0) maxMemory = parsed;
        }
      }
      
      const percentage = (usedMemory / maxMemory);
      let status: 'ok' | 'warning' | 'critical' = 'ok';
      
      if (percentage >= this.criticalThreshold) {
        status = 'critical';
        logger.error(`🚨 Redis memory critical: ${(percentage * 100).toFixed(1)}% used`);
      } else if (percentage >= this.warningThreshold) {
        status = 'warning';
        logger.warn(`⚠️ Redis memory warning: ${(percentage * 100).toFixed(1)}% used`);
      }
      
      return {
        used: usedMemory,
        max: maxMemory,
        percentage,
        status
      };
    } catch (error) {
      logger.error('Failed to check Redis memory:', error);
      return {
        used: 0,
        max: 67108864,
        percentage: 0,
        status: 'ok'
      };
    }
  }

  async cleanupOldExpressSessions(daysOld: number = 1): Promise<number> {
    try {
      let deleted = 0;
      const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      
      // Scan for Express session keys
      let cursor = '0';
      do {
        const result = await this.redis.scan(cursor, {
          MATCH: 'djforge:sess:*',
          COUNT: 100
        });
        
        cursor = result.cursor;
        const keys = result.keys;
        
        for (const key of keys) {
          try {
            const data = await this.redis.get(key);
            if (data) {
              const session = JSON.parse(data);
              // Check if session is old based on lastAccess or cookie expiry
              if (session.cookie && new Date(session.cookie.expires).getTime() < cutoff) {
                await this.redis.del(key);
                deleted++;
              }
            }
          } catch (e) {
            // Skip corrupted sessions
          }
        }
      } while (cursor !== '0');
      
      if (deleted > 0) {
        logger.info(`🧹 Cleaned up ${deleted} old Express sessions`);
      }
      
      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup Express sessions:', error);
      return 0;
    }
  }
}