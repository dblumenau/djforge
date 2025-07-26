# CLAUDE.md - Server

This file provides guidance to Claude Code when working with the server-side code of the Spotify Claude Controller.

## Server Architecture Overview

The server is a Node.js + Express + TypeScript application that provides a REST API for controlling Spotify through natural language commands. It uses a dual-path LLM architecture for robust intent parsing.

## Key Components

### LLM Architecture (`/src/llm/`)

**Dual-Path Architecture**: The system uses two LLM paths for maximum reliability:

1. **Gemini Direct API** (`/src/llm/providers/GeminiService.ts`)
   - Uses `@google/genai` v1.9.0 with native structured output
   - Leverages `responseSchema` for guaranteed JSON structure
   - Optimized for speed and reliability

2. **OpenRouter API** (`/src/llm/orchestrator.ts`)
   - Fallback path using various models (GPT-4, Claude, etc.)
   - Prompt engineering with Zod schema validation
   - Provides model flexibility and redundancy

**Schema System**:
- `gemini-schemas.ts` - Native Gemini schemas using Type enum
- `schemas.ts` - Zod schemas for OpenRouter path
- `intent-types.ts` - Shared TypeScript interfaces
- `intent-validator.ts` - Validation and drift detection between paths

### Intent Types (Current)

The system uses these specific intent types:
- `'play_specific_song'` - Play a specific track immediately
- `'queue_specific_song'` - Add a specific track to queue
- `'queue_multiple_songs'` - Add multiple tracks to queue (5-10 songs)
- `'play_playlist'` - Play a playlist immediately
- `'queue_playlist'` - Add playlist to queue
- `'chat'` - General music discussion (conversational, no Spotify action)
- `'ask_question'` - Questions about music/artists (conversational)
- `'get_playback_info'` - Get current playback information
- `'play'`, `'pause'`, `'skip'`, `'previous'` - Basic playback controls
- `'set_volume'` - Volume control (requires volume_level field)
- `'set_shuffle'`, `'set_repeat'` - Playback mode controls
- `'clear_queue'` - Clear the playback queue
- `'get_devices'`, `'get_playlists'`, `'get_recently_played'` - Information queries
- `'search'` - Search without playing
- `'unknown'` - Fallback for unparseable commands

**IMPORTANT**: The following deprecated intents have been completely removed:
- ❌ `'search_and_play'` (use `'play_specific_song'`)
- ❌ `'search_and_queue'` (use `'queue_specific_song'`)
- ❌ `'queue_add'` (use `'queue_specific_song'`)
- ❌ `'queue'` (use `'queue_specific_song'`)

### Routes (`/src/routes/`)

**Primary Endpoints**:
- `simple-llm-interpreter.ts` - Main natural language endpoint (`/api/llm/simple/command`)
  - Integrates user taste profiles for personalized recommendations
  - Handles conversational intents (chat, ask_question)
  - Supports queue_multiple_songs for batch queuing
- `llm-interpreter.ts` - Advanced LLM endpoint with strict schema validation
- `user-data.ts` - User data endpoints including taste profile (`/api/user-data/*`)
- `model-preferences.ts` - User model preference management
- `llm-logs.ts` - LLM interaction logging and retrieval

**Key Route Features**:
- Automatic model routing (Gemini vs OpenRouter)
- Conversation context management via Redis
- Intent validation and normalization
- Spotify API integration with error handling
- User taste profile integration in LLM prompts

### Services (`/src/services/`)

**Key Services**:
- `UserDataService.ts` - User data caching and taste profile generation
  - Generates music taste profiles from top artists/tracks
  - Manages Redis caching for all user data
  - Provides dashboard data aggregation
- `ConversationManager.ts` - Redis-backed conversation history
- `llm-logging.service.ts` - Comprehensive LLM interaction logging
  - Stores all LLM requests/responses
  - Provides Redis client access for taste profiles

### Spotify Integration (`/src/spotify/`)

- `control.ts` - Main Spotify controller interface
- `api.ts` - Spotify Web API wrapper with auto-refresh
- `applescript.ts` - macOS desktop app control
- `auth.ts` - OAuth 2.0 PKCE authentication

## Development Guidelines

### Working with LLM Code

1. **Always validate intents** - Use `intent-validator.ts` to ensure both paths produce identical results
2. **Update both schema systems** - Changes to `gemini-schemas.ts` must be reflected in `schemas.ts`
3. **Test dual-path validation** - Run `npm test -- --testNamePattern="Dual Path Validation"` after changes
4. **Monitor for schema drift** - The validator prevents inconsistencies between LLM paths

### Common Development Tasks

**Adding new intent types**:
1. Add to `intent-types.ts` interfaces
2. Update `gemini-schemas.ts` enum
3. Update `schemas.ts` Zod schema
4. Add validation tests in `dual-path-validation.test.ts`
5. Update route handlers in `simple-llm-interpreter.ts`

**Modifying system prompts**:
- Gemini: Update `GEMINI_SYSTEM_PROMPTS` in `gemini-schemas.ts`
- OpenRouter: Update `SYSTEM_PROMPTS` in `schemas.ts`
- Keep prompts focused on task, not JSON formatting (native structured output handles format)

**Debugging LLM issues**:
1. Check orchestrator logs for model routing decisions
2. Verify intent validation results
3. Compare outputs between Gemini and OpenRouter paths
4. Use `dual-path-validation.test.ts` to isolate issues

### Environment Setup

Required environment variables:
```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:4001/callback
PORT=4001   
SESSION_SECRET=your_session_secret
REDIS_URL=redis://localhost:6379
OPENROUTER_API_KEY=your_openrouter_key
GEMINI_API_KEY=your_gemini_key
```

### Build and Test Commands

```bash
# Build TypeScript
npm run build

# Run all tests
npm test

# Run dual-path validation tests only (30 tests should pass)
npm test -- --testNamePattern="Dual Path Validation"

# Run development server
npm run dev

# Type check only
npx tsc --noEmit
```

### Test Results Status

**Dual-Path Validation Tests**: ✅ **30/30 PASSING**
- All intent validation tests pass
- Schema compatibility confirmed
- System prompt consistency verified
- Performance tests within acceptable limits
- Edge cases handled correctly

**Expected Test Output**: 
- Console.error messages during tests are **expected** - they show the validator correctly rejecting invalid inputs
- Jest warnings about `moduleNameMapping` are cosmetic and can be ignored
- **NOTE**: Removed broken `GeminiService.test.ts` that was testing non-existent static methods (part of previous developer's incomplete work)

**Key Validation Confirmations**:
- ✅ Deprecated intents (`search_and_play`, `queue_add`, `search_and_queue`) properly rejected
- ✅ Current intent types properly validated
- ✅ Both Gemini and OpenRouter paths produce identical results
- ✅ Schema drift detection working correctly

### Important Notes

1. **Platform Dependency**: Server requires macOS for AppleScript integration
2. **API Key Management**: Never commit API keys; use environment variables
3. **Session Handling**: Uses express-session with Redis for persistence
4. **CORS Configuration**: Configured for development client on port 5173
5. **Model Routing**: Gemini is preferred for speed; OpenRouter for fallback

### Troubleshooting

**Common Issues**:
- "Spotify is not running" → Ensure Spotify desktop app is open
- LLM validation failures → Check intent-validator.ts for schema changes
- Redis connection errors → Verify Redis server is running
- AppleScript permissions → Grant Terminal/iTerm accessibility permissions

**Performance Tips**:
- Gemini Direct API is faster than OpenRouter
- Use conversation context sparingly to reduce token usage
- Monitor API usage via orchestrator logging
- Cache frequently used queries where possible

### Code Quality Standards

- All LLM code must pass dual-path validation tests
- TypeScript strict mode enabled
- Comprehensive error handling for all API calls
- Consistent logging format across components
- Intent validation required for all LLM responses

This server provides a robust, production-ready backend for natural language Spotify control with redundant LLM paths and comprehensive validation.