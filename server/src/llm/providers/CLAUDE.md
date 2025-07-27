# CLAUDE.md - LLM Providers

This directory contains the LLM provider implementations that integrate with various AI services.

## Provider Files

### GeminiService.ts
- **Purpose**: Google Gemini Direct API integration
- **Key Features**:
  - Native structured output using `responseSchema`
  - Optional search grounding for enhanced responses
  - Intent-based schema selection
  - Automatic retry logic
- **Configuration**:
  ```typescript
  {
    apiKey: process.env.GEMINI_API_KEY,
    enableGrounding: true,  // Enable web search
    timeout: 30000,         // 30 second timeout
    maxRetries: 2           // Retry failed requests
  }
  ```
- **Models**:
  - `gemini-2.5-flash` - Fast, cost-effective
  - `gemini-2.5-pro` - More capable, slower

### OpenRouterProvider.ts
- **Purpose**: OpenRouter API integration (30+ models)
- **Supported Models**:
  - GPT-4 variants (Turbo, O)
  - Claude (Sonnet, Opus, Haiku)
  - Llama 3 (70B, 8B)
  - Mistral variants
  - DeepSeek models
  - Qwen models
  - O3 Pro
- **Features**:
  - Unified interface for multiple providers
  - JSON mode support detection
  - Automatic prompt engineering for JSON
  - Model-specific optimizations

## Implementation Details

### Gemini Structured Output
```typescript
// Uses native schema definition
const schema = {
  type: Type.OBJECT,
  properties: {
    intent: { 
      type: Type.STRING,
      enum: ['play_specific_song', 'queue_specific_song', ...]
    },
    artist: { type: Type.STRING },
    track: { type: Type.STRING },
    // ... other fields
  },
  required: ['intent']
};
```

### OpenRouter JSON Handling
```typescript
// Models supporting JSON mode
const JSON_MODE_MODELS = [
  'openai/gpt-4o',
  'openai/gpt-4-turbo',
  'anthropic/claude-3.5-sonnet',
  // ...
];

// Request with JSON mode
{
  response_format: { type: 'json_object' },
  // ... other params
}
```

## Provider Selection Logic

1. **Model-based routing**:
   - Gemini models → GeminiService
   - All others → OpenRouterProvider

2. **Feature considerations**:
   - Need grounding? → Use Gemini with grounding enabled
   - Need specific model? → Use OpenRouter
   - Need fastest response? → Use Gemini 2.5 Flash

3. **Fallback strategy**:
   - Primary: User-selected model
   - Fallback 1: Gemini 2.5 Flash
   - Fallback 2: Claude Sonnet via OpenRouter
   - Fallback 3: O3 Pro via OpenRouter

## Error Handling

### Common Errors
- **Rate limiting**: Automatic retry with backoff
- **Invalid API key**: Clear error message
- **Timeout**: Configurable timeout with retry
- **Invalid schema**: Validation before sending

### Provider-Specific Issues
- **Gemini**: Schema validation errors
- **OpenRouter**: Model availability varies
- **Both**: Token limits differ by model

## Adding New Providers

1. Create new provider class implementing base interface
2. Handle authentication and request formatting
3. Normalize responses to common format
4. Add to orchestrator routing logic
5. Test with various intent types
6. Document model-specific quirks

## Performance Considerations

### Response Times (average)
- Gemini 2.5 Flash: 800-1200ms
- Gemini 2.5 Pro: 1500-2500ms
- GPT-4 Turbo: 1000-2000ms
- Claude Sonnet: 1200-2000ms
- O3 Pro: 2000-4000ms

### Cost Efficiency
- Gemini Flash: Most cost-effective
- GPT-4 Turbo: Moderate cost
- Claude Opus: Higher cost
- O3 Pro: Premium pricing

### Optimization Tips
- Use Gemini Flash for simple commands
- Enable caching for repeated queries
- Minimize prompt size
- Use structured output when possible