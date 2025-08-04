// Debug script to check AI discoveries in Redis
const redis = require('redis');

async function checkAIDiscoveries() {
  const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  await client.connect();

  try {
    // Find user IDs with AI discoveries
    const keys = await client.keys('user:*:ai_discoveries');
    console.log('Found AI discovery keys:', keys);

    for (const key of keys) {
      const userId = key.match(/user:(.*):ai_discoveries/)[1];
      console.log(`\nUser ID: ${userId}`);
      
      // Get discoveries
      const discoveries = await client.lRange(key, 0, 4);
      console.log(`Discoveries (${discoveries.length} total):`);
      
      discoveries.forEach((disc, i) => {
        try {
          const parsed = JSON.parse(disc);
          console.log(`  ${i + 1}. ${parsed.trackName} by ${parsed.artist}`);
          console.log(`     Reasoning: ${parsed.reasoning}`);
          console.log(`     Discovered: ${new Date(parsed.discoveredAt).toLocaleString()}`);
        } catch (e) {
          console.log(`  ${i + 1}. Raw: ${disc}`);
        }
      });

      // Check loved/disliked
      const loved = await client.zRange(`user:${userId}:ai_loved`, 0, -1);
      const disliked = await client.zRange(`user:${userId}:ai_disliked`, 0, -1);
      
      console.log(`\nLoved tracks: ${loved.length}`);
      console.log(`Disliked tracks: ${disliked.length}`);
    }

    if (keys.length === 0) {
      console.log('No AI discoveries found in Redis');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.quit();
  }
}

checkAIDiscoveries();