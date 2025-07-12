# DJForge Testing Guide

## Quick Start Testing

### 1. **Check Server Status**
First, make sure your server is running:
```bash
curl http://localhost:3001/api/health
```
Expected: `{"status":"ok","timestamp":"..."}`

### 2. **Check LLM Models Available**
```bash
curl http://localhost:3001/api/claude/models | jq
```
This should show all available OpenRouter models.

## Testing Music Commands

### 3. **Test Basic Commands via API**

#### Simple Play Command
```bash
curl -X POST http://localhost:3001/api/claude/command \
  -H "Content-Type: application/json" \
  -b "spotify_session=YOUR_SESSION_COOKIE" \
  -d '{"command": "Play Bob Dylans most popular song"}'
```

#### Obscure Song Request
```bash
curl -X POST http://localhost:3001/api/claude/command \
  -H "Content-Type: application/json" \
  -b "spotify_session=YOUR_SESSION_COOKIE" \
  -d '{"command": "Play the most obscure Taylor Swift song"}'
```

#### Mood-Based Request
```bash
curl -X POST http://localhost:3001/api/claude/command \
  -H "Content-Type: application/json" \
  -b "spotify_session=YOUR_SESSION_COOKIE" \
  -d '{"command": "Play something melancholy for a rainy day"}'
```

### 4. **Test via Web Interface**

1. Open http://localhost:5173
2. Login with Spotify if not already logged in
3. Try these test commands in the input field:

#### Basic Controls
- "Play"
- "Pause"
- "Skip"
- "Volume 50"
- "What's playing?"

#### Smart Search Commands
- "Play Like a Rolling Stone by Bob Dylan"
- "Play a lesser known Enya song"
- "Play the original version of Space Oddity not remaster"
- "Queue something that sounds like rain"

#### Complex Requests
- "Play that song from the desert driving scene" (should find "Riders on the Storm")
- "Play the most obscure Pink Floyd track"
- "Play some deep cut Beatles B-sides"
- "Play upbeat 80s music but not the hits"

## Debugging & Monitoring

### 5. **Check Server Logs**
The server logs will show:
- LLM interpretation results
- Which model was used
- Fallback attempts if primary model fails
- Spotify search queries generated

Look for lines like:
```
Processing LLM command: Play bob Dylans most popular song
LLM interpretation: { intent: 'search_and_play', artist: 'Bob Dylan', track: 'Like a Rolling Stone' ... }
LLM search query: "artist:"Bob Dylan" track:"Like a Rolling Stone""
```

### 6. **Test LLM Fallback**
To see fallback in action, you can temporarily modify the default model to a non-existent one:

```javascript
// In /server/src/llm/orchestrator.ts
this.defaultModel = 'fake/model'; // Will trigger fallback chain
```

### 7. **Test Error Handling**
Try these problematic commands:
- Empty command: ""
- Nonsense: "asdfghjkl"
- Ambiguous: "Play that song"
- Non-music: "What's the weather?"

## Web Player Testing

### 8. **Test Spotify Web Player**
The web player component at the top should show:
- "Web Player Ready" initially
- Currently playing track info when music is playing on the web player device

**Note**: The web player only shows tracks playing on the browser device, not on other Spotify devices. To test:
1. In Spotify app, switch playback to "DJForge Web Player" device
2. Or use the transfer playback API endpoint

## Advanced Testing

### 9. **Test Different Models**
You can specify which model to use by modifying the request:

```javascript
// In test-specific code
const request = createSchemaRequest(
  SYSTEM_PROMPTS.MUSIC_INTERPRETER,
  "Play obscure jazz",
  MusicCommandSchema,
  OPENROUTER_MODELS.CLAUDE_3_5_SONNET // Use a different model
);
```

### 10. **Monitor API Usage**
Check your OpenRouter dashboard at https://openrouter.ai to monitor:
- API usage
- Token consumption
- Model performance
- Cost tracking

## Common Issues & Solutions

### Issue: "No active device found"
**Solution**: Make sure Spotify is open on at least one device (desktop app, mobile, or web player)

### Issue: Web player shows nothing
**Solution**: 
1. Music is playing on a different device
2. Transfer playback to web player: click on device icon in Spotify and select "DJForge Web Player"

### Issue: Commands not working
**Check**:
1. Server is running: `npm run dev` in server directory
2. You're logged in (check browser cookies)
3. OpenRouter API key is valid in `.env`
4. Check server logs for specific errors

### Issue: "All LLM providers failed"
**Solution**: 
1. Check your OpenRouter API key
2. Check OpenRouter service status
3. Check if you have credits/balance

## Performance Testing

### 11. **Test Response Times**
```bash
time curl -X POST http://localhost:3001/api/claude/command \
  -H "Content-Type: application/json" \
  -b "spotify_session=YOUR_SESSION_COOKIE" \
  -d '{"command": "Play Beatles"}'
```

Expected times:
- Simple commands: 500-1500ms
- Complex queries: 1-3 seconds
- With fallbacks: 3-10 seconds

### 12. **Test Concurrent Requests**
Open multiple browser tabs and send different commands simultaneously to test the system under load.

## What to Look For

✅ **Success Indicators**:
- Commands are interpreted correctly
- Music plays/pauses/skips as expected
- Obscure song requests find appropriate tracks
- Mood-based queries return relevant music
- Command history shows in the UI

❌ **Failure Indicators**:
- "Error processing command" messages
- No response after 10+ seconds
- Wrong interpretation of commands
- Fallback chain exhausted errors

Happy testing! 🎵