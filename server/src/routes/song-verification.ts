import { Router } from 'express';
import { ensureValidToken } from '../spotify/auth';
import { SpotifyWebAPI } from '../spotify/api';

export const songVerificationRouter = Router();

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

function findBestMatch(tracks: any[], artist: string, trackName: string) {
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

// Verify song availability endpoint
songVerificationRouter.get('/verify', ensureValidToken, async (req, res) => {
  try {
    const tokens = req.spotifyTokens;
    if (!tokens) {
      return res.status(401).json({ error: 'No tokens available' });
    }
    
    const spotifyAPI = new SpotifyWebAPI(tokens, (newTokens) => {
      // Token refresh callback - not needed for this verification
    });

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
            const match = findBestMatch(tracks, song.artist, song.track);
            if (match) {
              bestMatch = match;
              break;
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

    const response = {
      success: true,
      totalSongs: songsToVerify.length,
      foundCount: availableCount,
      results,
      summary: {
        allAvailable: availableCount === songsToVerify.length,
        matchesFrontendClaim: availableCount === 3,
        verdict: availableCount === songsToVerify.length 
          ? 'ALL SONGS ARE AVAILABLE - Frontend might have a bug'
          : availableCount === 3 
          ? 'Only 3 songs found - matches frontend claim'
          : `Found ${availableCount} songs - different from frontend claim of 3`
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

export default songVerificationRouter;