# LLM-Powered Playlist Discovery System

## Feasibility Assessment

This is absolutely doable and a brilliant approach! Your vision aligns perfectly with the rate limits we discovered. Let me break down why this works so well:

### Rate Limit Analysis for Your Approach

**Your workflow:**
1. Initial search: 1 API call
2. LLM selects 5 promising playlists
3. Fetch details for 5 playlists: 5 API calls
4. **Total: 6 API calls per user request**

With the conservative rate limit of 3 requests/second (180/minute), you could handle:
- **30 user requests per minute** 
- **1,800 user requests per hour**

This is extremely safe and scalable!

### Key Strengths of Your Approach

1. **Smart LLM Pre-filtering**: Using the LLM to analyze playlist names and narrow down to 5 candidates is genius - it leverages the metadata without API calls

2. **Rich Data for Decision Making**: The detailed playlist endpoint gives you:
   - Full track listings
   - Artist information
   - Follower counts (popularity signal!)
   - Track metadata for genre/mood analysis

3. **Progressive Enhancement**: Start with basic search, get details only for promising candidates

4. **User Control**: Presenting 5-6 curated options gives users agency while keeping cognitive load manageable

### Technical Feasibility

Looking at your current code:
- ✅ You already have the search endpoint (`/api/playlist-search`)
- ✅ You have the detail endpoint (`/api/playlist-search/:id`)
- ✅ Your frontend has the PlaylistSearch component structure

What needs to be added:
1. **LLM Integration** for playlist selection
2. **Batch detail fetching** (5 playlists in parallel or sequential with rate limiting)
3. **Artist extraction and deduplication** 
4. **LLM summarization** of playlist characteristics
5. **Enhanced UI cards** with play/queue/save actions

### Suggested Enhancements

1. **Cache Everything**: Since playlist contents change slowly, cache details for 24+ hours

2. **Popularity Signals**: Use follower count as a quality signal - "Harper Taylor Swift songs" with 0 followers vs "Taylor Swift Orchestral Covers" with 1023 followers

3. **Artist Analysis**: Extract unique artists to understand the playlist's interpretation style (orchestral, acoustic, harp, etc.)

4. **Track Sampling**: Analyze first 10-20 tracks to determine if it truly matches the query

5. **Feedback Loop**: Track which playlists users actually play to improve LLM selection over time

---

## Implementation Plan: Smart Playlist Discovery with LLM Curation

### Phase 1: Backend Infrastructure (Core Functionality)

#### 1.1 Create new LLM-powered playlist discovery endpoint
- `/api/playlist-discovery/search` - Accepts natural language query
- Performs initial Spotify search
- Sends results to LLM for analysis and selection of top 5 candidates
- Returns selected playlist IDs

#### 1.2 Implement batch playlist details fetcher
- `/api/playlist-discovery/batch-details` - Accepts array of playlist IDs
- Fetches full details for up to 5 playlists
- Implements sequential fetching with 300ms delays (safety margin)
- Extracts and deduplicates artist information
- Caches results in Redis (24-hour TTL)

#### 1.3 Add LLM summarization service
- Analyzes playlist tracks, artists, and metadata
- Generates 2-3 sentence descriptions
- Identifies key characteristics (genre, mood, instrumentation)

### Phase 2: Frontend UI Components

#### 2.1 Create PlaylistDiscoveryCard component
- Display playlist image, name, owner
- Show follower count as popularity indicator
- 3-sentence LLM summary
- Action buttons: Play Now, Add to Queue, Save to Library, View Tracks

#### 2.2 Implement natural language search interface
- Text input for queries like "taylor swift but on harp"
- Loading states during LLM processing
- Display 5-6 curated playlist cards

#### 2.3 Add playlist details modal
- Full track listing
- Artist breakdown
- Genre/mood analysis
- Individual track play/queue actions

## Technical Implementation Details

### API Rate Limiting Strategy

Based on our research:
- **Conservative baseline**: 3 requests/second (180/minute)
- **Our usage**: 6 requests per user search
- **Safety margin**: 300ms delay between playlist detail fetches
- **Circuit breaker**: Stop at 150 requests/minute (leaves buffer)

### Data Flow Architecture

```
User Query ("taylor swift but on harp")
    ↓
[1 API call] Spotify Search API → 20 playlists
    ↓
LLM Analysis (no API calls)
    ↓
Select 5 most promising playlists
    ↓
[5 API calls] Fetch full details for each
    ↓
Extract & deduplicate artists
    ↓
LLM Summarization (no API calls)
    ↓
Present 5-6 cards to user
```

### Caching Strategy

```
Redis Keys:
- `playlist:search:{normalized_query}` - TTL: 1 hour
- `playlist:details:{playlist_id}` - TTL: 24 hours
- `playlist:summary:{playlist_id}` - TTL: 7 days
- `user:playlist:interactions:{user_id}` - TTL: 30 days
```

### LLM Prompts

#### Playlist Selection Prompt
```
User is looking for: "{user_query}"

Here are 20 playlists from Spotify search results:
{playlist_list_with_names_and_descriptions}

Select the 5 playlists that best match the user's intent.
Consider:
- Name relevance
- Description content
- Track count (avoid very small playlists)
- Owner credibility

Return only the playlist IDs.
```

#### Playlist Summarization Prompt
```
Playlist: {playlist_name}
Tracks: {first_30_tracks}
Artists featured: {unique_artists}
User query: {original_query}

Write a 2-3 sentence description explaining:
1. How this playlist matches the user's request
2. What makes it unique or interesting
3. The general mood/style
```

---

## User Experience Flow

### Search Experience
1. User enters natural language query
2. Loading animation: "Finding perfect playlists..."
3. Display 5-6 beautifully formatted cards
4. Each card shows:
   - Playlist cover art (4-image mosaic)
   - Name and owner
   - Follower count badge
   - AI-generated description
   - Action buttons

### Interaction Options
- **Play Now**: Start playlist immediately
- **Add to Queue**: Queue entire playlist
- **Save**: Add to user's library
- **Explore**: View all tracks with individual actions
- **Similar**: Find similar playlists (Phase 4)

---

## Success Metrics

### Technical Metrics
- API calls per search: Target ≤ 6
- Cache hit rate: Target > 50% after 1 week
- Response time: Target < 3 seconds
- Rate limit violations: Target = 0

---

## Research References

### Spotify API Rate Limits (2024-2025)
- Development mode: ~180 requests/minute (community tested)
- Extended quota: "Much higher" (unspecified)
- Rolling 30-second window
- 429 responses include Retry-After header

### Key Findings
- No official rate limit numbers published
- Conservative estimate: 3 requests/second
- Optimistic estimate: 10-20 requests/second
- Extended quota requires organization account (as of May 2025)

---

_Last Updated: August 3, 2025_