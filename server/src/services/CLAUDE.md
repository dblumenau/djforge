# CLAUDE.md - Services

This directory contains service classes that encapsulate business logic and external integrations.

## Service Files

### UserDataService.ts
- **Primary Purpose**: User data caching, taste profile generation, and AI feedback management
- **Key Features**:
  - Generates music taste profiles from listening history
  - Caches all Spotify user data in Redis with appropriate TTLs
  - Provides aggregated dashboard data
  - Manages paginated data fetching
  - Tracks AI-discovered music and user feedback
  - Integrates feedback into taste profiles for continuous learning
- **Redis Keys**:
  - `taste:profile:{userId}` - Generated taste profile (1 hour TTL)
  - `user:{userId}:profile` - User profile data (2 hours TTL)
  - `user:{userId}:top_artists:{timeRange}` - Top artists by time range
  - `user:{userId}:top_tracks:{timeRange}` - Top tracks by time range
  - `user:{userId}:saved_tracks:{limit}:{offset}` - Paginated saved tracks
  - `user:{userId}:recently_played` - Recently played tracks (30 min TTL)
  - `user:{userId}:ai_discoveries` - AI-discovered tracks list
  - `user:{userId}:ai_loved` - Loved AI discoveries (sorted set)
  - `user:{userId}:ai_disliked` - Disliked AI discoveries (sorted set)

### ConversationManager.ts
- **Primary Purpose**: Redis-backed conversation history management
- **Key Features**:
  - Tracks user commands and LLM interpretations
  - Provides context for follow-up commands
  - Manages dialog state for contextual understanding
  - Filters conversation history for relevant music context
  - Resolves contextual references ("play that again")
- **Redis Keys**:
  - `conversation:{userId}` - Conversation history list
  - `dialog:state:{userId}` - Current dialog state
  - `user:{userId}:model_preference` - User's preferred LLM model

### llm-logging.service.ts
- **Primary Purpose**: Comprehensive LLM interaction logging
- **Key Features**:
  - Logs all LLM requests and responses
  - Tracks model usage, latency, and token consumption
  - Provides queryable logs by date, user, model, or flow
  - Exposes Redis client for other services (like taste profile)
- **Redis Keys**:
  - `llm:log:{logId}` - Individual log entries
  - `llm:logs:{date}` - Daily sorted sets of log IDs
  - `llm:user:{hashedUserId}:logs` - User-specific log index
  - `llm:stats:daily:{date}` - Daily statistics

### websocket.service.ts
- **Primary Purpose**: Real-time bidirectional communication with Socket.IO
- **Key Features**:
  - **Authentication Required**: All connections must provide a valid session ID
  - Session validation via Redis through WebSocketAuth helper
  - User-specific connection tracking in addition to IP-based rate limiting
  - TypeScript-first with full type safety for events
  - Namespace-based organization (`/demo` namespace)
  - Automatic reconnection handling
- **Security & Rate Limiting**:
  - Maximum 10 connections per IP address
  - Maximum 100 pings per client connection
  - Session-based authentication with Redis validation
  - Tracks connections both per-IP and per-user
- **Events**:
  - `ping` - Client-initiated latency check with callback
  - `randomString` - Server broadcast of random strings
  - `connectionStatus` - Connection state updates
  - `error` - Error notifications with codes
- **Configuration**:
  - Configurable CORS origins for development/production
  - WebSocket and polling transport support
  - 60s ping timeout, 25s ping interval
- **Redis Integration**:
  - Uses WebSocketAuth for session validation
  - Falls back to no-auth mode if Redis unavailable (development only)

### claude/ (Directory)
- Legacy Claude CLI integration (deprecated)
- Kept for reference but no longer used
- New LLM integration is in `/llm/` directory

## Key Patterns

### Singleton Pattern
- ConversationManager uses singleton pattern with Redis client injection
- Ensures consistent conversation tracking across requests

### Redis Integration
- All services use Redis for persistence and caching
- Keys follow consistent patterns for easy management
- TTLs set appropriately for each data type:
  - User profiles: 2 hours
  - Top items: 1 hour
  - Recently played: 30 minutes
  - Taste profiles: 1 hour
  - Conversation history: 24 hours

### Error Handling
- Services gracefully handle external service failures
- Always provide fallback behavior when Redis is unavailable
- Log errors but don't crash the application
- Return sensible defaults when data isn't available

### Performance Optimization
- Parallel data fetching using Promise.all()
- Strategic caching to minimize Spotify API calls
- Paginated responses for large datasets
- Sorted sets and lists for efficient data retrieval

## AI Feedback System

The system includes an intelligent feedback mechanism that learns from user preferences to improve future AI music recommendations.

### How It Works

1. **AI Discovery Detection**: When the LLM makes a creative choice (not an explicit user request), it sets `isAIDiscovery: true` and provides `aiReasoning`

2. **Automatic Tracking**: These AI-discovered tracks are automatically tracked in Redis with user feedback capabilities

3. **Individual Song Tracking**: For `queue_multiple_songs` operations, each song gets individual tracking and feedback buttons rather than treating the batch as a single discovery

4. **Feedback Integration**: User feedback (loved/disliked) is included in future taste profiles sent to LLMs, creating a learning loop

### Redis Data Structure

```typescript
// Current format (JSON objects)
{
  trackUri: string,           // Spotify URI for the track
  trackName: string,          // Track name
  artist: string,             // Artist name(s)
  discoveredAt: number,       // Timestamp of discovery
  reasoning: string,          // AI's reasoning for the choice
  feedback?: 'loved' | 'disliked',  // User feedback
  feedbackAt?: number,        // Feedback timestamp
  previewUrl?: string         // 30-second preview URL
}

// Redis Keys:
// user:${userId}:ai_discoveries - List of all discoveries
// user:${userId}:ai_loved - Sorted set of loved tracks
// user:${userId}:ai_disliked - Sorted set of disliked tracks
```

### Data Format Compatibility

The system handles both current and legacy data formats:
- **Current**: JSON objects (structured data with full metadata)
- **Legacy**: Pipe-separated strings (`trackUri|trackName|artist|reasoning`)
- The `getAIFeedback()` method automatically detects and parses both formats

### Key Implementation Details

**Multiple Song Tracking**: Fixed bug where `queue_multiple_songs` only tracked the first song. Now each song in a multi-song queue gets:
- Individual discovery entry in Redis
- Separate feedback buttons in the UI
- Independent tracking metadata

**Feedback Integration in Taste Profiles**: Fixed bug where AI feedback wasn't being included in LLM context due to data parsing issues. Now properly includes:
- "Loved Discoveries: [song list]"
- "Disliked Recommendations: [song list]"

**Backward Compatibility**: System gracefully handles both JSON and pipe-separated data formats for smooth transitions.

### API Integration

The AI feedback system integrates with several key components:

1. **Track Discovery** (`trackAIDiscovery` method):
   ```typescript
   await userDataService.trackAIDiscovery(
     userId,
     trackUri,
     trackName,
     artistName,
     aiReasoning,
     previewUrl
   );
   ```

2. **Record Feedback** (`recordAIFeedback` method):
   ```typescript
   await userDataService.recordAIFeedback(
     userId,
     trackUri,
     feedback // 'loved' | 'disliked' | 'remove'
   );
   ```

3. **Get Feedback Dashboard** (`getAIFeedbackDashboard` method):
   ```typescript
   const dashboard = await userDataService.getAIFeedbackDashboard(userId);
   // Returns: { discoveries, loved, disliked, stats }
   ```

### Debugging AI Feedback

**Common Issues**:
- AI feedback not appearing in taste profiles → Check `getAIFeedback()` parsing logic
- Multiple songs getting single feedback button → Verify individual `trackAIDiscovery()` calls
- Feedback not persisting → Check Redis connection and data format compatibility

**Debug Commands**:
```bash
# Check discoveries
redis-cli LRANGE "user:${userId}:ai_discoveries" 0 10

# Check feedback
redis-cli ZRANGE "user:${userId}:ai_loved" 0 -1
```

This creates a continuous improvement cycle where the AI learns from user preferences to provide increasingly personalized music recommendations.

## Adding New Services

1. Create a new TypeScript class in this directory
2. Use dependency injection for external dependencies (Redis, APIs)
3. Implement proper error handling and logging
4. Add appropriate TypeScript types in `/types/`
5. Follow Redis key naming conventions
6. Set appropriate cache TTLs based on data volatility
7. Document the service purpose and usage
8. Add unit tests for critical functionality