# GPT-5 Context Handling - Implementation & Testing Guide

## Overview

This document describes the implementation of native message history support for GPT-5/OpenAI models and provides a comprehensive guide for testing and refining the context handling system.

## Problem Statement

GPT-5 wasn't maintaining conversation context properly. When users said "tell me about Taylor Swift" followed by "play some of her stuff", it didn't understand "her" referred to Taylor Swift. The conversation history was being stuffed into the system prompt instead of using OpenAI's native message history format.

## Solution Implemented

Converted the system to use native message history (alternating user/assistant messages) instead of cramming context into system prompts.

## Changes Made

### 1. OpenAIProvider.ts (`/server/src/llm/providers/OpenAIProvider.ts`)

- **Added `parseConversationContext()` method** (lines 469-517): Parses conversation context strings into proper message objects
- **Updated `formatMessagesForOpenAI()` method** (line 371+): Now accepts full request object and builds proper message arrays with history
- **Modified `complete()` method** (lines 82-103): Removed conversation context extraction for system prompt, now only extracts taste profile
- **Key change**: Messages are now structured as:
  ```typescript
  [
    { role: 'system', content: 'Instructions and schema...' },
    { role: 'user', content: 'previous command 1' },
    { role: 'assistant', content: 'previous response 1' },
    { role: 'user', content: 'current command' }
  ]
  ```

### 2. simple-llm-interpreter.ts (`/server/src/routes/simple-llm-interpreter.ts`)

- **Added `buildMessageHistory()` function** (lines 260-312): Converts ConversationEntry objects to proper message format
- **Updated `interpretCommand()` function**: 
  - Changed from using `formatMusicHistory()` to `buildMessageHistory()` (line 376)
  - Removed conversation context from system prompt generation (lines 395-411)
  - Now builds full message arrays with conversation history (lines 413-418)
  - Removed `conversationContext` parameter from orchestrator call (lines 420-426)
- **Exported `interpretCommand` function** for reuse in test endpoint

### 3. LLM Orchestrator (`/server/src/llm/orchestrator.ts`)

- Added deprecation warnings for legacy `conversationContext` parameter
- Updated to properly pass extended message arrays to all providers
- Added logging for debugging message array handling
- Maintained backward compatibility

### 4. Test Endpoint (`/server/src/routes/llm-test.ts`)

- Created new test route for easy LLM testing without React app
- **Endpoints**:
  - `POST /api/llm/test` - Send command and get interpretation
  - `DELETE /api/llm/test` - Clear conversation history
  - `GET /api/llm/test` - View current conversation
- **Features**:
  - Uses actual `interpretCommand` function from server
  - Stores conversation in `/tmp/llm-test-conversation.json`
  - Maintains conversation state across requests
  - Returns detailed interpretation results
- **Mounted** in server.ts at `/api/llm/test`

## How the System Now Works

1. **Conversation Storage**: Each interaction is stored with command, interpretation, and response
2. **Message Building**: When a new command comes in, previous conversations are converted to user/assistant message pairs
3. **Native Format**: OpenAI receives proper message arrays, not text blocks in system prompt
4. **Test Flow**:
   ```bash
   # Clear and start fresh
   curl -X DELETE http://localhost:4001/api/llm/test
   
   # First message
   curl -X POST http://localhost:4001/api/llm/test \
     -d '{"command": "tell me about taylor swift"}'
   
   # Contextual follow-up
   curl -X POST http://localhost:4001/api/llm/test \
     -d '{"command": "play some of her stuff"}'
   ```

## CLI Testing Guide

### Quick Start Testing

The test endpoint at `/api/llm/test` allows you to test LLM interpretations directly from the command line without the React app.

### Basic Commands

```bash
# 1. Clear conversation (start fresh)
curl -X DELETE http://localhost:4001/api/llm/test

# 2. Send a command (default model: gpt-5-nano)
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "tell me about taylor swift"}'

# 3. Send follow-up (tests context)
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "play some of her stuff"}'

# 4. View conversation history
curl http://localhost:4001/api/llm/test

# 5. Check raw conversation file
cat /tmp/llm-test-conversation.json | jq
```

### Testing Different Models

```bash
# Test with GPT-5 nano (default)
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "play taylor swift", "model": "gpt-5-nano"}'

# Test with GPT-5 (full)
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "play taylor swift", "model": "gpt-5"}'

# Test with GPT-4o
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "play taylor swift", "model": "openai/gpt-4o"}'

# Test with Gemini
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "play taylor swift", "model": "gemini-2.5-flash"}'
```

### Useful Testing Patterns

```bash
# Pretty print responses with jq
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "play some music"}' | jq

# Extract just the interpretation
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "play anti-hero"}' | jq '.interpretation'

# Check intent and confidence
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "queue something upbeat"}' | jq '.interpretation | {intent, confidence}'

# See what songs were selected
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "play some taylor swift"}' | jq '.interpretation.songs'
```

### Testing Conversation Context

```bash
# Test scenario: "tell me about X" -> "play some of her stuff"
# Clear first
curl -X DELETE http://localhost:4001/api/llm/test

# Step 1: Ask about artist
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "tell me about taylor swift"}' | jq '.response.message'

# Step 2: Test contextual reference (should understand "her" = Taylor Swift)
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "play some of her stuff"}' | jq '.interpretation.songs'

# Check if it understood the context
curl http://localhost:4001/api/llm/test | jq '.conversation.history[-1].interpretation.songs'
```

### Debugging Commands

```bash
# See the full conversation structure
cat /tmp/llm-test-conversation.json | jq

# Check last interpretation
cat /tmp/llm-test-conversation.json | jq '.conversationHistory[-1].interpretation'

# Count conversation turns
cat /tmp/llm-test-conversation.json | jq '.conversationHistory | length'

# See all commands sent
cat /tmp/llm-test-conversation.json | jq '.conversationHistory[].command'

# Check all intents detected
cat /tmp/llm-test-conversation.json | jq '.conversationHistory[].interpretation.intent'
```

### Advanced Testing

```bash
# Test multi-turn conversation in one script
#!/bin/bash
echo "Clearing conversation..."
curl -X DELETE http://localhost:4001/api/llm/test

echo -e "\n1. Asking about Taylor Swift..."
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "who is taylor swift"}' | jq '.interpretation.intent'

echo -e "\n2. Testing contextual reference..."
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "play some of her songs"}' | jq '.interpretation.songs[].artist' | uniq

echo -e "\n3. Testing rejection..."
curl -X POST http://localhost:4001/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"command": "no not those, something else"}' | jq '.interpretation'
```

### Watch Mode (for continuous testing)

```bash
# Watch the conversation file for changes
watch -n 1 'cat /tmp/llm-test-conversation.json | jq ".conversationHistory | length"'

# In another terminal, send commands and watch the count increase
```

## Current Status & Issues

### ✅ Working
- Native message history implementation complete
- Test endpoint functional
- Conversation persistence working
- All providers updated

### ❌ Still Not Working
- GPT-5 nano still doesn't understand contextual references like "her"
- It interprets "play some of her stuff" as generic female artists, not Taylor Swift specifically

### The Failing Test Case

```bash
# This should work but doesn't
curl -X DELETE http://localhost:4001/api/llm/test
curl -X POST http://localhost:4001/api/llm/test -d '{"command": "tell me about taylor swift"}' 
curl -X POST http://localhost:4001/api/llm/test -d '{"command": "play some of her stuff"}' | jq '.interpretation.songs'

# Expected: All songs by Taylor Swift
# Actual: Random female artists (Adele, Billie Eilish, Lorde, etc.)
```

## Next Steps for Refinement

1. **Test with larger GPT-5 models** (not nano) - may have better context understanding
2. **Enhance system prompt** to explicitly instruct about maintaining context
3. **Add context reminder** in the system prompt about recent conversation
4. **Consider adding explicit context resolution** before sending to LLM
5. **Test with different models** via the test endpoint to compare behavior

## Server Requirements

Make sure the server is running:
```bash
cd server
npm run dev
```

The test endpoint will be available at `http://localhost:4001/api/llm/test`

## Key Files to Review

- **Conversation storage**: `/tmp/llm-test-conversation.json`
- **Test route code**: `/server/src/routes/llm-test.ts`
- **Main interpretation logic**: `/server/src/routes/simple-llm-interpreter.ts`
- **OpenAI provider**: `/server/src/llm/providers/OpenAIProvider.ts`
- **Message history builder**: Line 260-312 in `simple-llm-interpreter.ts`
- **Conversation context parser**: Line 469-517 in `OpenAIProvider.ts`

## Technical Details

### Message History Format

The system now builds message arrays like this:

```javascript
[
  { 
    role: 'system', 
    content: 'You are a music assistant... [schema and instructions]' 
  },
  { 
    role: 'user', 
    content: 'tell me about taylor swift' 
  },
  { 
    role: 'assistant', 
    content: 'Taylor Swift is a renowned singer-songwriter...' 
  },
  { 
    role: 'user', 
    content: 'play some of her stuff' 
  }
]
```

### Conversation Entry Structure

Each conversation entry stored includes:
- `command`: The user's input
- `interpretation`: The LLM's parsed intent and parameters
- `response`: The generated response to the user
- `timestamp`: When the interaction occurred

This test endpoint bypasses Spotify execution and just shows what the LLM interprets, making it perfect for rapid iteration on prompt engineering and context handling.

## Notes

The infrastructure for proper context handling is now in place. The remaining issue appears to be with GPT-5 nano's ability to understand contextual references, which may require prompt engineering or using a more capable model.