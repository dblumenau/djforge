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
- `routes/llm.ts` - Multi-LLM interpretation endpoints (schema-based)
- `routes/simple-llm-interpreter.ts` - Flexible LLM interpreter with taste profile integration
- `routes/direct-action.ts` - Direct action execution with confidence scoring
- `routes/weather.ts` - DMI weather API integration
- `routes/model-preferences.ts` - User model selection preferences
- `routes/llm-logs.ts` - LLM interaction logging (admin only)
- `routes/user-data.ts` - User data endpoints including taste profile

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
- `services/UserDataService.ts` - User data caching and taste profile generation
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
  - `Dashboard.tsx` - Comprehensive Spotify data visualization dashboard
  - `TasteProfile.tsx` - User taste profile viewer showing LLM context
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

1. **OAuth Redirect URI**: Must use `http://127.0.0.1:4001/callback` (NOT localhost)
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
9. **OAuth Scopes Required for Dashboard**:
   - `user-read-private` - User profile data
   - `user-read-email` - User email
   - `user-top-read` - Top artists and tracks
   - `user-library-read` - Saved tracks and albums
   - `user-read-recently-played` - Recently played tracks
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
- Comprehensive Spotify Dashboard with data visualization
- See `docs/TODO.md` for enhancement opportunities

## Known Issues & Solutions

### Token Refresh Race Condition (Fixed)

**Problem**: Multiple components calling `checkAuthStatus()` simultaneously on page load would send multiple refresh requests with the same refresh token, causing Spotify to return a 500 error "Failed to remove token".

**Solution**: Implemented a refresh lock mechanism in `useSpotifyAuth.ts`:
- Global `isRefreshing` flag prevents multiple simultaneous refresh attempts
- Subsequent refresh attempts subscribe to the in-progress refresh result
- Only one refresh request is sent to Spotify at a time

**Key Learning**: Spotify refresh tokens are reusable and long-lived, NOT one-time use. The 500 error was due to our race condition, not a Spotify limitation.

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

**Main Dashboard** (`/dashboard`):
- 6 section navigation: Overview, Top Items, Library, Recent, Playlists, Insights
- Real-time data refresh with progress indicator
- Responsive grid layouts with Tailwind CSS v4

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

### Implementation Details

**Key Files**:
- `server/src/services/UserDataService.ts` - Redis caching and data aggregation
- `server/src/routes/user-data.ts` - JWT-authenticated API endpoints
- `client/src/pages/Dashboard.tsx` - Main dashboard component
- `client/src/components/dashboard/` - Specialized visualization components
- `server/src/types/spotify-data.ts` - TypeScript interfaces for all Spotify data

**API Endpoints**:
- `GET /api/user-data/dashboard` - Aggregated dashboard data
- `GET /api/user-data/top-artists` - Top artists with time range
- `GET /api/user-data/top-tracks` - Top tracks with time range
- `GET /api/user-data/saved-tracks` - Paginated saved tracks
- `GET /api/user-data/saved-albums` - Paginated saved albums
- `GET /api/user-data/recently-played` - Recently played tracks
- `GET /api/user-data/playlists` - User playlists
- `GET /api/user-data/taste-profile` - User's music taste profile for LLM context

**Performance Optimizations**:
- Parallel API calls using Promise.all()
- Structured Redis data types (sorted sets, lists, hashes)
- Lazy loading for large datasets
- Memoized data transformations
- Loading state management to prevent spam clicks

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
   - Found in: saved tracks, saved albums, playlists
   - Handling: Store items array, track total for UI

2. **Time-Range Based Data** - For top items:
   ```typescript
   // Spotify returns different data based on time_range parameter
   time_range: 'short_term' | 'medium_term' | 'long_term'
   // short_term: ~4 weeks
   // medium_term: ~6 months  
   // long_term: all time
   ```
   - Handling: Fetch all 3 ranges in parallel, store separately

3. **Nested Object Structures**:
   - **Track Object**: Contains nested album and artists
   - **Album Object**: Contains nested artists and images
   - **Playlist Object**: Contains owner info and track count
   - **Recently Played**: Wraps track in played_at context

4. **Common Data Patterns**:
   ```typescript
   // Image arrays (always multiple sizes)
   images: [
     { url: string, height: number, width: number },
     // ... typically 3 sizes (640x640, 300x300, 64x64)
   ]
   
   // Artist arrays (for collaborations)
   artists: [
     { id: string, name: string, uri: string }
   ]
   
   // External URLs
   external_urls: {
     spotify: string  // Web player link
   }
   
   // URIs for playback
   uri: string  // Format: "spotify:track:id" or "spotify:album:id"
   ```

5. **Special Handling Cases**:

   **Recently Played Tracks**:
   - Returns max 50 items (Spotify limitation)
   - Each item has `played_at` timestamp and optional `context`
   - Sorted newest first by default
   
   **User Profile**:
   - `product` field indicates free/premium
   - `images` array may be empty
   - `followers` object contains total count
   
   **Saved Items**:
   - Wrapped with `added_at` timestamp
   - Original item nested inside (e.g., `track` or `album`)
   
   **Top Items**:
   - Returns max 50 items per time range
   - Includes popularity scores (0-100)
   - Artists include genre arrays

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

### TypeScript Interface Design

**How We Structured the Types** (`server/src/types/spotify-data.ts`):

```typescript
// Example: Handling nested and optional properties
interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  popularity: number;
  artists: SpotifyArtist[];  // Always an array
  album?: SpotifyAlbum;      // Optional - not on all endpoints
}

// Saved items wrapper pattern
interface SavedTrack {
  added_at: string;          // ISO timestamp
  track: SpotifyTrack;       // Nested actual track
}

// Pagination response pattern
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
}

// Dashboard aggregation
interface UserDashboardData {
  profile: UserProfile;
  topArtists: {
    short_term: SpotifyArtist[];
    medium_term: SpotifyArtist[];
    long_term: SpotifyArtist[];
  };
  savedTracks: PaginatedResponse<SavedTrack>;
  recentlyPlayed: RecentlyPlayedItem[];
  // ... etc
}
```

**Data Processing Examples**:

1. **Handling Optional Images**:
   ```typescript
   // Always use optional chaining and provide fallbacks
   const albumArt = track.album?.images?.[0]?.url || '/default-album.png';
   ```

2. **Genre Aggregation** (from multiple artists):
   ```typescript
   const genreCounts = artists.reduce((acc, artist, index) => {
     const weight = artists.length - index; // Higher weight for top artists
     artist.genres.forEach(genre => {
       acc[genre] = (acc[genre] || 0) + weight;
     });
     return acc;
   }, {});
   ```

3. **Time-based Grouping** (recently played):
   ```typescript
   const groupedByDate = tracks.reduce((acc, track) => {
     const date = new Date(track.played_at).toDateString();
     if (!acc[date]) acc[date] = [];
     acc[date].push(track);
     return acc;
   }, {});
   ```

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
   ```

3. **LLM Integration**:
   - Profile is automatically fetched when processing commands in `simple-llm-interpreter.ts`
   - Combined with current playback context in the LLM prompt
   - Enables personalized recommendations based on actual listening history
   - Works with all LLM models (OpenRouter and Gemini)

4. **User Interface**:
   - New dedicated `/taste-profile` page for users to view their profile
   - Shows the exact profile data that LLMs see
   - Refresh button to update cached profile
   - Accessible via client routing (no direct link in MainApp yet)

5. **API Endpoint**:
   - `GET /api/user-data/taste-profile` - Returns formatted taste profile
   - JWT authenticated
   - Returns cached data when available

### Implementation Details

**Key Files**:
- `server/src/services/UserDataService.ts` - `generateTasteProfile()` method
- `server/src/routes/simple-llm-interpreter.ts` - Integration in command processing
- `server/src/routes/user-data.ts` - REST endpoint for taste profile
- `client/src/pages/TasteProfile.tsx` - User interface for viewing profile
- `client/src/App.tsx` - Route configuration

**Cache Key**: `taste:profile:${userId}` (1 hour TTL)

**Requirements**:
- Active Redis connection
- User must have listening history
- Required OAuth scopes: `user-top-read`, `user-read-recently-played`

### Performance Considerations

- Redis caching prevents repeated API calls
- Generation happens asynchronously during command processing
- Graceful fallback if profile generation fails
- No impact on users without sufficient listening history
- Debug logging tracks profile fetching and inclusion in prompts

This feature enhances the LLM's ability to provide personalized recommendations by understanding the user's actual music preferences rather than relying solely on the command text.

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

## LLM Integration Architecture

The system provides two different interpretation endpoints with distinct approaches:

### 1. **Simple LLM Interpreter** (`/api/llm/simple/command`)
- **Located in**: `routes/simple-llm-interpreter.ts`
- **Approach**: Flexible, prompt-based with loose JSON validation
- **Features**:
  - Personality system (knowledgeable music curator)
  - Robust JSON parsing with multiple fallback strategies
  - Sophisticated conversation context filtering
  - Model fallback chains for reliability
  - Uses `response_format: { type: 'json_object' }` for compatible models
- **Best for**: Natural conversation, music discovery, handling ambiguous requests

### 2. **Schema-based LLM Interpreter** (`/api/llm/command`)
- **Located in**: `routes/llm-interpreter.ts`
- **Approach**: Strict schema validation using Zod
- **Features**:
  - Enforced type safety with predefined schemas
  - Validates all responses against expected intent types
  - Falls back to essential field extraction on validation failure
  - More predictable but less flexible
- **Best for**: Structured commands, reliable intent detection

### LLM Provider Flows

The `LLMOrchestrator` (`services/llm/orchestrator.ts`) manages two provider flows:

#### OpenRouter Flow (Most Models)
- Routes through OpenRouter's unified API
- Supports 30+ different models (GPT-4, Claude, Llama, etc.)
- Uses prompt engineering to request JSON output
- Handles JSON parsing with error recovery

#### Gemini Direct Flow (Google Models)
- Uses Google's native `@google/genai` SDK when available
- Supports structured output with native JSON schemas
- Can enable grounding (web search) for enhanced responses
- Falls back to OpenRouter if direct API fails

### JSON Response Handling

Both interpreters ultimately produce JSON responses, but handle them differently:

- **Simple Interpreter**: Normalizes various response formats, extracts JSON from markdown blocks, handles flexible field names
- **Schema Interpreter**: Expects exact schema compliance, uses Zod for validation, has strict field requirements

The system automatically selects the appropriate flow based on the model and endpoint used.

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