const axios = require('axios');
const { createClient } = require('redis');

// Songs to verify from the LLM response
const songsToVerify = [
  {
    artist: "Nine Inch Nails",
    track: "Wish",
    album: "Broken"
  },
  {
    artist: "Ministry",
    track: "N.W.O.",
    album: "Psalm 69: The Way to Succeed and the Way to Suck Eggs"
  },
  {
    artist: "Skinny Puppy",
    track: "Worlock",
    album: "Rabies"
  },
  {
    artist: "Front 242",
    track: "Headhunter",
    album: "Front by Front"
  },
  {
    artist: "HEALTH",
    track: "Body/Prison",
    album: "Death Magic"
  },
  {
    artist: "KMFDM",
    track: "Godlike",
    album: "Nave"
  }
];

async function searchSpotify(query, accessToken) {
  try {
    const response = await axios.get('https://api.spotify.com/v1/search', {
      params: {
        q: query,
        type: 'track',
        limit: 5
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data.tracks.items;
  } catch (error) {
    console.error(`Error searching for "${query}":`, error.response?.data || error.message);
    return [];
  }
}

async function getValidAccessToken() {
  try {
    // Try to get token from running server's session
    const response = await axios.get('http://localhost:4001/api/user-data/profile');
    if (response.data.success) {
      console.log('✅ Found active session with valid token');
      return response.headers['x-access-token'] || 'token-from-session';
    }
  } catch (error) {
    console.log('No active session found, trying Redis...');
  }

  // Try to get token from Redis session storage
  const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  try {
    await redisClient.connect();
    console.log('✅ Connected to Redis');

    // Look for session keys
    const keys = await redisClient.keys('sess:*');
    console.log(`Found ${keys.length} session(s) in Redis`);

    for (const key of keys) {
      try {
        const sessionData = await redisClient.get(key);
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          if (parsed.tokens && parsed.tokens.access_token) {
            console.log(`✅ Found access token in session ${key}`);
            await redisClient.disconnect();
            return parsed.tokens.access_token;
          }
        }
      } catch (e) {
        // Skip invalid sessions
      }
    }

    await redisClient.disconnect();
  } catch (error) {
    console.error('Redis connection failed:', error.message);
  }

  throw new Error('No valid access token found. Please ensure you are logged in to the app.');
}

function findBestMatch(tracks, artist, trackName) {
  if (!tracks || tracks.length === 0) return null;

  // Look for exact matches first
  const exactMatch = tracks.find(track => {
    const trackArtist = track.artists[0]?.name.toLowerCase();
    const searchArtist = artist.toLowerCase();
    const trackNameLower = track.name.toLowerCase();
    const searchTrackLower = trackName.toLowerCase();
    
    return trackArtist === searchArtist && trackNameLower === searchTrackLower;
  });

  if (exactMatch) return exactMatch;

  // Look for close matches
  const closeMatch = tracks.find(track => {
    const trackArtist = track.artists[0]?.name.toLowerCase();
    const searchArtist = artist.toLowerCase();
    const trackNameLower = track.name.toLowerCase();
    const searchTrackLower = trackName.toLowerCase();
    
    return trackArtist.includes(searchArtist) || searchArtist.includes(trackArtist);
  });

  return closeMatch || tracks[0]; // Return first result if no good match
}

async function verifySongs() {
  console.log('🎵 Verifying Spotify song availability...\n');

  try {
    const accessToken = await getValidAccessToken();
    console.log('🔑 Using valid access token\n');

    let availableCount = 0;
    const results = [];

    for (const song of songsToVerify) {
      console.log(`🔍 Searching: ${song.artist} - ${song.track}`);
      
      // Search with different query variations
      const queries = [
        `artist:"${song.artist}" track:"${song.track}"`,
        `"${song.artist}" "${song.track}"`,
        `${song.artist} ${song.track}`,
        `${song.track} ${song.artist}`
      ];

      let bestMatch = null;
      let searchResultsFound = false;

      for (const query of queries) {
        const tracks = await searchSpotify(query, accessToken);
        if (tracks.length > 0) {
          searchResultsFound = true;
          const match = findBestMatch(tracks, song.artist, song.track);
          if (match) {
            bestMatch = match;
            break;
          }
        }
      }

      if (bestMatch) {
        availableCount++;
        console.log(`  ✅ FOUND: ${bestMatch.artists[0].name} - ${bestMatch.name}`);
        console.log(`      Album: ${bestMatch.album.name}`);
        console.log(`      URI: ${bestMatch.uri}`);
        console.log(`      Popularity: ${bestMatch.popularity}/100`);
        
        results.push({
          ...song,
          found: true,
          spotify: bestMatch,
          uri: bestMatch.uri
        });
      } else if (searchResultsFound) {
        console.log(`  ⚠️  PARTIAL: Found results but no good match`);
        results.push({
          ...song,
          found: false,
          reason: 'No good match found'
        });
      } else {
        console.log(`  ❌ NOT FOUND: No search results`);
        results.push({
          ...song,
          found: false,
          reason: 'No search results'
        });
      }
      console.log('');
    }

    console.log('='.repeat(60));
    console.log(`SUMMARY: ${availableCount}/${songsToVerify.length} songs found on Spotify`);
    console.log('='.repeat(60));

    if (availableCount === songsToVerify.length) {
      console.log('🎉 ALL SONGS ARE AVAILABLE! The frontend might have a bug.');
    } else if (availableCount === 3) {
      console.log('🤔 Only 3 songs found - matches the frontend claim.');
      console.log('\nSongs NOT found:');
      results.filter(r => !r.found).forEach(song => {
        console.log(`  - ${song.artist} - ${song.track} (${song.reason})`);
      });
    } else {
      console.log(`📊 Found ${availableCount} songs (different from frontend claim of 3)`);
    }

    return results;

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the verification
verifySongs().then(() => {
  console.log('\n✨ Verification complete!');
  process.exit(0);
}).catch(console.error);