# Conversational Context Feature

## Overview

The Spotify Controller now supports conversational context, allowing users to reference previous commands and alternatives in natural language. This feature enables interactions like:

```
User: "play gasoline"
Bot: Playing "Gasoline" by The Weeknd
     Alternatives: Halsey - Gasoline, Haim - Gasoline (ft. Taylor Swift), ...

User: "no the taylor swift one"
Bot: Playing "Gasoline" by Haim (ft. Taylor Swift)
```

## Architecture

### 1. Redis Conversation Storage

Conversations are stored in Redis with the following structure:
- Key pattern: `djforge:conv:{sessionId}`
- Storage type: Redis LIST (newest first)
- Max entries: 8 (configurable)
- TTL: 30 minutes (sliding window)

### 2. Conversation Entry Structure

```typescript
interface ConversationEntry {
  command: string;
  interpretation: {
    intent: string;
    artist?: string;
    track?: string;
    alternatives?: string[];
    // ... other fields
  };
  timestamp: number;
  response?: {
    success: boolean;
    message: string;
  };
}
```

### 3. Context Resolution Process

1. **Check if contextual**: The system identifies contextual references using patterns like:
   - "no the X one"
   - "actually the Y version"
   - "the second one"
   - "try the other one"

2. **Resolve from history**: If contextual, searches previous alternatives for matches

3. **LLM with context**: If not directly resolvable, passes conversation history to LLM

## Implementation Details

### Backend Components

1. **RedisConversation class** (`server/src/utils/redisConversation.ts`)
   - `getHistory(sessionId, limit)`: Fetch recent conversations
   - `append(sessionId, entry)`: Store new conversation
   - `isContextualReference(command)`: Check if command references context
   - `resolveContextualReference(command, history)`: Resolve references

2. **Updated interpretCommand** (`server/src/routes/simple-llm-interpreter.ts`)
   - Fetches conversation history from Redis
   - Pre-processes contextual references
   - Includes CONTEXT block in LLM prompt
   - Stores conversation after processing

### Security Measures

1. **Server-side storage**: Conversation history stored in Redis, not frontend
2. **Input sanitization**: Removes potential injection characters (`{}`)
3. **Session isolation**: Each session has its own conversation history
4. **Automatic expiry**: 30-minute TTL on conversation data

## Usage Examples

### Basic Contextual Reference
```
User: "play gasoline"
System: [Shows The Weeknd's version with alternatives]
User: "no the halsey one"
System: [Plays Halsey's Gasoline]
```

### Ordinal References
```
User: "play something by queen"
System: [Shows Bohemian Rhapsody with alternatives]
User: "the third one"
System: [Plays the third alternative]
```

### Complex References
```
User: "play taylor swift"
System: [Shows Anti-Hero with alternatives]
User: "actually play the one about friendship bracelets"
System: [Understands context and searches alternatives or uses LLM knowledge]
```

## Testing

### Manual Testing
1. Say "play gasoline"
2. Note the alternatives shown
3. Say "no the taylor swift one"
4. Verify it plays Haim - Gasoline (ft. Taylor Swift)

### API Testing
```bash
# First command
curl -X POST http://localhost:3001/api/claude/test-interpret \
  -H "Content-Type: application/json" \
  -b "spotify_session=YOUR_SESSION_ID" \
  -d '{"command": "play gasoline"}'

# Contextual follow-up
curl -X POST http://localhost:3001/api/claude/test-interpret \
  -H "Content-Type: application/json" \
  -b "spotify_session=YOUR_SESSION_ID" \
  -d '{"command": "no the taylor swift one"}'
```

## Performance Considerations

1. **Context limit**: Only last 3 interactions sent to LLM (balances context vs tokens)
2. **Storage limit**: Max 8 entries per session (~8KB memory per active session)
3. **Atomic operations**: Uses Lua script for LPUSH + LTRIM + EXPIRE
4. **Fast resolution**: Direct pattern matching before LLM call

## Future Enhancements

1. **Pronoun resolution**: "play her latest album" after mentioning an artist
2. **Multi-turn clarification**: "which version?" dialogues
3. **Context-aware suggestions**: Better alternatives based on conversation
4. **Cross-session memory**: Optional user preference learning