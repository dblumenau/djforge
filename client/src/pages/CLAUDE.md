# Pages Directory

This directory contains the main page components for the Spotify Claude Controller application.

## Page Components

### LandingPage.tsx
- Authentication landing page
- Spotify OAuth login button
- Error message display for failed auth attempts
- Redirects authenticated users to main app

### MainApp.tsx
- Primary application interface
- Natural language command input
- Command history with confidence scores
- Model selection dropdown
- Response display with loading states
- Integration with SpotifyPlayer component
- Weather display integration
- Debug panel (development only)

### Dashboard.tsx
- Comprehensive Spotify data visualization
- 6 section navigation: Overview, Top Items, Library, Recent, Playlists, Insights
- Skeleton loading states for zero layout shift
- See "Spotify Dashboard Feature" section below

### TasteProfile.tsx
- User music taste profile viewer
- Shows exact profile data sent to LLMs
- Refresh button to update cached profile
- See "User Taste Profile Feature" section below

### FeedbackDashboard.tsx
- AI feedback management interface
- Optimistic UI updates without page reloads
- See "AI Feedback Dashboard Feature" section below

## Spotify Dashboard Feature

The dashboard provides comprehensive visualization of user's Spotify data with real-time playback controls.

### Architecture Overview

**Data Flow**:
1. Client requests dashboard data via JWT-authenticated endpoint
2. Server checks Redis cache first (5-minute TTL)
3. If cache miss, fetches from 6 Spotify Web API endpoints in parallel
4. Caches both complete response and individual data structures
5. Returns aggregated data to client

**Caching Strategy**:
- **Full Dashboard Cache**: `dashboard:${userId}` - Complete response (5 min TTL)
- **Individual Data Caches**:
  - `profile:${userId}` - User profile (1 hour TTL)
  - `top:artists:${userId}:${timeRange}` - Top artists by time range (10 min TTL)
  - `top:tracks:${userId}:${timeRange}` - Top tracks by time range (10 min TTL)
  - `saved:tracks:${userId}` - Saved tracks list (5 min TTL)
  - `saved:albums:${userId}` - Saved albums list (5 min TTL)
  - `recently:${userId}` - Recently played tracks (5 min TTL)
  - `playlists:${userId}` - User playlists (10 min TTL)

### Dashboard Components

**Data Visualizations**:
1. **Genre Distribution** - Doughnut chart showing music taste breakdown
2. **Listening Trends** - Line chart for hourly activity patterns
3. **Popularity Trends** - Bar chart for track popularity over time
4. **Timeline View** - Grouped recently played tracks by date/time

**Interactive Features**:
- Play/Queue buttons on all tracks with loading states
- Searchable/sortable saved tracks table with pagination
- Album and playlist grids with hover effects
- Time range selectors (4 weeks, 6 months, all time)

### Spotify API Data Structures

**Understanding Spotify's Response Patterns**:

1. **Paginated Responses** - Used for large collections:
   ```typescript
   {
     items: T[],        // Array of actual data
     total: number,     // Total items available
     limit: number,     // Items per page
     offset: number,    // Current offset
     next: string | null,    // URL for next page
     previous: string | null // URL for previous page
   }
   ```

2. **Time-Range Based Data** - For top items:
   - `short_term`: ~4 weeks
   - `medium_term`: ~6 months  
   - `long_term`: all time

3. **Nested Object Structures**:
   - **Track Object**: Contains nested album and artists
   - **Album Object**: Contains nested artists and images
   - **Playlist Object**: Contains owner info and track count
   - **Recently Played**: Wraps track in played_at context

4. **Common Data Patterns**:
   - Image arrays (always multiple sizes)
   - Artist arrays (for collaborations)
   - External URLs for web player links
   - URIs for playback (format: "spotify:track:id")

### Data Transformation Strategy

**Redis Storage Patterns**:
```typescript
// Full objects for complex data
await redis.setex(`profile:${userId}`, 3600, JSON.stringify(profile))

// Sorted sets for time-based data
await redis.zadd(`recently:${userId}`, 
  tracks.map(t => ({
    score: new Date(t.played_at).getTime(),
    member: JSON.stringify(t)
  }))
)

// Lists for ordered collections  
await redis.lpush(`playlists:${userId}`, 
  ...playlists.map(p => JSON.stringify(p))
)
```

**Key Insights for Handling Spotify Data**:
1. Always check for existence of nested properties (many are optional)
2. Image arrays provide multiple resolutions - pick appropriate size
3. Use URIs for playback, IDs for API calls, external_urls for links
4. Pagination requires recursive fetching for complete datasets
5. Rate limits exist - batch operations where possible
6. Some endpoints have hard limits (e.g., 50 recently played tracks)

## User Taste Profile Feature

The system automatically generates and includes user taste profiles in LLM prompts for more personalized music recommendations.

### How It Works

1. **Profile Generation** (`UserDataService.generateTasteProfile()`):
   - Fetches user's top artists (medium term), top tracks (medium term), and recent listening
   - Calculates weighted genre distribution from top artists
   - Creates a formatted string summarizing musical preferences
   - Caches in Redis for 1 hour to minimize API calls

2. **Profile Content**:
   ```
   User's Music Taste Profile:
   Top Genres: indie rock, alternative rock, dream pop, ...
   Favorite Artists: Beach House, Slowdive, The National, ...
   Recent Favorites: "Space Song" by Beach House; "When the Sun Hits" by Slowdive; ...
   Recent Listening: "Myth" by Beach House; "Sugar for the Pill" by Slowdive; ...
   
   AI Feedback History:
   Loved Discoveries: "Untitled" by Interpol; "Fade Into You" by Mazzy Star; ...
   Disliked Recommendations: "Generic Pop Song" by Artist; ...
   ```

3. **LLM Integration**:
   - Profile is automatically fetched when processing commands
   - Combined with current playback context in the LLM prompt
   - **AI Feedback Integration**: Includes user feedback history on AI-discovered tracks
   - Works with all LLM models (OpenRouter and Gemini)

### Implementation Details

**Cache Key**: `taste:profile:${userId}` (1 hour TTL)

**Requirements**:
- Active Redis connection
- User must have listening history
- Required OAuth scopes: `user-top-read`, `user-read-recently-played`

## AI Feedback Dashboard Feature

The feedback dashboard provides a comprehensive interface for users to manage their AI discovery feedback with advanced UX improvements.

### Key Features & Improvements

**1. Optimistic UI Updates (No Page Reloads)**:
- Feedback changes are applied immediately to local state before API call
- Users see instant visual feedback without waiting for server response
- On API failure, the system gracefully reverts to previous state by reloading data
- Eliminates jarring page refreshes that disrupt user flow

**2. Duplicate Feedback Prevention**:
- Frontend tracking prevents multiple simultaneous submissions for the same track
- Backend duplicate detection ensures data consistency
- Loading states on buttons during submission prevent spam clicks
- `submittingFeedback` state set tracks in-flight requests

**3. Smooth Fade-Out Transitions**:
- Items disappearing from current view (e.g., "pending" moving to "loved") fade out smoothly
- Uses Tailwind v4 transition utilities: `transition-all duration-300`
- Fade animation completes before data structure updates
- Provides visual continuity when items change categories

**4. Feedback Undo Functionality**:
- Users can click the same feedback button again to remove/undo their feedback
- "Love" button becomes "Unlove" when feedback exists, "Dislike" becomes "Un-dislike"
- Tracks return to pending status when feedback is removed
- Enables users to change their mind or correct mistakes

**5. Interactive Button States**:
- Buttons remain clickable even when feedback exists (for undo/change)
- Clear visual indicators show current feedback state
- Different button styles for pending, loved, disliked, and submitting states
- Hover effects guide users on available actions

### Technical Implementation

**Client-Side (FeedbackDashboard.tsx)**:
```typescript
// Optimistic update pattern
const handleFeedback = async (trackUri: string, feedback: 'loved' | 'disliked') => {
  // Prevent duplicate submissions
  if (submittingFeedback.has(trackUri)) return;
  
  // Detect undo operation
  const isUndoing = targetTrack.feedback === feedback;
  
  // Determine if item will disappear from current view
  const willDisappearFromView = /* logic for view filtering */;
  
  // Start fade animation if needed
  if (willDisappearFromView) {
    setFadingOut(prev => new Set(prev).add(trackUri));
  }
  
  // Send API request
  // Wait for fade animation if needed
  // Update local state optimistically
  // Handle errors with graceful fallback
};
```

**CSS Transitions (Tailwind v4)**:
```typescript
className={`transition-all duration-300 ${
  fadingOut.has(track.trackUri) 
    ? 'opacity-0 scale-95 -translate-y-2' 
    : 'opacity-100 scale-100 translate-y-0'
}`}
```

### API Endpoints

**Feedback Management**:
- `POST /api/feedback/ai-discovery` - Record feedback with duplicate handling
  - Supports `feedback: 'loved' | 'disliked' | 'remove'` for undo functionality
- `GET /api/feedback/dashboard` - Comprehensive dashboard data
  - Returns discoveries, loved, disliked tracks with statistics
  - Cached for performance, supports real-time updates

### User Experience Benefits

1. **Instant Responsiveness**: No waiting for server responses
2. **Visual Continuity**: Smooth transitions maintain user context
3. **Error Recovery**: Graceful handling of network issues
4. **Flexibility**: Easy to change or undo feedback decisions
5. **Reliability**: Duplicate prevention ensures data consistency

### Performance Considerations

- **State Management**: Efficient React state updates with Set operations
- **Animation Timing**: 300ms transitions balance smoothness with responsiveness
- **API Optimization**: Background API calls don't block UI updates
- **Memory Management**: Proper cleanup of temporary state sets

## Development Notes

### Common Patterns
- Always check `submittingFeedback` before allowing new submissions
- Use fade-out detection to determine if transitions are needed
- Implement optimistic updates with error fallbacks
- Maintain separation between UI state and persistent data

### Testing Considerations
- Test rapid clicking scenarios to verify duplicate prevention
- Verify smooth transitions when switching between filter views
- Test network failure scenarios to ensure graceful degradation
- Validate undo functionality works correctly across all states

This implementation provides a modern, responsive user experience that feels native and prevents common UI/UX issues found in feedback systems.