# CLAUDE.md - Routes

This directory contains Express route handlers that define the API endpoints for the Spotify Claude Controller.

## Route Files

### simple-llm-interpreter.ts
- **Endpoint**: `/api/llm/simple/command`
- **Purpose**: Main natural language command processing endpoint
- **Key Features**:
  - Integrates user taste profiles for personalized recommendations
  - Handles both action and conversational intents
  - Supports multiple song queuing (`queue_multiple_songs`)
  - Contextual reference resolution ("play that again")
  - Model fallback chains for reliability
  - **Hierarchical Prompt Structure** (2025-07-27): User requests now take priority over taste profiles
- **Additional Endpoints**:
  - `GET /api/llm/simple/history` - Get conversation history
  - `POST /api/llm/simple/clear-history` - Clear conversation history
  - `POST /api/llm/simple/direct-action` - Direct Spotify actions (bypass LLM)
  - `GET /api/llm/simple/stats` - LLM usage statistics

**Important Update (2025-07-27)**: The prompt structure has been redesigned to prevent taste profiles from overriding specific user requests. The system now uses a hierarchical approach where the user's current request is always prioritized over their historical preferences. See `/server/src/llm/CLAUDE.md` for details on the "Taste Profile Prioritization" implementation.

### llm-interpreter.ts
- **Endpoint**: `/api/llm/command`
- **Purpose**: Schema-based LLM interpretation with strict validation
- **Key Features**:
  - Uses Zod schemas for response validation
  - Dual-path architecture (Gemini Direct + OpenRouter)
  - Strict type safety for predictable behavior
  - Falls back to essential field extraction on validation failure

### user-data.ts
- **Base Path**: `/api/user-data`
- **Purpose**: User data management and dashboard endpoints
- **Endpoints**:
  - `GET /dashboard` - Aggregated dashboard data
  - `GET /profile` - User profile information
  - `GET /top-artists` - Top artists with time range
  - `GET /top-tracks` - Top tracks with time range
  - `GET /saved-tracks` - Paginated saved tracks
  - `GET /saved-albums` - Paginated saved albums
  - `GET /recently-played` - Recently played tracks
  - `GET /playlists` - User playlists
  - `GET /taste-profile` - Generated music taste profile
  - `POST /refresh` - Force refresh all cached data
  - `PUT /saved-tracks` - Add tracks to library (requires trackIds array in body)
  - `DELETE /saved-tracks` - Remove tracks from library (requires trackIds array in body)
  - `GET /saved-tracks/contains` - Check if tracks are saved (requires ids query param)
- **Authentication**: JWT required for all endpoints

### llm-logs.ts
- **Base Path**: `/api/llm-logs`
- **Purpose**: LLM interaction logging and retrieval
- **Endpoints**:
  - `GET /` - Get logs with filtering and pagination
  - `GET /user/:userId` - Get logs for specific user
  - `GET /search` - Search logs by query
  - `GET /stats/daily` - Daily statistics
  - `GET /stats/models` - Model usage statistics
- **Access**: Admin only (checks ADMIN_USER_ID env var)

### model-preferences.ts
- **Base Path**: `/api/model-preference`
- **Purpose**: User LLM model preference management
- **Endpoints**:
  - `GET /` - Get user's current model preference
  - `POST /` - Set user's model preference
  - `DELETE /` - Clear user's model preference

### Other Routes
- `auth.ts` - OAuth 2.0 authentication flow
- `control.ts` - Direct Spotify control endpoints
- `weather.ts` - DMI weather API integration
- `direct-action.ts` - Direct action execution with confidence scoring

### WebSocket Health Endpoint
- **Endpoint**: `GET /api/websocket/health`
- **Purpose**: Monitor WebSocket service health and connections
- **Authentication**: None required (public endpoint)
- **Response Format**:
  ```json
  {
    "status": "healthy",
    "connections": 5,
    "connectionsByIP": {
      "127.0.0.1": 2,
      "192.168.1.10": 3
    },
    "uptime": 3600000
  }
  ```
- **Error Response** (503 Service Unavailable):
  ```json
  {
    "status": "unhealthy",
    "message": "WebSocket service not initialized"
  }
  ```

## Common Patterns

### Authentication
- Most routes use `ensureValidToken` middleware
- JWT tokens extracted from Authorization header
- Token refresh handled automatically

### Error Handling
```typescript
try {
  // Route logic
} catch (error) {
  console.error('Error description:', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Generic error message'
  });
}
```

### Response Format
```typescript
// Success response
{
  success: true,
  data: any,
  cached?: boolean,
  timestamp?: string
}

// Error response
{
  success: false,
  error: string,
  details?: string
}
```

### Redis Integration
- Routes often interact with Redis via services
- User data cached to minimize Spotify API calls
- Conversation history stored for context

## Adding New Routes

1. Create a new router file in this directory
2. Use appropriate middleware (auth, validation)
3. Follow consistent error handling patterns
4. Return consistent response formats
5. Document endpoints and parameters
6. Add to server.ts route mounting
7. Update API client in frontend if needed