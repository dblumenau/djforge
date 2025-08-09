# OpenAI Responses API: Streaming Function Calls with Conversation History Bug

## Issue Summary
When using the OpenAI Responses API with streaming enabled, function calls fail with error 400 "No tool output found for function call" when `previous_response_id` is set from a prior conversation turn.

## Environment
- API: OpenAI Responses API (not Chat Completions API)
- SDK: openai-node latest version
- Mode: Streaming enabled (`stream: true`)
- Tools: Custom function tools with `strict: true` and proper JSON schemas
- Conversation: Using `previous_response_id` for conversation continuity

## Reproduction Steps
1. Start a conversation with a normal text message (e.g., "Hello")
2. Receive a text response with a response ID
3. Send a second message that triggers a function call (e.g., "I don't like that song, another please")
4. With `previous_response_id` set to the ID from step 2
5. **Result**: Error 400 "No tool output found for function call call_[ID]"

## What Works
- Function calls work fine WITHOUT `previous_response_id` (fresh conversation)
- Function calls work fine in non-streaming mode
- Normal text responses work fine with `previous_response_id` in streaming mode
- Clearing the conversation (removing `previous_response_id`) allows function calls to work again

## Theory of the Problem

### Primary Hypothesis
The Responses API has a bug/limitation where streaming function calls are incompatible with conversation continuity via `previous_response_id`. The API appears to expect tool outputs to be provided back when continuing from a previous response, similar to how the Chat Completions API handles multi-turn conversations with function calls.

### Possible Causes
1. **State Management Issue**: The API might be tracking function calls from previous responses and expecting outputs that were never requested
2. **Streaming Protocol Mismatch**: The streaming protocol for function calls might differ when `previous_response_id` is present
3. **Incomplete Implementation**: The Responses API's conversation continuity feature might not fully support function calls in streaming mode

## What We're Unsure About

### Questions Needing Research
1. **Is this a known limitation?** Check OpenAI documentation for any mentions of streaming + function calls + conversation history limitations
2. **Tool Output Requirements**: What exactly does "No tool output found" mean in the context of the Responses API? Is it expecting us to send tool outputs back like in Chat Completions?
3. **Proper Function Call Handling**: What's the correct way to handle function calls in streaming mode with conversation history?
4. **API Differences**: How do function calls differ between Responses API and Chat Completions API, especially regarding conversation continuity?

### Unknowns
- Whether this is a bug or intended behavior
- If there's a specific format for providing tool outputs back to the API
- Whether certain response types (with function calls) should not be used as `previous_response_id`
- If there's a way to "complete" a function call before using its response ID for continuation

## Critical Requirements for DJ Forge

1. **Must Have Conversation History**: The app needs to maintain context across messages for a natural conversation experience
2. **Must Support Function Calls**: Essential for structured outputs that the React app can parse (music alternatives, playback control, etc.)
3. **Streaming Preferred**: Better UX with real-time responses
4. **Cannot Clear History Randomly**: Users expect continuous conversation, not resets

## Potential Workarounds (All Unacceptable)

1. ❌ Clear conversation before function calls - breaks continuity
2. ❌ Disable streaming - degrades UX
3. ❌ Don't use `previous_response_id` - loses conversation context
4. ❌ Switch to Chat Completions API - different API, would require major refactoring

## Research Tasks

1. **Documentation Review**
   - Search OpenAI Responses API docs for streaming + function call limitations
   - Look for examples of multi-turn conversations with function calls
   - Check if there's a "tool output" endpoint we're missing

2. **API Testing**
   - Test if the error occurs with built-in tools (if supported)
   - Test if providing mock tool outputs resolves the issue
   - Test different `tool_choice` settings ("auto" vs "required" vs specific function)

3. **Community/Support**
   - Check OpenAI forums for similar issues
   - Look for GitHub issues in openai-node SDK
   - Consider opening a support ticket with OpenAI

4. **Alternative Approaches**
   - Investigate if there's a way to "mark" a response as complete
   - Check if certain response types shouldn't be used for continuation
   - Explore if there's a different parameter for conversation history

## Code Context

The test script is at: `/Users/david/Sites/djforge/server/src/llm/scripts/test-responses-api-gpt5.ts`

Key configuration:
```typescript
{
  model: 'gpt-5-nano',
  stream: true,
  tool_choice: "auto",
  tools: [/* function definitions */],
  previous_response_id: lastResponseId // This causes the issue
}
```

## Expected Resolution

We need to either:
1. Find the correct way to handle function calls with conversation history in streaming mode
2. Get confirmation this is a bug and find a proper workaround
3. Discover an alternative approach to maintain conversation context that doesn't trigger this issue

## Priority: CRITICAL
This blocks the core functionality of DJ Forge - we cannot ship without both conversation history AND function calls working together.