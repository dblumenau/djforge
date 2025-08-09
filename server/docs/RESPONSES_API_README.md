# OpenAI Responses API Test Suite

## Overview

This repository contains comprehensive test scripts for OpenAI's Responses API with GPT-5 model family support. It includes both TypeScript and JavaScript implementations with full CLI interactivity.

## Features

### Core Capabilities
- ✅ **Full Responses API Support** - Complete implementation based on latest OpenAI SDK
- ✅ **GPT-5 Model Family** - Support for gpt-5, gpt-5-mini, gpt-5-nano
- ✅ **Conversation Continuity** - Server-side storage with `previous_response_id`
- ✅ **Redis Integration** - Enhanced session management with Redis caching
- ✅ **Streaming Support** - Real-time token streaming with event handling
- ✅ **Tool Calling** - Built-in tools (web_search, code_interpreter, file_search) + custom functions
- ✅ **Structured Outputs** - Zod schema validation for JSON responses
- ✅ **Reasoning Tokens** - Track and display reasoning token usage

### Interactive CLI Features
- 🎮 **Interactive Mode** - Full REPL with command support
- 📝 **Command System** - Rich set of slash commands
- 🎨 **Colored Output** - Beautiful terminal output with chalk
- 💾 **Session Persistence** - Continue conversations across runs
- 🧪 **Test Suites** - Pre-built examples and comprehensive tests

## Installation

```bash
# Install dependencies
npm install

# Or if you need to install specific packages
npm install openai chalk zod zod-to-json-schema redis dotenv
```

## Usage

### Interactive Mode (Default)
```bash
# TypeScript version (recommended)
npm run test-responses

# Or directly with tsx
tsx test-responses-api-gpt5.ts

# JavaScript version (legacy)
npm run test-responses:legacy
```

### Run Examples
```bash
# Run example conversations
npm run test-responses:examples

# Or with command line
tsx test-responses-api-gpt5.ts --examples
```

### Run Test Suite
```bash
# Run comprehensive test series
npm run test-responses:suite

# Or with command line
tsx test-responses-api-gpt5.ts --test
```

### Single Message Mode
```bash
# Send a single message
tsx test-responses-api-gpt5.ts "What is the meaning of life?"

# With options
tsx test-responses-api-gpt5.ts --tools --verbose "Search for latest AI news"

# With streaming
tsx test-responses-api-gpt5.ts --stream "Count to 10"
```

## Interactive Commands

Once in interactive mode, you can use these commands:

| Command | Description |
|---------|-------------|
| `/tools` | Toggle all tools (web search, code interpreter, etc.) |
| `/model <name>` | Switch model (gpt-5, gpt-5-mini, gpt-5-nano) |
| `/reasoning <level>` | Set reasoning effort (low, medium, high) |
| `/stream` | Toggle streaming mode |
| `/structured` | Toggle structured JSON output |
| `/verbose` | Toggle verbose output |
| `/clear` | Start new conversation |
| `/history` | Show conversation history |
| `/session` | Show current session info |
| `/examples` | Run example conversations |
| `/test` | Run comprehensive test series |
| `/help` | Show help information |
| `/exit` | Exit the program |

## Configuration

Create a `.env` file in the server directory:

```env
# Required
OPENAI_API_KEY=your-api-key-here

# Optional
REDIS_URL=redis://localhost:6379
MODEL=gpt-5-mini  # Default model
DEBUG=true        # Enable debug output
```

## Session Management

### File-based Sessions
- Sessions are saved to `.responses-session-real.json`
- Automatically loads on startup
- Preserves `previous_response_id` for continuity

### Redis Sessions (Optional)
- Enable by setting `REDIS_URL` in `.env`
- 24-hour expiration
- Faster access and multi-instance support

## API Structure

### Request Parameters
```typescript
{
  model: "gpt-5-mini",
  input: "Your message",
  store: true,  // Server-side storage
  previous_response_id: "...",  // For continuity
  reasoning: {
    effort: "medium"  // low, medium, high
  },
  tools: [...],  // Tool definitions
  temperature: 1,
  max_output_tokens: null
}
```

### Response Structure
```typescript
{
  id: "response_id",
  model: "gpt-5-mini",
  status: "completed",
  output_text: "Assistant response",
  output: [
    {
      type: "reasoning",
      summary: ["..."]
    },
    {
      type: "message",
      role: "assistant",
      content: [...]
    }
  ],
  usage: {
    input_tokens: 100,
    output_tokens: 200,
    total_tokens: 300,
    output_tokens_details: {
      reasoning_tokens: 50
    }
  }
}
```

## Testing Strategy

### Example Conversations
- Basic conversation with memory
- Server-side memory testing
- Tool usage (web search)
- High reasoning effort
- Different model testing

### Comprehensive Test Series
- Basic conversation
- Memory persistence
- Streaming responses
- Tool calling
- High reasoning
- Structured outputs
- Code generation
- Web search

## Troubleshooting

### Common Issues

1. **404 Error**: The Responses API may still be rolling out. Check API availability.
2. **Authentication Failed**: Verify your `OPENAI_API_KEY` in `.env`
3. **Rate Limit**: Wait before retrying or reduce request frequency
4. **Redis Connection**: Ensure Redis server is running if using Redis sessions

### Debug Mode
Enable debug output by setting `DEBUG=true` in your `.env` file or running:
```bash
DEBUG=true tsx test-responses-api-gpt5.ts
```

## Architecture

### TypeScript Version (`test-responses-api-gpt5.ts`)
- Full type safety with OpenAI SDK types
- Zod schema validation
- Redis integration
- Streaming support
- Modern async/await patterns

### JavaScript Version (`test-responses-api-complete.js`)
- Legacy compatibility
- Simple setup
- No compilation needed
- Same CLI features

## Development

### Adding New Tools
```typescript
const customTool = {
  type: "function",
  function: {
    name: "my_tool",
    description: "Tool description",
    parameters: MyZodSchema
  }
};
```

### Extending Commands
Add new commands in the `handleCommand` method:
```typescript
case '/mycommand':
  // Your command logic
  break;
```

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!

## Notes

- GPT-5 models are hypothetical as of 2025
- Responses API structure based on latest OpenAI SDK documentation
- Tool calling follows OpenAI's function calling patterns
- Streaming uses Server-Sent Events (SSE) format