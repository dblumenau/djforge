# OpenAI Official Documentation - Navigation Guide

## ⚠️ CRITICAL: Responses API vs Chat Completions API

These documents describe OpenAI's **Responses API**, which is fundamentally different from the Chat Completions API that most online resources discuss.

### Key Distinction
- **Most online tutorials/Stack Overflow**: Chat Completions API (messages array)
- **These docs**: Responses API (server-side state via `previous_response_id`)
- **Our implementation**: `/server/src/llm/gpt5/` uses Responses API exclusively

## Document Overview

### Core Documents

#### 📄 Function Calling.md
**Most Critical Document** - Explains the complete function calling pattern:
- How functions are defined in tool schemas
- The `function_call` output type
- The `function_call_output` input type with `call_id`
- Complete execution flow

Key insight from this doc:
```javascript
// Function calls use call_id, not id
{
  type: "function_call_output",
  call_id: functionCall.call_id,  // NOT functionCall.id
  output: JSON.stringify(result)
}
```

#### 📄 Conversation state.md
Explains server-side conversation management:
- The `previous_response_id` parameter
- The `store` parameter (MUST be true for continuity)
- How responses are linked on the server
- Session management patterns

Critical learning:
```javascript
// Responses must be stored to be referenced later
{
  store: true,  // NOT false, or you'll get "response not found" errors
  previous_response_id: lastResponseId
}
```

#### 📄 Migrating to Responses API.txt
Migration guide from Chat Completions:
- Key differences in API structure
- How to convert existing code
- Common pitfalls when migrating

#### 📄 Web Search.md
Built-in web search capability:
- How to enable web search in responses
- Search result formatting
- Integration patterns

#### 📄 File Search.md
File search capabilities:
- How to search uploaded files
- Context window management
- Best practices

## How to Use These Docs

### When Implementing Function Calling

1. **Start with**: `Function Calling.md`
2. **Focus on**: The complete flow diagram showing function execution
3. **Key sections**:
   - "Function call outputs" - How to submit results
   - "Streaming with functions" - How streaming affects function calls
   - "Multiple function calls" - Parallel execution patterns

### When Managing Conversations

1. **Start with**: `Conversation state.md`
2. **Focus on**: Server-side state management
3. **Key sections**:
   - "Response IDs" - How IDs are generated and used
   - "Storage" - Why `store: true` is critical
   - "Continuation" - How to link responses

### When Debugging Issues

Common errors and which doc to check:

| Error | Document to Check | Likely Issue |
|-------|------------------|--------------|
| "No tool output found for function call" | Function Calling.md | Missing or incorrect `call_id` |
| "Previous response not found" | Conversation state.md | `store: false` was used |
| "Invalid input format" | Function Calling.md | Wrong structure for function_call_output |
| "Function not found" | Function Calling.md | Tool definition mismatch |

## Implementation Checklist

When working with Responses API:

- [ ] Using `responses.create()` not `chat.completions.create()`
- [ ] Setting `store: true` for all responses
- [ ] Using `call_id` from function calls, not `id`
- [ ] Submitting function results with `function_call_output` type
- [ ] Using `previous_response_id` for conversation continuity
- [ ] Defining tools with proper schema structure

## Common Misconceptions

### ❌ WRONG (Chat Completions patterns)
```javascript
// DON'T do this - it's Chat Completions API
messages: [
  {role: "user", content: "Hello"},
  {role: "assistant", content: "Hi there"},
  {role: "function", name: "get_weather", content: "..."}
]
```

### ✅ RIGHT (Responses API patterns)
```javascript
// DO this - it's Responses API
input: [
  {role: "user", content: "Hello"},
  {type: "function_call_output", call_id: "call_123", output: "..."}
],
previous_response_id: "resp_abc123"
```

## Testing Your Understanding

Quick test - if you think these are true, re-read the docs:
- ❌ "Function results go in a message with role: 'function'"
- ❌ "I need to manage conversation history client-side"
- ❌ "Setting store: false saves tokens"
- ❌ "Function calls have an 'id' field I should use"

Correct understanding:
- ✅ "Function results use type: 'function_call_output'"
- ✅ "OpenAI manages conversation state server-side"
- ✅ "store: true is required for conversation continuity"
- ✅ "Function calls have a 'call_id' field I must use"

## Related Implementation

See `/server/src/llm/gpt5/CLAUDE.md` for how we implement these patterns in our codebase.

## When in Doubt

1. Check these official docs first
2. Use `context7` tool to search OpenAI Node SDK for "responses" methods
3. Look for `openai/resources/responses/responses` imports
4. Test with the console at `/server/src/llm/gpt5/scripts/test-console.ts`

Remember: Most online resources are about Chat Completions API. These docs are your source of truth for Responses API!