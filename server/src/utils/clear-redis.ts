import { createClient } from 'redis';

async function clearRedis() {
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379')
    },
    password: process.env.REDIS_PASSWORD
  });

  try {
    await redisClient.connect();
    console.log('Connected to Redis');

    // Get all keys
    const keys = await redisClient.keys('*');
    console.log(`Found ${keys.length} keys to delete`);

    if (keys.length > 0) {
      // Delete all keys
      await redisClient.del(keys);
      console.log('All keys deleted successfully');
    }

    await redisClient.quit();
    console.log('Redis cleared and connection closed');
  } catch (error) {
    console.error('Error clearing Redis:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  clearRedis();
}

export { clearRedis };