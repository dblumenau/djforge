import { Router } from 'express';
import { ensureValidToken } from '../spotify/auth';
import { SpotifyWebAPI } from '../spotify/api';

export const debugTokenRouter = Router();

// Debug endpoint to verify songs using current user's token
debugTokenRouter.get('/verify-songs', ensureValidToken, async (req, res) => {
  try {
    const tokens = req.spotifyTokens;
    if (!tokens) {
      return res.status(401).json({ error: 'No tokens available' });
    }

    console.log('🔑 Using access token for verification');
    
    const spotifyAPI = new SpotifyWebAPI(tokens, (newTokens) => {
      // Token refresh callback - not needed for this verification
    });

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

    console.log('🎵 Starting song verification...');
    
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
        try {
          const tracks = await spotifyAPI.search(query, ['track']);
          if (tracks.length > 0) {
            searchResultsFound = true;
            // Look for exact match
            const exactMatch = tracks.find((track: any) => {
              const trackArtist = track.artists[0]?.name.toLowerCase();
              const searchArtist = song.artist.toLowerCase();
              const trackNameLower = track.name.toLowerCase();
              const searchTrackLower = song.track.toLowerCase();
              
              return trackArtist === searchArtist && trackNameLower === searchTrackLower;
            });
            
            if (exactMatch) {
              bestMatch = exactMatch;
              break;
            } else if (!bestMatch) {
              bestMatch = tracks[0]; // Use first result as fallback
            }
          }
        } catch (searchError) {
          console.error(`Search error for "${query}":`, searchError);
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
          uri: bestMatch.uri,
          popularity: bestMatch.popularity
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
    }

    console.log('='.repeat(60));
    console.log(`SUMMARY: ${availableCount}/${songsToVerify.length} songs found on Spotify`);
    console.log('='.repeat(60));

    let verdict = '';
    if (availableCount === songsToVerify.length) {
      verdict = '🎉 ALL SONGS ARE AVAILABLE! The frontend claim of "only 3 available" appears to be a bug.';
      console.log(verdict);
    } else if (availableCount === 3) {
      verdict = '🤔 Only 3 songs found - matches the frontend claim.';
      console.log(verdict);
      console.log('\nSongs NOT found:');
      results.filter(r => !r.found).forEach(song => {
        console.log(`  - ${song.artist} - ${song.track} (${(song as any).reason || 'No reason provided'})`);
      });
    } else {
      verdict = `📊 Found ${availableCount} songs (different from frontend claim of 3)`;
      console.log(verdict);
    }

    const response = {
      success: true,
      totalSongs: songsToVerify.length,
      foundCount: availableCount,
      results,
      verdict,
      summary: {
        allAvailable: availableCount === songsToVerify.length,
        matchesFrontendClaim: availableCount === 3,
        conclusion: verdict
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify songs'
    });
  }
});

export default debugTokenRouter;