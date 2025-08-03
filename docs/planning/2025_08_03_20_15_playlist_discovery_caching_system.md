# Playlist Discovery Search Caching System Implementation Plan

## Task Overview
Implement a comprehensive caching system for Playlist Discovery searches that stores complete search results in Redis and provides a way to view past searches without re-invoking the LLM.

## Current State Analysis
- Playlist discovery feature exists at `/api/playlist-discovery/full-search`
- Results include LLM-generated summaries and characteristics for each playlist
- Redis is already set up and available via `redisClient`
- User ID is available as `(req as any).userId` in routes
- System has existing PlaylistDiscoveryCard components for displaying results

## Requirements Breakdown

### Backend Changes (Step 1 & 2)
1. **Modify `/server/src/routes/playlist-discovery.ts`**:
   - Add caching logic to `/full-search` endpoint after successful results
   - Create search hash using MD5 of userId:query:model
   - Store complete results in Redis with 30-day TTL
   - Maintain search history in sorted set
   - Add two new endpoints:
     - `GET /api/playlist-discovery/history` - retrieve search history
     - `GET /api/playlist-discovery/cached-result/:searchHash` - retrieve cached result

### Frontend Changes (Steps 3-6)
2. **Create new components**:
   - `PlaylistSearchHistory.tsx` - main history component with search/filter
   - `PlaylistSearchHistoryCard.tsx` - individual search card
   
3. **Create new page**:
   - `PastPlaylistSearches.tsx` - full page for search history

4. **Update existing components**:
   - `Dashboard.tsx` - add search history section
   - `App.tsx` - add new route

## Technical Implementation Details

### Redis Schema
- Results: `playlist:search:result:${userId}:${searchHash}` (30-day TTL)
- History: `playlist:search:history:${userId}` (sorted set by timestamp)

### Search Hash Generation
```typescript
const searchHash = createHash('md5').update(`${userId}:${query.trim().toLowerCase()}:${model}`).digest('hex')
```

### History Metadata Structure
```typescript
{
  searchHash: string,
  query: string,
  model: string,
  timestamp: number,
  resultCount: number
}
```

## Success Criteria
- [ ] Search results are cached in Redis after successful searches
- [ ] Search history is maintained and retrievable
- [ ] Users can view past searches without LLM re-invocation
- [ ] Cached results display using existing PlaylistDiscoveryCard components
- [ ] Proper error handling for Redis operations
- [ ] Loading states and empty states handled
- [ ] Date/time formatting is user-friendly
- [ ] Navigation between main discovery and history works

## Risks and Considerations
- Redis availability (need null checks)
- Memory usage with large result sets
- TTL management for storage efficiency
- UI consistency with existing components
- Error handling for expired/missing cache entries

## Questions for Clarification
1. Should we limit the number of searches stored in history (beyond the 100 retrieval limit)?
2. Do we want to show any analytics in the history (e.g., most searched terms)?
3. Should expired searches be automatically removed from history, or just marked as expired?
4. Any specific formatting preferences for the date/time display?
5. Should the search history be paginated if it grows very large?

## Implementation Order
1. Backend caching in full-search endpoint
2. Backend history retrieval endpoints
3. Frontend components (history card, then main history)
4. Frontend page and routing
5. Dashboard integration
6. Testing and refinement

Please review this plan and provide any clarifications or modifications needed before I proceed with implementation.