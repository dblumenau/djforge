# CLAUDE.md - Services

This directory contains service classes that encapsulate business logic and external integrations.

## Service Files

### UserDataService.ts
- **Primary Purpose**: User data caching and taste profile generation
- **Key Features**:
  - Generates music taste profiles from listening history
  - Caches all Spotify user data in Redis with appropriate TTLs
  - Provides aggregated dashboard data
  - Manages paginated data fetching
- **Redis Keys**:
  - `taste:profile:{userId}` - Generated taste profile (1 hour TTL)
  - `user:{userId}:profile` - User profile data (2 hours TTL)
  - `user:{userId}:top_artists:{timeRange}` - Top artists by time range
  - `user:{userId}:top_tracks:{timeRange}` - Top tracks by time range
  - `user:{userId}:saved_tracks:{limit}:{offset}` - Paginated saved tracks
  - `user:{userId}:recently_played` - Recently played tracks (30 min TTL)

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

## Adding New Services

1. Create a new TypeScript class in this directory
2. Use dependency injection for external dependencies (Redis, APIs)
3. Implement proper error handling and logging
4. Add appropriate TypeScript types in `/types/`
5. Follow Redis key naming conventions
6. Set appropriate cache TTLs based on data volatility
7. Document the service purpose and usage
8. Add unit tests for critical functionality