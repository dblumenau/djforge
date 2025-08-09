# LLM Intents Summary - DJ Forge

## Overview
This document summarizes all available intents in the DJ Forge LLM system (excluding the GPT-5 directory) and their mappings to Spotify functions. The system uses a dual-path architecture with Google Gemini Direct API and OpenRouter for robust intent parsing.

## Intent Categories

### 1. Play Intents
These intents immediately start playback, replacing the current queue.

#### `play_specific_song`
- **Purpose**: Play a specific track immediately
- **Required Fields**:
  - `artist` (string) - Artist name
  - `track` (string) - Track name
- **Optional Fields**:
  - `album` (string) - Album name for disambiguation
  - `alternatives` (array) - Alternative suggestions
  - `enhancedQuery` (string) - Enhanced search query
- **Spotify Function**: `spotifyControl.searchAndPlay(query, artist, track, album)`
- **Example**: "Play Bohemian Rhapsody by Queen"

#### `play_playlist`
- **Purpose**: Play a playlist immediately
- **Required Fields**:
  - `query` (string) - Playlist name or search term
- **Optional Fields**:
  - `enhancedQuery` (string) - Enhanced search query
  - `alternatives` (array) - Alternative playlists
- **Spotify Function**: `spotifyControl.searchAndPlayPlaylist(query)`
- **Example**: "Play my Discover Weekly"

#### `play`
- **Purpose**: Resume playback
- **Required Fields**: None
- **Spotify Function**: `spotifyControl.play()`
- **Example**: "Play" or "Resume"

### 2. Queue Intents
These intents add tracks to the queue without interrupting current playback.

#### `queue_specific_song`
- **Purpose**: Add a specific track to the queue
- **Required Fields**:
  - `artist` (string) - Artist name
  - `track` (string) - Track name
- **Optional Fields**:
  - `album` (string) - Album name for disambiguation
  - `alternatives` (array) - Alternative suggestions
  - `enhancedQuery` (string) - Enhanced search query
- **Spotify Function**: `spotifyControl.queueTrack(query, artist, track, album)`
- **Example**: "Queue Stairway to Heaven by Led Zeppelin"

#### `queue_multiple_songs`
- **Purpose**: Queue multiple tracks (5-10 songs)
- **Required Fields**:
  - `songs` (array) - Array of song objects with artist/track
- **Optional Fields**:
  - `theme` (string) - Theme or mood of the selection
  - `alternatives` (array) - Alternative songs
- **Spotify Function**: Multiple calls to `spotifyControl.queueTrackByUri(uri)`
- **Example**: "Queue some 80s rock hits"

#### `queue_playlist`
- **Purpose**: Add a playlist to the queue
- **Required Fields**:
  - `query` (string) - Playlist name or search term
- **Optional Fields**:
  - `enhancedQuery` (string) - Enhanced search query
  - `alternatives` (array) - Alternative playlists
- **Spotify Function**: `spotifyControl.searchAndQueuePlaylist(query)`
- **Example**: "Queue my workout playlist"

### 3. Playback Control Intents
These intents control the current playback state.

#### `pause`
- **Purpose**: Pause playback
- **Required Fields**: None
- **Spotify Function**: `spotifyControl.pause()`
- **Example**: "Pause"

#### `skip` / `next`
- **Purpose**: Skip to next track
- **Required Fields**: None
- **Spotify Function**: `spotifyControl.skip()`
- **Example**: "Skip this song" or "Next"

#### `previous` / `back`
- **Purpose**: Go to previous track
- **Required Fields**: None
- **Spotify Function**: `spotifyControl.previous()`
- **Example**: "Previous song" or "Go back"

#### `resume`
- **Purpose**: Resume playback (alias for play)
- **Required Fields**: None
- **Spotify Function**: `spotifyControl.play()`
- **Example**: "Resume playback"

#### `set_volume` / `volume`
- **Purpose**: Set playback volume
- **Required Fields**:
  - `volume_level` (number 0-100) - Volume level
- **Optional Fields**:
  - `value` (number) - Alternative volume field
- **Spotify Function**: `spotifyControl.setVolume(level)`
- **Example**: "Set volume to 50"

#### `set_shuffle`
- **Purpose**: Enable/disable shuffle mode
- **Required Fields**:
  - `enabled` (boolean) - Whether to enable shuffle
- **Spotify Function**: `spotifyControl.setShuffle(enabled)`
- **Example**: "Turn on shuffle"

#### `set_repeat`
- **Purpose**: Enable/disable repeat mode
- **Required Fields**:
  - `enabled` (boolean) - Whether to enable repeat
- **Spotify Function**: `spotifyControl.setRepeat(enabled)`
- **Example**: "Enable repeat"

#### `clear_queue`
- **Purpose**: Clear the playback queue
- **Required Fields**: None
- **Spotify Function**: `spotifyControl.clearQueue()`
- **Example**: "Clear the queue"

### 4. Information Intents
These intents retrieve information without changing playback.

#### `get_current_track`
- **Purpose**: Get information about currently playing track
- **Required Fields**: None
- **Spotify Function**: `spotifyControl.getCurrentTrack()`
- **Example**: "What's playing?"

#### `get_playback_info`
- **Purpose**: Get detailed playback information
- **Required Fields**: None
- **Spotify Function**: `spotifyControl.getCurrentTrack()` with extended info
- **Example**: "Show playback info"

#### `get_devices`
- **Purpose**: List available playback devices
- **Required Fields**: None
- **Spotify Function**: `spotifyControl.getDevices()`
- **Example**: "Show my devices"

#### `get_playlists`
- **Purpose**: List user's playlists
- **Required Fields**: None
- **Spotify Function**: `spotifyControl.getPlaylists()`
- **Example**: "Show my playlists"

#### `get_recently_played`
- **Purpose**: Get recently played tracks
- **Required Fields**: None
- **Spotify Function**: `spotifyControl.getRecentlyPlayed()`
- **Example**: "What did I listen to recently?"

#### `search`
- **Purpose**: Search for tracks without playing
- **Required Fields**:
  - `query` (string) - Search query
- **Optional Fields**:
  - `enhancedQuery` (string) - Enhanced search query
  - `alternatives` (array) - Alternative results
- **Spotify Function**: `spotifyControl.search(query)`
- **Example**: "Search for Pink Floyd songs"

### 5. Conversational Intents
These intents handle non-action responses and music discussions.

#### `chat`
- **Purpose**: General music discussion without Spotify action
- **Required Fields**:
  - `message` (string) - Response to show user
- **Optional Fields**:
  - `query` (string) - Original user query
- **Spotify Function**: None (returns text response only)
- **Example**: "Tell me about jazz history"

#### `ask_question`
- **Purpose**: Answer questions about music/artists
- **Required Fields**:
  - `answer` (string) - Answer to show user
- **Optional Fields**:
  - `query` (string) - Original question
- **Spotify Function**: None (returns text response only)
- **Example**: "Who influenced The Beatles?"

#### `explain_reasoning`
- **Purpose**: Explain the system's reasoning or choices
- **Required Fields**:
  - `explanation` (string) - Explanation text
- **Optional Fields**:
  - `query` (string) - Original query
- **Spotify Function**: None (returns text response only)
- **Example**: "Why did you choose that song?"

#### `unknown`
- **Purpose**: Fallback for unparseable commands
- **Optional Fields**:
  - `query` (string) - Original query
  - `message` (string) - Error or clarification message
- **Spotify Function**: None (returns error/clarification)
- **Example**: Commands that can't be understood

### 6. Deprecated Intents (Removed)
These intents have been removed from the system:
- ❌ `search_and_play` → Use `play_specific_song`
- ❌ `search_and_queue` → Use `queue_specific_song`
- ❌ `queue_add` → Use `queue_specific_song`
- ❌ `queue` → Use `queue_specific_song`

## Intent Resolution Flow

1. **User Input** → Natural language command
2. **LLM Processing** → Gemini or OpenRouter model interprets intent
3. **Schema Validation** → Zod schemas validate the response structure
4. **Intent Canonicalization** → Normalizes intent variations to standard forms
5. **Spotify Function Call** → Maps to appropriate control function
6. **Response Generation** → Returns success/failure with appropriate message

## Key Features

### Taste Profile Integration
- User's music preferences are integrated into prompts
- Hierarchical prioritization: User request > Taste profile
- Helps with vague requests like "play something good"

### Alternative Suggestions
- Many intents support `alternatives` field
- Provides fallback options if primary choice fails
- Enhances user experience with multiple options

### Conversation Context
- System maintains conversation history via Redis
- Enables contextual references like "play that again"
- Limited to recent entries to reduce token usage

### Multi-Model Support
- 30+ models available via OpenRouter
- Gemini Direct for fastest response
- User can select preferred model
- Fail-fast approach with no automatic retries

## Implementation Files

- **Intent Schemas**: `/server/src/llm/schemas/intents/`
- **Route Handler**: `/server/src/routes/simple-llm-interpreter.ts`
- **Spotify Control**: `/server/src/spotify/control.ts`
- **LLM Orchestrator**: `/server/src/llm/orchestrator.ts`
- **Conversation Manager**: `/server/src/services/ConversationManager.ts`

## Usage Examples

### Playing Music
```
"Play Hotel California by Eagles" → play_specific_song
"Play my chill playlist" → play_playlist
"Resume" → play
```

### Queue Management
```
"Queue some Beatles songs" → queue_multiple_songs
"Add Wonderwall to queue" → queue_specific_song
"Queue my party playlist" → queue_playlist
```

### Control
```
"Skip" → skip
"Turn up the volume to 70" → set_volume
"Enable shuffle" → set_shuffle
```

### Information
```
"What's playing?" → get_current_track
"Show my playlists" → get_playlists
"Search for Radiohead" → search
```

### Conversation
```
"Tell me about Motown" → chat
"Who produced this album?" → ask_question
"Why did you pick this song?" → explain_reasoning
```

## Notes for GPT-5 Migration

When migrating to the GPT-5 responses API system:

1. **Intent Structure**: Current system uses flat intent objects with specific fields per intent type
2. **Validation**: Heavy reliance on Zod schemas for type safety
3. **Context Management**: Conversation history stored in Redis with user-specific keys
4. **Taste Profiles**: Generated from user's top artists/tracks and integrated into prompts
5. **Error Handling**: Fail-fast approach with clear error messages
6. **Alternative Flows**: Support for alternative suggestions when primary choice fails
7. **Canonicalization**: Intent normalization handles variations and fuzzy matching

The GPT-5 system's function calling and streaming capabilities could enhance:
- Real-time feedback during search operations
- Progressive loading of queue operations
- More complex multi-step workflows
- Better error recovery with function retry logic