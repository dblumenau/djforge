import chalk from 'chalk';
import { createClient, RedisClientType } from 'redis';

/**
 * Initialize Redis connection for session management
 * @returns Redis client or null if connection fails
 */
export async function initRedis(): Promise<any | null> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisClient = createClient({ url: redisUrl }) as any;
    
    redisClient.on('error', (err: Error) => {
      console.log(chalk.yellow('Redis Client Error:'), err.message);
    });

    await redisClient.connect();
    console.log(chalk.green('✓ Connected to Redis for enhanced session management'));
    
    return redisClient;
  } catch (error) {
    console.log(chalk.yellow('Redis not available, using file-based sessions'));
    return null;
  }
}