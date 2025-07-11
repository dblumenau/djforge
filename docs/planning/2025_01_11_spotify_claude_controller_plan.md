# Spotify Claude Controller - Comprehensive Planning Document

## Date: 2025-01-11
## Project: Natural Language Spotify Controller

---

## 1. ORIGINAL VISION & REQUIREMENTS

### User's Request
"I want to make an app where you, Claude Code, control and even DJ my Spotify"

### Refined Requirements
- Control existing Spotify desktop app on macOS
- Natural language commands interpreted by Claude
- Examples:
  - "Play that dancey Taylor Swift song" → Plays "Shake It Off"
  - "Queue up some chill jazz"
  - "Volume up"
  - "Pause for 2 minutes" → Auto-resume after delay
  - "What's playing?"

### Key Constraints
1. Spotify instance already running on user's laptop
2. Same machine as the app and Claude Code
3. Text-based commands (not voice)
4. Must handle Spotify's 2025 OAuth requirements

---

## 2. RESEARCH FINDINGS (from Zen Deep Analysis)

### Authentication Landscape (2025)
- **OAuth Required**: Username/password deprecated mid-2024
- **PKCE Flow Mandatory**: For security
- **Redirect URI Rules**:
  - Must use `127.0.0.1` (not `localhost`)
  - HTTP allowed only for loopback addresses
  - Format: `http://127.0.0.1:PORT/path`

### Available Control Methods Analysis

#### Option 1: ncspot (Terminal Client)
- ✅ Most actively maintained (v1.3.0 Dec 2024)
- ❌ Replaces desktop Spotify (not what we want)
- ❌ IPC socket not suitable for our use case

#### Option 2: spotify-tui
- ❌ Abandoned June 2022
- ❌ Disabled in Homebrew
- ❌ OpenSSL dependency issues

#### Option 3: shpotify (AppleScript)
- ✅ Controls existing desktop Spotify
- ✅ Maintained through 2025
- ✅ Simple, reliable for basic controls
- ❌ Limited to basic playback commands

#### Option 4: Spotify Web API
- ✅ Full search capabilities
- ✅ Queue management
- ✅ Rich metadata
- ❌ Can't directly control desktop app
- ❌ 1-2 second latency

### Chosen Solution: HYBRID APPROACH
Combine AppleScript + Spotify Web API for best of both worlds

---

## 3. ARCHITECTURE DESIGN

### System Flow (UPDATED with Claude CLI)
```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Web UI        │────▶│  Node.js     │────▶│  Claude CLI     │
│  (React)        │     │   Server     │ pipe│  (local binary) │
└─────────────────┘     └──────┬───────┘     └─────────────────┘
                               │
                   ┌───────────┴───────────┐
                   ▼                       ▼
           ┌──────────────┐       ┌────────────────┐
           │ AppleScript  │       │ Spotify Web    │
           │ (osascript)  │       │     API        │
           └──────┬───────┘       └────────┬───────┘
                  │                        │
                  ▼                        ▼
           ┌──────────────┐       ┌────────────────┐
           │   Desktop    │       │    Search,     │
           │   Spotify    │       │    Queue,      │
           │    App       │       │   Metadata     │
           └──────────────┘       └────────────────┘
```

### Claude CLI Integration
- Use `claude` command via child process
- Pipe format: `echo "command" | claude -p 'prompt' --output-format json`
- Parse JSON response to extract intent and parameters
- No API key needed - uses existing Claude Code auth

### Decision Matrix
| Command Type | Method | Why |
|-------------|---------|-----|
| Play/Pause/Skip | AppleScript | Instant (<50ms) |
| Volume Control | AppleScript | No API latency |
| Search Songs | Web API | Full catalog access |
| Queue Management | Web API | Not available via AppleScript |
| Current Track Info | AppleScript | Faster than API |
| Recommendations | Web API | AI features |

---

## 4. TECHNICAL IMPLEMENTATION PLAN

### Phase 1: Foundation (COMPLETED ✅)
- [x] Project structure (TypeScript, Node.js, React)
- [x] Spotify app registration
- [x] OAuth PKCE implementation
- [x] AppleScript control module
- [x] Basic Express server

### Phase 2: Authentication Flow (COMPLETED ✅)
- [x] Enable login button
- [x] Test OAuth flow end-to-end
- [x] Session management
- [ ] Token refresh handling (future enhancement)

### Phase 3: Core UI
- [ ] Command input interface
- [ ] Current track display
- [ ] Command history
- [ ] Visual feedback

### Phase 4: Basic Controls
- [ ] Test AppleScript integration
- [ ] Play/Pause/Skip working
- [ ] Volume control
- [ ] Error handling for "Spotify not running"

### Phase 5: Smart Features
- [ ] Spotify Web API search
- [ ] Natural language parsing
- [ ] Queue management
- [ ] "Similar songs" feature

### Phase 6: Claude Integration (UPDATED)
- [x] Decision: Use Claude CLI via pipe interface
- [ ] Implement command piping through `claude` CLI
- [ ] Parse JSON responses from Claude
- [ ] Handle ambiguous requests
- [ ] Context awareness

---

## 5. CURRENT STATUS & BLOCKERS

### What's Working
1. ✅ Full project structure created
2. ✅ OAuth PKCE flow implemented and TESTED
3. ✅ AppleScript module complete
4. ✅ Spotify app registered with correct redirect URI
5. ✅ User has added credentials to .env
6. ✅ Authentication flow working perfectly
7. ✅ Session persistence with 127.0.0.1

### Current Status
- User successfully authenticated with Spotify
- Ready to build command interface
- Planning to use Claude CLI for natural language processing

### Immediate Next Steps
1. Build command input interface (text box + submit)
2. Implement Claude CLI integration
3. Test basic commands (play/pause)
4. Add current track display

---

## 6. KEY CODE COMPONENTS

### AppleScript Integration (applescript.ts)
```typescript
// Direct control of desktop Spotify
await executeScript('tell application "Spotify" to play')
await executeScript(`tell application "Spotify" to play track "${uri}"`)
```

### OAuth Flow (auth.ts)
```typescript
// PKCE implementation
const codeVerifier = generateCodeVerifier()
const codeChallenge = generateCodeChallenge(codeVerifier)
// Redirect to Spotify auth
```

### Command Interpretation via Claude CLI
```typescript
// Example: User types "play that dancey Taylor Swift song"
const command = "play that dancey Taylor Swift song";
const prompt = `Interpret this Spotify command and return JSON: ${command}`;

// Execute: echo "play that dancey Taylor Swift song" | claude -p '...' --output-format json
// Claude returns:
{
  "intent": "search_and_play",
  "query": "Taylor Swift upbeat dance",
  "confidence": 0.9,
  "alternatives": ["Shake It Off", "Love Story", "Blank Space"]
}

// Direct commands like "pause" return:
{
  "intent": "pause",
  "confidence": 1.0
}
```

---

## 7. RISKS & MITIGATIONS

### Risk: macOS Sequoia Compatibility
- **Impact**: Spotify desktop app issues
- **Mitigation**: AppleScript unaffected, our approach still works

### Risk: Spotify API Changes
- **Impact**: Breaking changes to OAuth/endpoints
- **Mitigation**: Following 2025 guidelines, using official SDKs

### Risk: AppleScript Limitations
- **Impact**: Can't do advanced features
- **Mitigation**: Hybrid approach with Web API

---

## 8. SUCCESS METRICS

### MVP Success Criteria
- [ ] User can log in with Spotify
- [ ] "play [song]" works reliably
- [ ] Basic controls (pause, skip, volume) work
- [ ] Natural language variations understood
- [ ] Graceful error handling

### Stretch Goals
- [ ] Queue management
- [ ] Playlist control
- [ ] Timed actions (pause for X minutes)
- [ ] Music recommendations
- [ ] Command shortcuts/aliases

---

## 9. QUESTIONS FOR USER

1. **Claude Integration**: ✅ DECIDED - Use Claude CLI via pipe interface
2. **UI Preferences**: Minimal or feature-rich interface?
3. **Command Style**: Prefer natural language or accept shortcuts?
4. **Error Handling**: How verbose should error messages be?

---

## 10. DEVELOPMENT WORKFLOW

### Daily Progress Tracking
Use TodoWrite tool to track implementation progress

### Testing Strategy
1. Manual testing of each component
2. OAuth flow validation
3. AppleScript command verification
4. End-to-end command flow

### Documentation
- README.md for setup
- API documentation
- Command examples
- Troubleshooting guide

---

## APPENDIX: File Structure

```
spotify-claude-controller/
├── server/
│   ├── src/
│   │   ├── server.ts         # Main server
│   │   ├── spotify/
│   │   │   ├── api.ts        # Web API wrapper
│   │   │   ├── auth.ts       # OAuth PKCE
│   │   │   ├── applescript.ts # Desktop control
│   │   │   └── control.ts    # Route handlers
│   │   ├── claude/
│   │   │   └── interpreter.ts # NLP parsing
│   │   └── types/
│   │       └── index.ts      # TypeScript types
├── client/
│   ├── src/
│   │   ├── App.tsx          # Main UI
│   │   └── components/      # React components
└── docs/
    └── planning/
        └── 2025_01_11_spotify_claude_controller_plan.md
```

---

## NEXT IMMEDIATE ACTION

Build the command input interface in React and implement Claude CLI integration for natural language processing.