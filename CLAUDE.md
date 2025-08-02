# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains the **Spotify Claude Controller** - a natural language Spotify controller that allows users to control their Spotify desktop app using conversational commands powered by multiple LLM providers.

**Architecture**: Monorepo with TypeScript throughout
- **Frontend**: React + TypeScript + Vite + Tailwind CSS v4 + React Router
- **Backend**: Node.js + Express + TypeScript + Redis + Socket.IO v4
- **Control**: Hybrid approach using AppleScript (instant control) + Spotify Web API (search/queue/playback)
- **AI**: Multi-LLM architecture with OpenRouter (30+ models) and Google Gemini Direct API
- **Real-time**: Authenticated WebSocket with Socket.IO for secure bidirectional communication
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

**IMPORTANT FOR CLAUDE**: NEVER run `npm run dev` yourself - the user ALWAYS has it running already! The dev server runs continuously and doesn't exit. If you need to test changes, simply inform the user that the server needs to be restarted, or check if hot-reload has already applied your changes.

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
# Check both server and client types (run from root)
npm run type-check

# Check server types only
cd server && npx tsc --noEmit

# Check client types only
cd client && npx tsc --noEmit
```

## Project Structure & Documentation

### Server (`/server/`)
- **Main Documentation**: `/server/CLAUDE.md` - Server architecture and dual-path LLM validation
- **Source Code**: `/server/src/CLAUDE.md` - Backend implementation details
- **Routes**: `/server/src/routes/CLAUDE.md` - API endpoint documentation
- **Services**: `/server/src/services/CLAUDE.md` - Business logic and AI feedback system
- **LLM Integration**: `/server/src/llm/CLAUDE.md` - Multi-provider LLM architecture
- **Spotify Control**: `/server/src/spotify/CLAUDE.md` - Hybrid control implementation
- **Types**: `/server/src/types/CLAUDE.md` - TypeScript interfaces
- **Utils**: `/server/src/utils/CLAUDE.md` - Utility functions

### Client (`/client/`)
- **Main Documentation**: `/client/CLAUDE.md` - Frontend architecture
- **Source Code**: `/client/src/CLAUDE.md` - React application structure
- **Pages**: `/client/src/pages/CLAUDE.md` - Dashboard, taste profile, and feedback features
- **Components**: `/client/src/components/CLAUDE.md` - Reusable components
- **Skeletons**: `/client/src/components/skeletons/CLAUDE.md` - Zero layout shift loading states
- **Dashboard Components**: `/client/src/components/dashboard/CLAUDE.md` - Data visualization
- **Hooks**: `/client/src/hooks/CLAUDE.md` - Custom React hooks
- **Types**: `/client/src/@types/CLAUDE.md` - Client-side TypeScript definitions

## Key Features

### Natural Language Control
- Multi-LLM support with 30+ models via OpenRouter
- Google Gemini Direct API for structured output
- Conversation context and taste profile integration
- Confidence scoring for command interpretation

### Spotify Integration
- Hybrid control: AppleScript for desktop + Web API for search/queue
- Real-time playback controls
- Dashboard with comprehensive data visualization
- Web Playback SDK support

### User Experience
- **Modern Chat Interface**: ChatGPT-style conversational UI with chronological message flow
  - Fixed header navigation bar with device/model selectors
  - Fixed bottom input area with floating send button
  - Responsive design with mobile hamburger menu
  - Minimizable horizontal playback controls
- **Skeleton Loading System**: Zero layout shift with motion-safe animations  
  See `/client/src/components/skeletons/CLAUDE.md` for implementation details
- **AI Feedback System**: Learning from user preferences  
  See `/server/src/services/CLAUDE.md` for backend implementation
- **Dashboard Features**: Spotify data visualization and insights  
  See `/client/src/pages/CLAUDE.md` for frontend details
- **WebSocket Demo**: Authenticated real-time communication showcase (requires login)  
  See `/client/src/hooks/CLAUDE.md` for useWebSocket hook implementation  
  See `/server/src/auth/CLAUDE.md` for WebSocket authentication details

### Critical Implementation Details

1. **OAuth Redirect URI**: Must use `http://127.0.0.1:4001/callback` (NOT localhost)
2. **Session Handling**: Redis-backed sessions with file-based fallback
3. **Platform**: macOS-only for AppleScript control (Web API works cross-platform)
4. **Token Management**: Automatic refresh with race condition prevention
5. **OAuth Scopes Required**:
   - `user-read-private`, `user-read-email` - User profile
   - `user-top-read` - Top artists and tracks
   - `user-library-read` - Saved tracks and albums
   - `user-library-modify` - Add/remove tracks from library
   - `user-read-recently-played` - Recently played
   - `playlist-read-private` - User playlists
   - `user-modify-playback-state` - Playback control
   - `streaming` - Web Playback SDK

## Environment Configuration

Required `.env` file in project root:
```
# Spotify OAuth
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:4001/callback

# Server Configuration
PORT=4001
SESSION_SECRET=your_session_secret_here
JWT_SECRET=your_jwt_secret_here

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# LLM API Keys
OPENROUTER_API_KEY=your_openrouter_key_here
GEMINI_API_KEY=your_gemini_key_here

# Weather API (optional)
DMI_WEATHER_LATITUDE=55.6761
DMI_WEATHER_LONGITUDE=12.5683

# Admin Configuration
ADMIN_USER_ID=your_spotify_user_id_here

# Production URLs (for deployment)
VITE_API_URL=https://api.yourdomain.com
VITE_CLIENT_URL=https://yourdomain.com
```

## Common Development Tasks

### Adding New Features
- Check `docs/TODO.md` for planned features
- Review architectural decisions in subdirectory CLAUDE.md files
- Follow existing patterns for consistency

### Quick Reference

**Adding a new control endpoint**:
See `/server/src/routes/CLAUDE.md` for route patterns

**Adding LLM commands**:
See `/server/src/llm/CLAUDE.md` for intent handling

**Modifying UI components**:
See `/client/src/components/CLAUDE.md` for component patterns

**Working with Spotify data**:
See `/client/src/pages/CLAUDE.md` for data structures and caching

**Implementing WebSocket features**:
- See `/server/src/services/CLAUDE.md` for WebSocket service architecture
- See `/server/src/auth/CLAUDE.md` for authentication requirements
- See `/client/src/services/CLAUDE.md` for client-side socket implementation

### Debugging Tips

1. **"Spotify is not running" errors**: Ensure Spotify desktop app is open
2. **Authentication issues**: Check Redis connection and OAuth flow
3. **LLM failures**: Check API keys and `/server/src/llm/CLAUDE.md`
4. **Token refresh issues**: See "Known Issues" below
5. **Skeleton loading issues**: See `/client/src/components/skeletons/CLAUDE.md`
6. **AI feedback issues**: See `/server/src/services/CLAUDE.md`
7. **WebSocket connection issues**: Check session validity, `/api/websocket/health` endpoint, and Socket.IO logs

## Known Issues & Solutions

### Token Refresh Race Condition (Fixed)
- **Problem**: Multiple components refreshing tokens simultaneously
- **Solution**: Refresh lock in `useSpotifyAuth.ts`
- **Learning**: Spotify refresh tokens are reusable, not one-time

For more issues and solutions, check relevant subdirectory CLAUDE.md files.

## LLM Integration Architecture

The system provides flexible LLM integration with two interpretation approaches:
- **Simple Interpreter**: Natural conversation with taste profiles
- **Schema-based Interpreter**: Strict validation for reliability

See `/server/src/llm/CLAUDE.md` for complete LLM documentation.

## Deployment

### Local Development with Docker:
```bash
docker-compose up
```

### Production Deployment:
```bash
fly deploy
```

### Docker Services:
- **Redis**: Session storage and caching
- **Server**: Node.js backend on port 3001
- **Client**: Nginx serving React app on port 80

## Testing Strategy

- Jest infrastructure configured
- Run tests with `npm test` in respective directories
- Manual testing feedback to Claude for debugging

## Project Status

- ✅ Core functionality complete
- ✅ Multi-LLM support with 30+ models
- ✅ Production deployment ready
- ✅ Comprehensive dashboard
- ✅ AI feedback system
- ✅ Skeleton loading system
- 📋 See `docs/TODO.md` for enhancements

## Major Refactor Notes (2025)

Transitioned from single Claude CLI to multi-LLM architecture:
- OpenRouter integration for 30+ models
- Google Gemini Direct API support
- Enhanced features: weather, Web SDK, conversation context
- Production-ready with Docker and Redis

## Navigation Guide for Claude

When working on specific areas, refer to these key documentation files:

1. **Backend Development**: Start with `/server/CLAUDE.md`
2. **Frontend Development**: Start with `/client/CLAUDE.md`
3. **LLM/AI Features**: See `/server/src/llm/CLAUDE.md`
4. **UI Components**: See `/client/src/components/CLAUDE.md`
5. **Data & Caching**: See `/server/src/services/CLAUDE.md`
6. **Dashboard Features**: See `/client/src/pages/CLAUDE.md`

Each subdirectory contains its own CLAUDE.md with domain-specific details.