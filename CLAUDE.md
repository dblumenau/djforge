# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains the **Spotify Claude Controller** - a natural language Spotify controller that allows users to control their Spotify desktop app using conversational commands powered by Claude CLI.

**Architecture**: Monorepo with TypeScript throughout
- **Frontend**: React + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Node.js + Express + TypeScript
- **Control**: Hybrid approach using AppleScript (instant control) + Spotify Web API (search/queue)
- **AI**: Claude CLI integration for natural language understanding

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
- Express server with session management
- CORS configuration for port 5173
- Routes mounted at `/api/*`

**Route Organization**:
- `routes/auth.ts` - OAuth 2.0 with PKCE, token management
- `routes/control.ts` - Playback control endpoints
- `routes/claude.ts` - Natural language command processing

**Services**:
- `services/AppleScriptController.ts` - macOS Spotify desktop control
- `services/SpotifyWebAPI.ts` - Spotify Web API client with auto-refresh
- `services/SpotifyControl.ts` - Unified interface combining both approaches
- `services/ClaudeInterpreter.ts` - Claude CLI integration for NLP

**Middleware**:
- `middleware/auth.ts` - Session validation and token refresh

### Client Architecture (`/client/src/`)

**Single Page App**: `App.tsx` contains entire application
- Connection checking → Authentication → Command interface
- State managed with React hooks
- Direct fetch calls to backend API

**Components**:
- `MusicLoader.tsx` - Animated loading component
- `MainApp.tsx` - Main application UI with command interface

**Hooks**:
- `useSpotifyAuth.ts` - Authentication hook with refresh lock to prevent race conditions

**Styling**:
- Tailwind CSS v4 with custom Spotify theme colors
- Dark theme with zinc/gray palette

### Critical Implementation Details

1. **OAuth Redirect URI**: Must use `http://127.0.0.1:3001/callback` (NOT localhost)
2. **Session Handling**: Express-session with specific cookie settings for 127.0.0.1
3. **Claude CLI**: Requires system-level installation (`claude` command must be available)
4. **Platform**: macOS-only due to AppleScript dependency
5. **Token Management**: Automatic refresh with race condition prevention
6. **Refresh Token Behavior**: Spotify refresh tokens are long-lived and reusable (NOT one-time use)

## Environment Configuration

Required `.env` file in project root:
```
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/callback
PORT=3001
SESSION_SECRET=your_session_secret_here
```

## Working with the Codebase

### Adding New Features
1. Check `docs/TODO.md` for planned features and current status
2. Review `docs/planning/2025_01_11_spotify_claude_controller_plan.md` for architectural decisions
3. Follow existing patterns for routes, services, and components

### Common Development Tasks

**Adding a new control endpoint**:
1. Add route in `server/src/routes/control.ts`
2. Implement in `AppleScriptController` for desktop control
3. Optionally add Web API support in `SpotifyWebAPI`
4. Update `SpotifyControl` to use appropriate backend

**Adding Claude commands**:
1. Update prompt in `ClaudeInterpreter.ts`
2. Add new intent types if needed
3. Map intents to control methods

**Modifying UI**:
1. All UI code is in `client/src/App.tsx`
2. Use Tailwind utilities for styling
3. Follow existing dark theme patterns

### Debugging Tips

1. **"Spotify is not running" errors**: Ensure Spotify desktop app is open
2. **Authentication issues**: Check session cookies and OAuth flow
3. **Claude command failures**: Check Claude CLI is installed and accessible
4. **AppleScript permissions**: macOS may require Terminal/iTerm permissions
5. **Token refresh race conditions**: The `useSpotifyAuth` hook includes a refresh lock to prevent multiple simultaneous refresh attempts

### Project Status

- Core functionality is complete and working
- See `docs/TODO.md` for enhancement opportunities
- No test infrastructure currently exists
- Production deployment not yet configured

## Known Issues & Solutions

### Token Refresh Race Condition (Fixed)

**Problem**: Multiple components calling `checkAuthStatus()` simultaneously on page load would send multiple refresh requests with the same refresh token, causing Spotify to return a 500 error "Failed to remove token".

**Solution**: Implemented a refresh lock mechanism in `useSpotifyAuth.ts`:
- Global `isRefreshing` flag prevents multiple simultaneous refresh attempts
- Subsequent refresh attempts subscribe to the in-progress refresh result
- Only one refresh request is sent to Spotify at a time

**Key Learning**: Spotify refresh tokens are reusable and long-lived, NOT one-time use. The 500 error was due to our race condition, not a Spotify limitation.

## Testing Strategy

- For testing, in general, I will do the testing. Once it's ready just tell me what to test and I will report the results back to you for debugging if necessary