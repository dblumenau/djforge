# Context Handling and Conversation History

This document explains how the Spotify Claude Controller manages conversation context and history to provide intelligent, context-aware responses.

## Overview

The system uses a sophisticated context management approach that balances providing relevant information to the LLM while avoiding context pollution. This ensures accurate intent recognition and appropriate responses based on the user's command type.

## Conversation History Storage

### Redis-based Storage
- Conversations are stored in Redis with a 24-hour TTL
- Each session maintains its own conversation history
- Dialog state tracks the last music action separately from conversation history

### Data Structure
```typescript
interface ConversationEntry {
  command: string;
  interpretation: {
    intent: string;
    artist?: string;
    track?: string;
    query?: string;
    confidence: number;
    alternatives?: string[];
  };
  timestamp: number;
  response: {
    success: boolean;
    message: string;
  };
}

interface DialogState {
  last_action: {
    type: 'play' | 'queue';
    intent: string;
    artist?: string;
    track?: string;
    album?: string;
    query?: string;
    timestamp: number;
    alternatives?: string[];
  } | null;
  last_candidates: string[];
  interaction_mode: 'music' | 'chat';
  updated_at: number;
}
```

## Context Retrieval Strategy

### For Command Interpretation

1. **Maximum Fetch**: 8 previous messages from history
   ```typescript
   conversationManager.getHistory(sessionId, 8)
   ```

2. **Smart Filtering**: Applied via `getRelevantContext()` method
   - **Similarity requests** ("queue similar stuff"): Returns only the last music action (1 message)
   - **Standard requests**: Returns up to 2 most recent messages
   - **Contextual references** ("no the taylor swift one"): Includes relevant entries with alternatives

3. **Typical LLM Context**: 1-2 messages after filtering

### For Conversational Queries

1. **Maximum Fetch**: 5 previous messages
   ```typescript
   conversationManager.getHistory(sessionId, 5)
   ```

2. **Context Window**: Last 3 messages used in prompt
   ```typescript
   conversationHistory.slice(-3)
   ```

## Smart Context Filtering Algorithm

The `getRelevantContext()` method implements intelligent filtering:

```typescript
getRelevantContext(command: string, history: ConversationEntry[], dialogState: DialogState | null): ConversationEntry[] {
  // For similarity requests, only return last music action
  if (this.isSimilarityRequest(command) && dialogState?.last_action) {
    // Returns single entry with last played/queued item
  }
  
  // For contextual references, include entries with alternatives
  if (this.isContextualReference(command)) {
    // Returns entries that had alternatives shown
  }
  
  // Default: return last 2 entries
  return history.slice(0, 2);
}
```

## Intent-Specific Context Handling

### Music Control Commands
- Receives filtered context (1-2 messages)
- Focuses on recent music actions
- Includes alternatives from previous searches

### Playlist Requests
- Gets minimal context to avoid confusion
- Primarily relies on current command

### Conversational Intents
- Receives more context (last 3 messages)
- Includes current music state
- Enables informed responses about recent activity

## Context Pollution Prevention

### Problem Solved
Previously, commands like "queue a playlist with similar stuff" would combine unrelated context from multiple conversations (e.g., The Weeknd + Taylor Swift + J-pop), resulting in incorrect recommendations.

### Solution
1. **Dialog State Tracking**: Separate tracking of last music action
2. **Smart Filtering**: Context relevance based on command intent
3. **Time-boxed Windows**: 24-hour TTL on conversation history
4. **Clear History Option**: User can manually clear context when needed

## LLM Context Format

### Command Interpretation Context
```
CONVERSATION CONTEXT:
[1] User: "play gasoline"
    Intent: play_specific_song
    Artist: Halsey
    Track: Gasoline
    Alternatives shown: The Weeknd - Gasoline, Daddy Yankee - Gasolina, ...

[2] User: "no the taylor swift one"
    Intent: play_specific_song
    Artist: Taylor Swift
    Track: Gasoline
```

### Conversational Query Context
```
Recent conversation:
User: "play gasoline" → Halsey - Gasoline
User: "no the taylor swift one" → Taylor Swift - Gasoline
User: "play something for assassins creed" → Yasunori Mitsuda - Scars of Time

Recent music context: Currently playing "Scars of Time" by Yasunori Mitsuda
```

## Performance Considerations

- Redis operations are async and parallelized
- Context filtering happens before LLM calls
- Minimal context reduces token usage and improves response time
- Smart filtering improves accuracy while reducing costs

## User Controls

### Clear History Endpoint
- `POST /api/claude/clear-history`
- Clears both conversation history and dialog state
- Available via UI button
- Useful for starting fresh contexts

### Session Management
- Each browser session maintains separate history
- Sessions persist across page reloads
- 24-hour automatic expiration