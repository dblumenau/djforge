# Add WebSocket Progress Emissions to Playlist Discovery

## Task Overview
Add WebSocket progress emissions to the `/full-search` endpoint in the playlist discovery route to provide real-time feedback to users during the search and analysis process.

## Requirements Analysis

### File to Modify
- `/Users/david/Sites/djforge/server/src/routes/playlist-discovery.ts`

### Import Requirements
- Import `getMusicWebSocketService` from '../services/musicWebSocket.service'

### Progress Emission Points
1. **Before Spotify search** (line ~1062)
   - Message: "Searching Spotify for '{query}'..."
   - Phase: 'searching'

2. **After search results** (line ~1073)
   - Message: "Found {count} playlists, sending to AI for analysis..."
   - Phase: 'searching'
   - Include metadata with search time

3. **Before LLM analysis** (line ~1118)
   - Message: "AI ({model}) analyzing {count} playlists..."
   - Phase: 'analyzing'

4. **After LLM selection** (line ~1148)
   - Message: "AI selected {count} best matches in {latency}ms"
   - Phase: 'analyzing'
   - Include metadata with model, latency, and tokens used

5. **For each playlist details fetch** (loop ~line 1255)
   - Before fetch: "Getting tracks and artists for playlist {i+1} of {total}..."
   - Phase: 'fetching'
   - Include itemNumber and totalItems
   - Different messages for cache hit vs API fetch

6. **For each playlist summary** (loop ~line 1341)
   - Before: "AI analyzing music style of '{name}'..."
   - After: "'{name}' scored {score}% match!"
   - Phase: 'summarizing'
   - Include metadata with latency and tokens

7. **Final complete** (line ~1544)
   - Message: "Complete! Found {count} perfect playlists for you"
   - Phase: 'complete'

### Implementation Pattern
```typescript
const musicWS = getMusicWebSocketService();
if (musicWS && req.session?.userId) {
  musicWS.emitToUser(req.session.userId, 'playlistDiscoveryProgress', {
    sessionId: req.sessionID || 'unknown',
    step: 'Your message here',
    phase: 'appropriate-phase',
    // optional fields as needed
    timestamp: Date.now()
  });
}
```

### Important Notes
- Check that musicWS exists and userId is available before emitting
- Use req.session?.userId for the user ID
- Use req.sessionID for the session ID
- Track timing for metadata (e.g., const startTime = Date.now())
- For loops, include itemNumber and totalItems fields

## Approach
1. First, read the current file to understand the structure and locate the exact lines
2. Add the import statement at the top
3. Add progress emissions at each specified location following the implementation pattern
4. Ensure proper error handling and safety checks
5. Test the implementation

## Questions/Clarifications Needed
- Are the approximate line numbers accurate or should I locate them by code patterns?
- Should I handle any specific error cases for WebSocket emissions?
- Are there any additional metadata fields that should be included?

## Success Criteria
- Import added correctly
- All 7+ progress emission points implemented
- Proper safety checks (musicWS exists, userId available)
- Consistent message format and phases
- Timing metadata included where appropriate
- Loop progress tracking with itemNumber/totalItems