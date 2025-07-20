# Retry Song Search on 404 - Planning Document

## Task Description

Add retry logic to the Spotify Claude Controller when a specific song search fails (returns 404 or no results). The system should automatically retry the search with progressively less specific queries to improve the chances of finding the song.

## Current Flow Analysis

1. **LLM interprets command** → Extracts artist, track, and optionally album
2. **Build search query** → Creates precise Spotify search: `artist:"X" track:"Y" album:"Z"`
3. **Search Spotify API** → Returns tracks or empty array
4. **Handle result** → If no tracks found, immediately fails with "No tracks found"

## Problem

When the LLM extracts incorrect album information or the exact match doesn't exist on Spotify, the search fails completely even though a less specific search might succeed.

## Proposed Solution

Implement a retry mechanism with progressive query relaxation:

1. **First attempt**: Full precision search with artist, track, and album
2. **Second attempt**: Remove album, search with just artist and track
3. **Third attempt**: Search with just the track name

## Implementation Details

### 1. Modify `SpotifyControl.searchAndPlay()` method

Location: `/server/src/spotify/control.ts`

The retry logic should be added to both:
- `searchAndPlay()` method (lines 102-124)
- `queueTrack()` method (lines 126-147)

### 2. Create a new helper method for progressive search

```typescript
async searchWithRetry(query: string, artist?: string, track?: string, album?: string): Promise<SpotifyTrack[]> {
  // Attempt 1: Full precision search
  let tracks = await this.webAPI.search(query);
  
  if (tracks.length === 0 && artist && track) {
    // Attempt 2: Without album
    const queryWithoutAlbum = `artist:"${artist}" track:"${track}"`;
    console.log(`[DEBUG] Retry search without album: ${queryWithoutAlbum}`);
    tracks = await this.webAPI.search(queryWithoutAlbum);
  }
  
  if (tracks.length === 0 && track) {
    // Attempt 3: Just track name
    console.log(`[DEBUG] Retry search with just track: ${track}`);
    tracks = await this.webAPI.search(track);
  }
  
  return tracks;
}
```

### 3. Update the route handler

Location: `/server/src/routes/simple-llm-interpreter.ts`

The route handler (lines 750-814) should pass the parsed components to enable retry:

```typescript
case 'play_specific_song':
case 'queue_specific_song': {
  // Pass individual components for retry logic
  const tracks = await spotifyControl.searchWithRetry(
    searchQuery,
    interpretation.artist,
    interpretation.track,
    interpretation.album
  );
  // ... rest of the logic
}
```

## Questions/Clarifications Needed

1. **Retry behavior for playlists**: Should we apply similar retry logic for playlist searches that fail? - Not for this sprint.
2. **User feedback**: Should we inform the user when we're using a less specific search? For example: "Couldn't find exact match, playing closest match instead"? - Yes.
3. **Threshold for "close enough"**: When using just track name, should we verify the artist matches somewhat to avoid playing completely wrong songs? - No once we get to that one we just YOLO it. Perhaps it plays the wrong song, maybe they will discoer a new artist they like!

## Success Criteria

- Song searches that previously failed due to incorrect album info now succeed
- Users get the song they requested even with imperfect metadata
- System logs clearly show when retry attempts are made
- No performance degradation for successful first attempts

## Potential Risks

- Playing wrong version of a song (live vs studio, remix vs original)
- Playing songs by different artists with same track name
- Increased API calls to Spotify (up to 3x per search)

## Alternative Approaches Considered

1. **Fuzzy matching on album names**: Complex and might not handle all cases
2. **Using Spotify's recommendation API**: Would change user intent
3. **Asking user for clarification**: Breaks the flow of natural language control