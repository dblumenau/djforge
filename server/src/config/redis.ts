import { createClient } from 'redis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  connectTimeout?: number;
  lazyConnect?: boolean;
}

// Redis configuration with environment variable support
export function getRedisConfig(): RedisConfig {
  const config: RedisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    connectTimeout: 10000,
    lazyConnect: true,
  };

  // Add password if provided
  if (process.env.REDIS_PASSWORD) {
    config.password = process.env.REDIS_PASSWORD;
  }

  // Add database number if provided
  if (process.env.REDIS_DB) {
    config.db = parseInt(process.env.REDIS_DB);
  }

  return config;
}

// Create Redis client with proper error handling
export async function createRedisClient() {
  const config = getRedisConfig();
  
  // Build Redis URL
  let redisUrl = `redis://`;
  if (config.password) {
    redisUrl += `:${config.password}@`;
  }
  redisUrl += `${config.host}:${config.port}`;
  if (config.db) {
    redisUrl += `/${config.db}`;
  }

  console.log(`🔗 Connecting to Redis at ${config.host}:${config.port}${config.db ? ` (DB ${config.db})` : ''}`);

  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: config.connectTimeout,
      reconnectStrategy: (retries: number) => {
        if (retries > 5) {
          console.error('❌ Redis reconnection failed after 5 attempts');
          return false; // Stop reconnecting
        }
        const delay = Math.min(retries * 100, 3000);
        console.log(`🔄 Redis reconnecting in ${delay}ms (attempt ${retries + 1})`);
        return delay;
      }
    }
  });

  // Error handling
  client.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  client.on('ready', () => {
    console.log('🚀 Redis ready to accept commands');
  });

  client.on('end', () => {
    console.log('🔚 Redis connection ended');
  });

  client.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
  });

  return client;
}

// Health check function
export async function checkRedisHealth(client: any): Promise<boolean> {
  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}