# OpenAI Responses API: Skip-Back Solution for Function Call Bug

## Problem
When using the OpenAI Responses API with:
- `stream: true` 
- `previous_response_id` set from a prior conversation
- A new message that triggers a function call

The API returns error 400: "No tool output found for function call"

## Root Cause
The Responses API appears to expect tool outputs from previous function calls when `previous_response_id` is set, similar to the Chat Completions API pattern. However, unlike the Chat Completions API, there's no clear mechanism to provide these outputs.

## Solution: Skip-Back Strategy

Instead of:
1. Clearing all conversation history (loses context entirely)
2. Never using `previous_response_id` (no conversation continuity)

We implement a "skip-back" strategy:

### How It Works

1. **Track Function Calls**: For each response, track whether it included function calls
2. **Find Valid Response**: When continuing a conversation, search backwards through history to find the most recent response that DIDN'T have function calls
3. **Use Valid ID**: Use that response's ID as `previous_response_id`

### Benefits

- ✅ Maintains conversation continuity
- ✅ Remembers user context and preferences
- ✅ Avoids the "No tool output found" error
- ✅ Function calls still work properly
- ✅ Minimal context loss (only skips function call responses)

### Implementation

```typescript
interface ConversationEntry {
  responseId: string;
  input: string;
  output: string;
  hadFunctionCall?: boolean; // Track this!
}

function findLastValidResponseId(history: ConversationEntry[]): string | null {
  // Search backwards for a response without function calls
  for (let i = history.length - 1; i >= 0; i--) {
    if (!history[i].hadFunctionCall) {
      return history[i].responseId;
    }
  }
  return null;
}

// When making a new request:
const validResponseId = findLastValidResponseId(conversationHistory);
if (validResponseId) {
  params.previous_response_id = validResponseId;
}
```

### Example Conversation Flow

1. User: "Hello, I'm David" → Response A (no function call) ✅
2. User: "Tell me about jazz" → Response B (no function call) ✅
3. User: "Play something else" → Response C (HAS function call) ⚡
4. User: "What were we discussing?" → Uses Response B's ID (skips C) ✅
5. AI remembers the jazz conversation context!

### Testing

Run the test script with the new `/skiptest` command:

```bash
cd server/src/llm/scripts
npx tsx test-responses-api-gpt5.ts
# In interactive mode, type: /skiptest
```

## Alternative Solutions

### Short Term (Current)
- Use skip-back strategy as implemented above

### Medium Term
- Consider migrating to Chat Completions API which has mature function calling support
- Implement a hybrid approach: use Responses API for text, Chat API for functions

### Long Term
- File bug report with OpenAI
- Monitor for Responses API updates that properly handle this scenario

## Trade-offs

**Pros:**
- Maintains most conversation context
- Function calls work reliably
- No manual intervention needed

**Cons:**
- Some context loss (skips function call responses)
- Conversation might feel slightly disconnected after function calls
- Additional complexity in session management

## Recommendation for DJ Forge

Implement this skip-back strategy in your production code. It provides the best balance between:
- Maintaining conversation continuity (for personalized music recommendations)
- Supporting function calls (for music alternatives UI)
- Avoiding API errors that would break the user experience

The slight context loss is acceptable since function calls typically represent actions (like "play something else") rather than conversation content that needs to be remembered.