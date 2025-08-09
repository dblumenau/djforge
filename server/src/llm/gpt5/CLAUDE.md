# OpenAI Responses API (GPT-5) Integration

## ⚠️ CRITICAL: This is NOT Chat Completions API

This directory implements OpenAI's **Responses API**, which is fundamentally different from the older Chat Completions API. 

### Key Differences:
- **Responses API**: Server-side conversation management via `previous_response_id`
- **Chat Completions**: Client-side conversation management via message arrays
- **Function Calling**: Responses API requires explicit function execution and result submission

## Documentation Resources

When working with this code, you MUST refer to:
1. **Local Docs**: `/docs/openai_official_docs/` - Official OpenAI documentation
2. **SDK Reference**: Use `context7` tool to check OpenAI Node SDK for Responses-specific methods
3. **API Reference**: The `openai/resources/responses/responses` module, NOT chat completions

Example context7 query:
```
Search OpenAI Node SDK for "responses.create" and "function_call_output"
```

## Architecture Overview

### Core Components

```
gpt5/
├── core/               # Core utilities (Redis, session, config)
├── handlers/           # Response and stream handlers
├── tools/              # Function definitions and execution
│   ├── definitions.ts  # Tool schemas for OpenAI
│   ├── functions.ts    # Actual function implementations
│   ├── function-executor.ts  # CRITICAL: Executes and submits results
│   └── validators.ts   # Zod validation schemas
├── scripts/            # Test console and utilities
├── tests/              # Test series and examples
└── types/              # TypeScript definitions
```

## Function Calling Pattern - The Billion Dollar Insight

### Why Function Execution Matters

In our music app, when a user says "I don't like that song, play something else", we discovered that:

1. **Dual Response Requirement**: The model should both:
   - Call the `provide_music_alternatives` function (for UI)
   - Provide a friendly text response (for conversation)

2. **The Pattern**:
   ```
   User: "I don't like that song"
   Model: Calls provide_music_alternatives() + Says "No problem! Let me suggest..."
   We: Execute function, get alternatives
   We: Submit results back to model with function_call_output
   Model: Final response with both function data AND conversational text
   ```

3. **The Value**: This creates a seamless experience where:
   - UI gets structured data (alternatives with emojis, labels, queries)
   - User gets natural conversation
   - Context is maintained throughout

### Implementation Flow

```typescript
// 1. Model calls a function
response.output = [{
  type: 'function_call',
  call_id: 'call_xyz123',  // CRITICAL: Use call_id, not id
  name: 'provide_music_alternatives',
  arguments: '{"rejectedItem": {...}, "alternatives": [...]}'
}]

// 2. We execute the function
const result = await executeFunction(functionCall);

// 3. We continue the conversation with the result
const continuationInput = [
  { role: "user", content: originalInput },
  { role: "assistant", content: assistantResponse },
  {
    type: "function_call_output",
    call_id: functionCall.call_id,  // Must match the call_id from step 1
    output: JSON.stringify(result)
  }
];

// 4. CRITICAL: Must store the continuation response
const continuationParams = {
  ...originalParams,
  input: continuationInput,
  previous_response_id: response.id,
  store: true  // MUST be true or subsequent calls fail with "response not found"
};
```

## Tool Definition System

### 1. Define Tools (definitions.ts)
```typescript
export const musicTools: Tool[] = [
  {
    type: "function",
    name: "provide_music_alternatives",
    description: "Provide alternative music suggestions",
    parameters: musicAlternativesSchema
    // NO 'function' property - that was wrong!
  }
];
```

### 2. Implement Functions (functions.ts)
```typescript
export const functionImplementations = {
  provide_music_alternatives: async (args: MusicAlternativesInput) => {
    // Validate with Zod
    const validated = musicAlternativesValidator.parse(args);
    
    // Return structured data for UI
    return {
      responseMessage: validated.responseMessage,
      alternatives: validated.alternatives.slice(0, 4),
      rejectedItem: validated.rejectedItem
    };
  }
};
```

### 3. Validate with Zod (validators.ts)
```typescript
export const musicAlternativesValidator = z.object({
  responseMessage: z.string(),
  rejectedItem: z.object({
    name: z.string(),
    type: z.enum(['song', 'artist', 'genre', 'playlist'])
  }),
  alternatives: z.array(alternativeSchema).min(1).max(5)
});
```

## Common Pitfalls

### ❌ DON'T
- Use Chat Completions patterns (message arrays)
- Forget to execute functions
- Set `store: false` on continuation responses
- Use `id` instead of `call_id` for function calls
- Add unnecessary fallbacks for call_id

### ✅ DO
- Always execute functions and submit results
- Use `previous_response_id` for conversation continuity
- Set `store: true` for all responses you need to reference
- Check OpenAI Responses API docs, not Chat Completions
- Use `call_id` from the function_call output

## Testing

Run the test console:
```bash
cd server
npx tsx src/llm/gpt5/scripts/test-console.ts
```

Key commands:
- `/skiptest` - Tests complete function calling workflow
- `/tools` - Toggle function calling
- `/stream` - Toggle streaming mode
- `/clear` - Start new conversation
- `/history` - View conversation with function calls

## Session Management

The system uses Redis to maintain conversation state:
```typescript
interface SessionData {
  lastResponseId: string | null;  // For previous_response_id
  conversationHistory: Array<{    // For debugging/history
    responseId: string;
    input: string;
    output: string;
    timestamp: string;
    model: string;
  }>;
}
```

## Streaming with Functions

When streaming is enabled, function calls are:
1. Accumulated during the stream
2. Executed after stream completes
3. Continuation response is streamed as well

This creates a smooth experience where users see:
1. Initial response streaming in
2. Function execution happening
3. Final enhanced response streaming in

## Models Available

- `gpt-5` - Full model with maximum capabilities
- `gpt-5-mini` - Balanced performance and cost
- `gpt-5-nano` - Fastest, most economical

## Environment Variables

```bash
OPENAI_API_KEY=your_api_key
REDIS_URL=redis://localhost:6379  # Optional, for session persistence
```

## The Business Value

This architecture enables a **billion-dollar experience** because:

1. **Seamless Integration**: Functions provide data, model provides personality
2. **Context Preservation**: Conversation flows naturally even with function calls
3. **UI/UX Excellence**: Structured data for perfect UI rendering
4. **User Delight**: Natural language with actionable results

Example interaction:
```
User: "I don't like jazz"
System: [Executes function] + "No worries! How about some rock, pop, or electronic?"
User: "What was I listening to before?"
System: "You were listening to jazz, but you mentioned not liking it, so I suggested alternatives"
```

The model remembers the entire context including function executions!