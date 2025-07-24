# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains the **Spotify Claude Controller** - a natural language Spotify controller that allows users to control their Spotify desktop app using conversational commands powered by multiple LLM providers.

**Architecture**: Monorepo with TypeScript throughout
- **Frontend**: React + TypeScript + Vite + Tailwind CSS v4 + React Router
- **Backend**: Node.js + Express + TypeScript + Redis
- **Control**: Hybrid approach using AppleScript (instant control) + Spotify Web API (search/queue/playback)
- **AI**: Multi-LLM architecture with OpenRouter (30+ models) and Google Gemini Direct API
- **Deployment**: Docker + Fly.io ready with production configurations

## Essential Commands

### Development
```bash
# Install all dependencies (run from root)
npm install:all

# Start both server and client (run from root)
npm run dev

# Start server only
cd server && npm run dev

# Start client only  
cd client && npm run dev
```

### Build & Production
```bash
# Build everything (from root)
npm run build

# Build server only
cd server && npm run build

# Build client only
cd client && npm run build

# Start production server
cd server && npm start
```

### Type Checking
```bash
# Check server types
cd server && npx tsc --noEmit

# Check client types
cd client && npx tsc --noEmit
```

## Architecture & Key Components

### Server Architecture (`/server/src/`)

**Entry Point**: `server.ts`
- Express server with Redis session management (file-based fallback)
- CORS configuration for port 5173
- Routes mounted at `/api/*`
- JWT authentication support

**Route Organization**:
- `routes/auth.ts` - OAuth 2.0 with PKCE, token management, JWT support
- `routes/control.ts` - Playback control endpoints
- `routes/llm.ts` - Multi-LLM interpretation endpoints
- `routes/direct-action.ts` - Direct action execution with confidence scoring
- `routes/weather.ts` - DMI weather API integration
- `routes/model-preferences.ts` - User model selection preferences
- `routes/llm-logs.ts` - LLM interaction logging (admin only)

**Services Organization**:
- `services/spotify/`:
  - `AppleScriptController.ts` - macOS Spotify desktop control
  - `SpotifyWebAPI.ts` - Spotify Web API client with auto-refresh
  - `SpotifyControl.ts` - Unified interface combining both approaches
- `services/llm/`:
  - `LLMOrchestrator.ts` - Multi-model orchestration with validation
  - `providers/OpenRouterProvider.ts` - 30+ model support via OpenRouter
  - `providers/GeminiDirectProvider.ts` - Google Gemini Direct API
  - `LLMLogger.ts` - Comprehensive logging system
- `services/ConversationManager.ts` - Context and conversation tracking
- `services/claude/` - Legacy Claude interpreters (deprecated)

**Middleware**:
- `middleware/auth.ts` - Session validation and token refresh

**Configuration**:
- `config/redis.ts` - Redis client configuration with fallback

### Client Architecture (`/client/src/`)

**React Router SPA**: Multiple pages with routing
- `main.tsx` - Entry point with React Router setup
- `App.tsx` - Root component with routing configuration
- OAuth callback handling via React Router loaders

**Pages & Components**:
- `pages/`:
  - `LandingPage.tsx` - Authentication and landing page
  - `MainApp.tsx` - Main application UI with command interface
- `components/`:
  - `MusicLoader.tsx` - Animated loading component
  - `SpotifyPlayer.tsx` - Web Playback SDK integration
  - `WeatherDisplay.tsx` - Weather information display
  - `DebugPanel.tsx` - Development debugging tools
  - `LoadingEllipsis.tsx` - Loading animation

**Hooks**:
- `useSpotifyAuth.ts` - Authentication hook with refresh lock to prevent race conditions

**Services**:
- `api.ts` - Centralized API client with typed endpoints

**Styling**:
- Tailwind CSS v4 with custom Spotify theme colors
- Dark theme with zinc/gray palette
- Responsive design with mobile support

### Critical Implementation Details

1. **OAuth Redirect URI**: Must use `http://127.0.0.1:3001/callback` (NOT localhost)
2. **Session Handling**: Redis-backed sessions with file-based fallback
3. **LLM Integration**: 
   - OpenRouter API key required for 30+ model support
   - Google Gemini API key for Gemini Direct access
   - Dual-path validation system for improved accuracy
4. **Platform**: macOS-only for AppleScript control (Web API works cross-platform)
5. **Token Management**: Automatic refresh with race condition prevention
6. **Refresh Token Behavior**: Spotify refresh tokens are long-lived and reusable (NOT one-time use)
7. **Confidence Scoring**: 1-10 scale for action confidence
8. **Intent Types**: Structured intents with alternatives support

## Environment Configuration

Required `.env` file in project root:
```
# Spotify OAuth
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/callback

# Server Configuration
PORT=3001
SESSION_SECRET=your_session_secret_here
JWT_SECRET=your_jwt_secret_here

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# LLM API Keys
OPENROUTER_API_KEY=your_openrouter_key_here
GOOGLE_GEMINI_API_KEY=your_gemini_key_here

# Weather API (optional)
DMI_WEATHER_LATITUDE=55.6761
DMI_WEATHER_LONGITUDE=12.5683

# Admin Configuration
ADMIN_USER_ID=your_spotify_user_id_here

# Production URLs (for deployment)
VITE_API_URL=https://api.yourdomain.com
VITE_CLIENT_URL=https://yourdomain.com
```

## Working with the Codebase

### Adding New Features
1. Check `docs/TODO.md` for planned features and current status
2. Review `docs/planning/2025_01_11_spotify_claude_controller_plan.md` for architectural decisions
3. Follow existing patterns for routes, services, and components

### Common Development Tasks

**Adding a new control endpoint**:
1. Add route in `server/src/routes/control.ts`
2. Implement in `services/spotify/AppleScriptController` for desktop control
3. Optionally add Web API support in `services/spotify/SpotifyWebAPI`
4. Update `services/spotify/SpotifyControl` to use appropriate backend

**Adding LLM commands**:
1. Update intent types in `types/intent.ts`
2. Add handling in `LLMOrchestrator.ts`
3. Update prompts in LLM providers
4. Map intents to control methods in route handlers

**Adding a new LLM provider**:
1. Create provider in `services/llm/providers/`
2. Implement `BaseLLMProvider` interface
3. Register in `LLMOrchestrator`
4. Add API key to environment variables

**Modifying UI**:
1. Main UI is in `client/src/pages/MainApp.tsx`
2. Use Tailwind utilities for styling
3. Follow existing dark theme patterns
4. Add new routes in `App.tsx` if needed

### Debugging Tips

1. **"Spotify is not running" errors**: Ensure Spotify desktop app is open
2. **Authentication issues**: Check Redis connection, session cookies, and OAuth flow
3. **LLM failures**: 
   - Check API keys in environment variables
   - View LLM logs at `/api/llm-logs` (admin only)
   - Check `llm-logs/` directory for detailed logs
4. **AppleScript permissions**: macOS may require Terminal/iTerm permissions
5. **Token refresh race conditions**: The `useSpotifyAuth` hook includes a refresh lock
6. **Redis connection issues**: Server falls back to file-based sessions automatically
7. **Web Playback SDK**: Requires Spotify Premium account

### Project Status

- Core functionality is complete and working
- Multi-LLM support with 30+ models via OpenRouter
- Production deployment configured for Fly.io
- Docker support for local and production environments
- Basic Jest test infrastructure in place
- See `docs/TODO.md` for enhancement opportunities

## Known Issues & Solutions

### Token Refresh Race Condition (Fixed)

**Problem**: Multiple components calling `checkAuthStatus()` simultaneously on page load would send multiple refresh requests with the same refresh token, causing Spotify to return a 500 error "Failed to remove token".

**Solution**: Implemented a refresh lock mechanism in `useSpotifyAuth.ts`:
- Global `isRefreshing` flag prevents multiple simultaneous refresh attempts
- Subsequent refresh attempts subscribe to the in-progress refresh result
- Only one refresh request is sent to Spotify at a time

**Key Learning**: Spotify refresh tokens are reusable and long-lived, NOT one-time use. The 500 error was due to our race condition, not a Spotify limitation.

## Major Refactor Notes (2025)

The project underwent a significant refactor transitioning from Claude CLI to a multi-LLM architecture:

### Key Changes:
1. **LLM Integration**: Replaced single Claude CLI with OpenRouter (30+ models) and Google Gemini Direct
2. **Production Ready**: Added Docker, Redis, Fly.io deployment configurations
3. **Enhanced Features**: Weather integration, Web Playback SDK, conversation context
4. **Improved Architecture**: Modular service structure, proper routing, typed APIs
5. **Dual Validation**: Two-path LLM validation for improved accuracy

### Migration Considerations:
- Claude CLI code remains in `services/claude/` but is deprecated
- New LLM code is in `services/llm/` with provider abstraction
- API endpoints changed from `/api/claude/*` to `/api/llm/*`
- Intent system now uses structured types with confidence scoring

## Deployment

### Local Development with Docker:
```bash
docker-compose up
```

### Production Deployment:
```bash
# Deploy to Fly.io
fly deploy

# With production compose file
docker-compose -f docker-compose.production.yml up
```

### Docker Services:
- **Redis**: Session storage and caching
- **Server**: Node.js backend on port 3001
- **Client**: Nginx serving React app on port 80

## Testing Strategy

- Jest test infrastructure is set up for both client and server
- Run tests with `npm test` in respective directories
- For manual testing, I will do the testing. Once it's ready just tell me what to test and I will report the results back to you for debugging if necessary