# Spotify Claude Controller - TODO List

## ✅ Completed

### Core Infrastructure
- [x] Initialize Node.js/TypeScript project structure
- [x] Set up Spotify app registration and get credentials
- [x] Implement OAuth PKCE flow for Spotify authentication
- [x] Enable login button and test OAuth flow
- [x] Build command input interface after login
- [x] Add Claude natural language interpretation via CLI

### Basic Controls
- [x] Test play/pause/skip/volume controls
- [x] Get current track info

### Advanced Features
- [x] Integrate Spotify Web API for search
- [x] Test search functionality with real commands
- [x] Implement queue management features

### Authentication Improvements
- [x] Implement refresh token handling
  - Store tokens properly with timestamp
  - Auto-refresh when expired (50 min check)
  - Avoid re-authentication on every session

### UI/UX Enhancements
- [x] Add animated loading state with music notes
  - Shows while Claude is thinking (10 seconds)
  - Animated music notes in thought bubbles
  - Send button disabled during processing
  - Groovy dancing notes animation!
- [x] Two-column layout with Tailwind CSS
  - Command input on left (narrow)
  - Command history on right (wide)
  - Dark theme with rounded panels
  - Spotify green accents

## 🚧 In Progress

Nothing currently in progress!

### Recently Completed (Session 2)
- [x] Enhanced Claude interpreter with deep music knowledge
- [x] Obscure/rare track detection using Claude's knowledge + Spotify popularity scores
- [x] Version disambiguation (original vs remix/remaster)
- [x] Cultural reference understanding (movie/TV songs)
- [x] Basic mood query support
- [x] Confidence scoring for interpretations

## 📋 Up Next

### Performance & Caching
- [ ] Cache common commands for faster responses
  - "play", "pause", "skip" → instant local response
  - Only use Claude for complex queries
  - Store command → intent mappings

### Advanced Search Features
- [ ] Real-time web search for cultural references
  - Integrate with movie/TV databases
  - Search for "song from X scene" dynamically
- [ ] Spotify Audio Features integration
  - Use tempo, energy, valence for mood matching
  - Create mood profiles for better suggestions
- [ ] Multi-language support
  - Handle commands in other languages
  - Search for international music

### Timer Features
- [ ] Implement timed commands
  - "Pause in 5 minutes"
  - "Play music at 3pm"
  - "Stop after this song"
  - Auto-resume after timed pause

### Current Track Display
- [ ] Show now playing info in UI
  - Track name, artist, album
  - Progress bar
  - Album artwork
  - Auto-refresh every few seconds

### Error Handling
- [ ] Add comprehensive error handling
  - Better error messages for users
  - Retry logic for failed API calls
  - Handle Spotify app not running gracefully
  - Handle network errors

### Additional Features (Future)
- [ ] Mood-based playlists ("play happy music")
- [ ] Voice control integration
- [ ] Multi-room/device support
- [ ] Playlist management
- [ ] Lyrics display
- [ ] Music recommendations based on listening history
- [ ] Shuffle/repeat toggle in UI
- [ ] Volume slider in UI

## 🐛 Known Issues
- 10-second delay for Claude processing (inherent to Claude CLI)
- Need to grant macOS permissions for AppleScript on first run
- Session doesn't persist between server restarts
- Large search results can overflow in history

## 💡 Ideas for V2
- Show album art in UI
- Add keyboard shortcuts (Cmd+Enter to send, etc.)
- Create "DJ mode" with automatic song selection
- Integration with Apple Music / YouTube Music
- Save favorite commands
- Command autocomplete/suggestions
- Spotify Connect device selection
- Export playlists based on commands

## 🎉 What's Working Great
- Natural language understanding ("play that dancey Taylor Swift song")
- Search and play specific tracks
- Queue management
- OAuth with automatic token refresh
- Beautiful animated loading state
- Clean two-column layout
- Instant AppleScript controls
- Full Spotify Web API integration