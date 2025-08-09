# LLM Scripts

This directory contains utility scripts for testing and interacting with various LLM APIs.

## test-responses-api-gpt5.ts

A comprehensive test console for OpenAI's Responses API with GPT-5 models.

### Features

- **Full TypeScript support** with proper types from OpenAI SDK
- **Zod runtime validation** for session data, tool arguments, and configuration
- **Redis session management** for conversation continuity
- **Streaming support** for real-time responses
- **Tool calling** with validation (weather, music search, code execution)
- **Structured outputs** using Zod schemas
- **Multiple models**: gpt-5, gpt-5-mini, gpt-5-nano
- **Reasoning levels**: low, medium, high

### Usage

```bash
# Interactive mode
npx tsx src/llm/scripts/test-responses-api-gpt5.ts

# Run examples
npx tsx src/llm/scripts/test-responses-api-gpt5.ts --examples

# Run test series
npx tsx src/llm/scripts/test-responses-api-gpt5.ts --test

# Send single message
npx tsx src/llm/scripts/test-responses-api-gpt5.ts "Hello, what can you do?"

# With options
npx tsx src/llm/scripts/test-responses-api-gpt5.ts --tools --stream "Search for weather"
```

### Interactive Commands

- `/tools` - Enable all tools for next message
- `/model <name>` - Switch model (gpt-5, gpt-5-mini, gpt-5-nano)
- `/reasoning <level>` - Set reasoning effort (low, medium, high)
- `/stream` - Toggle streaming mode
- `/structured` - Toggle structured output
- `/verbose` - Toggle verbose output
- `/clear` - Start new conversation
- `/history` - Show conversation history
- `/session` - Show session info
- `/examples` - Run example conversations
- `/test` - Run comprehensive test series
- `/help` - Show help
- `/exit` - Exit program

### Runtime Validation

The script includes comprehensive Zod validation for:

1. **Session Data** - Validates loaded sessions from Redis/file
2. **Tool Arguments** - Validates all function call arguments
3. **Configuration** - Validates test configuration options

This ensures the script handles corrupted data gracefully and provides clear error messages.

### Environment Variables

Required in `.env`:
```bash
OPENAI_API_KEY=your_api_key_here
REDIS_URL=redis://localhost:6379  # Optional
```

### Development

The script is fully typed and compiles with TypeScript:

```bash
# Type check
npx tsc --noEmit

# Run directly with tsx
npx tsx src/llm/scripts/test-responses-api-gpt5.ts
```