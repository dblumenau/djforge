# Server Source Directory

This directory contains the backend implementation for the Spotify Claude Controller server.

## Directory Structure

```
src/
├── routes/          # Express route handlers
├── services/        # Business logic and external integrations
├── llm/            # LLM integration (multi-provider support)
├── spotify/        # Spotify control and API integration
├── middleware/     # Express middleware (auth, error handling)
├── config/         # Configuration files (Redis, etc.)
├── types/          # TypeScript type definitions
├── utils/          # Utility functions and helpers
└── server.ts       # Main server entry point
```

## Key Components

### Entry Point (server.ts)
- Express server setup with TypeScript
- CORS configuration for client on port 5173
- Session management with Redis (file-based fallback)
- Routes mounted at `/api/*`
- JWT authentication support
- Error handling middleware

### Routes (`/routes/`)
See `/server/src/routes/CLAUDE.md` for detailed route documentation.

Key routes:
- `auth.ts` - OAuth 2.0 with PKCE implementation
- `simple-llm-interpreter.ts` - Main natural language endpoint
- `control.ts` - Spotify playback control
- `user-data.ts` - User data and taste profiles
- `feedback.ts` - AI feedback management

### Services (`/services/`)
See `/server/src/services/CLAUDE.md` for detailed service documentation.

Key services:
- `UserDataService.ts` - User data caching and AI feedback
- `ConversationManager.ts` - Conversation context
- `llm-logging.service.ts` - LLM interaction logging

### LLM Integration (`/llm/`)
See `/server/src/llm/CLAUDE.md` for detailed LLM documentation.

Multi-provider architecture:
- Google Gemini Direct API (primary)
- OpenRouter API (30+ models fallback)
- Unified orchestrator for routing

### Spotify Integration (`/spotify/`)
See `/server/src/spotify/CLAUDE.md` for detailed Spotify documentation.

Hybrid control approach:
- AppleScript for macOS desktop control
- Web API for search, queue, and cross-platform
- Unified interface combining both

### Middleware (`/middleware/`)
- `auth.ts` - JWT validation and token refresh
- Session validation
- Error response formatting

### Configuration (`/config/`)
- `redis.ts` - Redis client setup with fallback

### Types (`/types/`)
See `/server/src/types/CLAUDE.md` for type definitions.

Key types:
- Intent types for LLM responses
- Spotify data interfaces
- User data structures

### Utils (`/utils/`)
See `/server/src/utils/CLAUDE.md` for utility functions.

Common utilities:
- Error handling helpers
- Data transformation functions
- Validation utilities

## Development Workflow

### Running the Server
```bash
cd server
npm run dev      # Development with hot reload
npm run build    # Build TypeScript
npm start        # Production mode
```

### Type Checking
```bash
npx tsc --noEmit  # Check types without building
```

### Testing
```bash
npm test         # Run all tests
npm test -- llm  # Run specific test suite
```

### Environment Variables
Required in `.env` file:
- `SPOTIFY_CLIENT_ID` - Spotify app credentials
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI` - Must be http://127.0.0.1:4001/callback
- `SESSION_SECRET` - Express session secret
- `JWT_SECRET` - JWT signing secret
- `REDIS_URL` - Redis connection (optional)
- `OPENROUTER_API_KEY` - For multi-LLM support
- `GEMINI_API_KEY` - For Gemini Direct API

## Architecture Decisions

### Why Hybrid Spotify Control?
- AppleScript provides instant desktop control
- Web API enables search and cross-platform support
- Unified interface abstracts the complexity

### Why Multi-LLM Architecture?
- Redundancy for reliability
- Access to 30+ models via OpenRouter
- Native structured output with Gemini
- Flexible model selection per user

### Why Redis?
- Session persistence across restarts
- Fast caching for API responses
- Conversation context storage
- Sorted sets for time-based data

### Why TypeScript?
- Type safety across the full stack
- Better IDE support and refactoring
- Self-documenting code
- Catch errors at compile time

## Common Tasks

### Adding a New Route
1. Create file in `/routes/`
2. Define route handlers
3. Add to `server.ts`
4. Update API documentation

### Adding a New Service
1. Create class in `/services/`
2. Use dependency injection
3. Add appropriate types
4. Document in services CLAUDE.md

### Debugging Tips
- Check Redis connection for session issues
- Verify API keys in environment
- Use debug logging for LLM routing
- Monitor AppleScript permissions
- Check CORS for client connection issues

## Performance Considerations
- Cache frequently accessed data
- Use Redis TTLs appropriately
- Batch Spotify API calls
- Monitor LLM token usage
- Use parallel processing where possible