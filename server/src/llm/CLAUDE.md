# CLAUDE.md - LLM Integration

This directory contains the multi-LLM integration system that powers natural language understanding for Spotify commands.

## Architecture Overview

The system uses a **dual-provider architecture** with multiple models and fallback chains:

1. **Primary Flow**: Google Gemini Direct API (fastest, structured output)
2. **Fallback Flow**: OpenRouter API (30+ models, flexible routing)

## Key Components

### orchestrator.ts
- **Purpose**: Central LLM routing and management
- **Key Features**:
  - Automatic provider selection based on model
  - Fallback chains for reliability
  - Unified interface for all LLM calls
  - Response normalization across providers
- **Model Constants**: `OPENROUTER_MODELS` and `GEMINI_MODELS`

### providers/GeminiService.ts
- **Purpose**: Google Gemini Direct API integration
- **Key Features**:
  - Native structured output support
  - JSON schema enforcement
  - Optional search grounding
  - Faster response times
- **Models**: Gemini 2.5 Flash, Gemini 2.5 Pro

### providers/OpenRouterProvider.ts
- **Purpose**: OpenRouter API integration (30+ models)
- **Key Features**:
  - Access to GPT-4, Claude, Llama, Mistral, etc.
  - Flexible model switching
  - JSON mode support for compatible models
  - Prompt-based JSON extraction for others

### music-curator-prompts.ts
- **Purpose**: Specialized prompts for music curation
- **Key Components**:
  - `FULL_CURATOR_GUIDELINES` - Complete system prompt
  - `CONVERSATIONAL_ASSISTANT_PROMPT` - For chat intents
  - `formatMusicHistory` - Context formatting helper
- **Features**:
  - Personality system (knowledgeable music curator)
  - Alternative song suggestions
  - Contextual understanding

### monitoring.ts
- **Purpose**: LLM performance monitoring
- **Tracks**:
  - Request latency
  - Success/failure rates
  - Model usage distribution
  - Token consumption

## Intent System

### Current Intent Types
```typescript
// Action intents (trigger Spotify actions)
'play_specific_song'      // Play exact track
'queue_specific_song'     // Queue exact track
'queue_multiple_songs'    // Queue 5-10 tracks
'play_playlist'           // Play playlist
'queue_playlist'          // Queue playlist
'play', 'pause', 'skip'   // Playback control
'set_volume'              // Volume control
'set_shuffle', 'set_repeat' // Mode control
'clear_queue'             // Clear queue

// Conversational intents (return text only)
'chat'                    // General music discussion
'ask_question'            // Music facts/questions
'get_playback_info'       // Current track info

// Information intents
'search'                  // Search without playing
'get_devices'             // List devices
'get_playlists'           // List playlists
'get_recently_played'     // Recent tracks
```

## Response Handling

### Gemini Response Format
```typescript
{
  content: string | object,  // Native JSON when using schemas
  model: string,
  provider: 'google',
  flow: 'gemini-direct',
  usage: { promptTokens, completionTokens, totalTokens }
}
```

### OpenRouter Response Format
```typescript
{
  content: string,           // JSON string to parse
  model: string,
  provider: 'openrouter',
  flow: 'openrouter',
  usage: { promptTokens, completionTokens, totalTokens },
  fallbackUsed?: boolean,
  actualModel?: string
}
```

## Configuration

### Environment Variables
```bash
GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key
GEMINI_SEARCH_GROUNDING=true  # Optional
```

### Model Selection Strategy
1. User preference (if set via model preferences)
2. Gemini 2.5 Flash (default - fastest)
3. Fallback chain on errors:
   - Claude Sonnet 4
   - O3 Pro
   - Basic keyword matching

## Best Practices

### Adding New Models
1. Add to model constants in `orchestrator.ts`
2. Update provider logic if needed
3. Test with various command types
4. Update fallback chains

### Prompt Engineering
- Keep system prompts focused on task
- Let structured output handle JSON formatting
- Include examples for complex intents
- Use personality consistently
- **CRITICAL**: Establish priority rules BEFORE introducing potentially biasing context (see Taste Profile section)

### Taste Profile Prioritization (Updated 2025-07-27)

**The Problem**: User taste profiles were overriding specific requests. When users asked for genres outside their usual preferences (e.g., "songs where someone talks over a beat"), the system returned songs from their typical genres instead.

**The Solution**: Restructured prompts using hierarchical prioritization:

1. **Primary Goal First**: State the main objective before any context
2. **Clear Hierarchy**: Explicitly label User Request as primary, Taste Profile as secondary
3. **DO/DO NOT Rules**: Clear directives on when to use vs. ignore taste profiles
4. **Strategic Placement**: User request appears before taste profile data

**Implementation**:
```typescript
// Structure used in both OpenRouter and Gemini flows
const prompt = `
### Primary Goal ###
Your single most important goal is to find excellent matches for the user's request below.

### How to Use the Provided Context ###
1. **User Request**: This is your primary instruction. Fulfill it directly and precisely.
2. **User Taste Profile**: This is secondary reference information.
   - DO use it if the User Request is vague (e.g., "play something for me")
   - DO NOT let it override a specific User Request for a genre, artist, or style.

### User Request ###
${userRequest}

### User Taste Profile (Secondary Reference) ###
${tasteProfile}
`;
```

**Key Learnings**:
- **Primacy Effect**: Instructions appearing first carry more weight in LLM attention
- **Explicit Labeling**: Calling taste profile "Secondary Reference" reinforces its subordinate role
- **Simplified Context**: Removed verbose instructions from taste profiles themselves
- **Both Flows**: Updated both `simple-llm-interpreter.ts` and `gemini-schemas.ts` for consistency

### Error Handling
- Always provide fallback behavior
- Log errors with context
- Return sensible defaults
- Preserve user experience

### Performance Optimization
- Gemini Direct is 2-3x faster than OpenRouter
- Use `response_format: { type: 'json_object' }` when available
- Cache user taste profiles to reduce prompt size
- Minimize conversation context to relevant entries

## Testing

Run LLM tests:
```bash
# Test interpretation accuracy
npm test -- llm

# Test specific providers
npm test -- GeminiService
npm test -- OpenRouterProvider
```

## Debugging

Enable debug logging:
```typescript
console.log('[LLM Debug]', {
  model: requestedModel,
  provider: response.provider,
  flow: response.flow,
  latency: response.latency
});
```

Check logs:
- LLM selection decisions
- Response parsing failures
- Fallback chain activation
- Token usage patterns