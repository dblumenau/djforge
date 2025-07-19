# Gemini 2.5 Flash JSON Output Guide

## Overview

This guide provides comprehensive tips and best practices for getting Gemini 2.5 Flash to consistently output JSON format. Based on extensive research and testing, these techniques ensure reliable structured output for production applications.

## Table of Contents

- [Quick Start](#quick-start)
- [Native Structured Output (Recommended)](#native-structured-output-recommended)
- [Schema Design Best Practices](#schema-design-best-practices)
- [Implementation Examples](#implementation-examples)
- [Migration from Legacy Package](#migration-from-legacy-package)
- [Common Pitfalls](#common-pitfalls)
- [Troubleshooting](#troubleshooting)

## Quick Start

The most reliable approach is using Gemini's native structured output feature:

```typescript
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ project: "your-project" });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Your prompt here",
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        intent: { type: Type.STRING },
        query: { type: Type.STRING },
        confidence: { type: Type.NUMBER }
      },
      required: ["intent", "query", "confidence"],
      propertyOrdering: ["intent", "query", "confidence"]
    }
  }
});
```

## Native Structured Output (Recommended)

### Why Use Native Structured Output?

According to Google's research and user feedback:
- **Near-flawless JSON output** when properly configured
- **Eliminates parsing errors** from extraneous text
- **Consistent formatting** across all responses
- **No more prompt engineering** for JSON constraints

### Key Configuration Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| `responseMimeType` | Must be `"application/json"` | ✅ |
| `responseSchema` | Defines the exact structure | ✅ |
| `propertyOrdering` | Ensures consistent field order | ⚠️ Recommended |
| `required` | Specifies mandatory fields | ⚠️ Recommended |

### Basic Example

```typescript
const schema = {
  type: Type.OBJECT,
  properties: {
    intent: { 
      type: Type.STRING,
      enum: ["search_and_play", "pause", "skip", "volume"]
    },
    query: { type: Type.STRING },
    confidence: { 
      type: Type.NUMBER,
      minimum: 0,
      maximum: 1
    },
    alternatives: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["intent", "confidence"],
  propertyOrdering: ["intent", "query", "confidence", "alternatives"]
};
```

## Schema Design Best Practices

### 1. Keep Schemas Simple

```typescript
// ✅ Good: Simple, focused schema
const goodSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING },
    target: { type: Type.STRING },
    success: { type: Type.BOOLEAN }
  },
  required: ["action", "success"]
};

// ❌ Bad: Overly complex nested structure
const badSchema = {
  type: Type.OBJECT,
  properties: {
    metadata: {
      type: Type.OBJECT,
      properties: {
        timestamps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              event: { type: Type.STRING },
              time: { type: Type.STRING }
            }
          }
        }
      }
    }
  }
};
```

### 2. Use Enums for Constrained Values

```typescript
const intentSchema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: [
        "search_and_play",
        "search_and_queue", 
        "play",
        "pause",
        "skip",
        "previous",
        "volume",
        "get_info",
        "unknown"
      ]
    }
  }
};
```

### 3. Specify Required Fields

```typescript
const robustSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING },
    query: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    reasoning: { type: Type.STRING }
  },
  required: ["intent", "confidence"], // Always include critical fields
  propertyOrdering: ["intent", "query", "confidence", "reasoning"]
};
```

### 4. Use Property Ordering

```typescript
const orderedSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING },
    query: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    alternatives: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  propertyOrdering: ["intent", "query", "confidence", "alternatives"]
};
```

## Implementation Examples

### For Our Spotify Controller

Here's how to integrate this into our existing `GeminiService`:

```typescript
// Update GeminiService.ts
private async completeStandard(model: GenerativeModel, request: LLMRequest): Promise<LLMResponse> {
  const generationConfig: any = {
    temperature: request.temperature ?? 0.7,
    maxOutputTokens: request.max_tokens ?? 2000,
  };

  // Add JSON schema if requested
  if (request.response_format?.type === 'json_object' && request.schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = this.convertZodToGeminiSchema(request.schema);
  }

  const result = await model.generateContent({
    contents: this.formatMessages(request.messages),
    generationConfig
  });

  return this.processResponse(result, request);
}

// Helper method to convert Zod schema to Gemini schema
private convertZodToGeminiSchema(zodSchema: any): any {
  // Implementation depends on your Zod schema structure
  // This is a simplified example
  return {
    type: 'object',
    properties: {
      intent: { type: 'string' },
      query: { type: 'string' },
      confidence: { type: 'number' },
      reasoning: { type: 'string' }
    },
    required: ['intent', 'confidence'],
    propertyOrdering: ['intent', 'query', 'confidence', 'reasoning']
  };
}
```

### Music Command Schema Example

```typescript
const musicCommandSchema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: [
        "search_and_play",
        "search_and_queue",
        "play",
        "pause",
        "skip",
        "previous",
        "volume",
        "get_info",
        "unknown"
      ]
    },
    query: { type: Type.STRING },
    artist: { type: Type.STRING },
    track: { type: Type.STRING },
    confidence: { 
      type: Type.NUMBER,
      minimum: 0,
      maximum: 1
    },
    reasoning: { type: Type.STRING },
    alternatives: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    modifiers: {
      type: Type.OBJECT,
      properties: {
        exclude: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        obscurity: {
          type: Type.STRING,
          enum: ["popular", "obscure", "rare", "deep_cut", "hidden"]
        },
        version: { type: Type.STRING }
      }
    },
    value: { type: Type.NUMBER } // For volume commands
  },
  required: ["intent", "confidence", "reasoning"],
  propertyOrdering: [
    "intent", 
    "query", 
    "artist", 
    "track", 
    "confidence", 
    "reasoning", 
    "alternatives", 
    "modifiers", 
    "value"
  ]
};
```

## Migration from Legacy Package

If you're using the older `@google/generative-ai` package:

### Legacy Package Approach

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const generationConfig = {
  temperature: 0.7,
  responseMimeType: 'application/json',
  responseSchema: {
    type: "object",
    properties: {
      intent: { type: "string" },
      query: { type: "string" },
      confidence: { type: "number" }
    },
    required: ["intent", "confidence"]
  }
};

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig
});
```

### Recommended Migration

```typescript
// Install the new package
npm install @google/genai

// Update your imports
import { GoogleGenAI, Type } from "@google/genai";

// Use the new API
const ai = new GoogleGenAI({ project: "your-project" });
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: schema
  }
});
```

## Common Pitfalls

### ❌ Don't Duplicate Schema in Prompts

```typescript
// BAD: Don't do this
const prompt = "Return your response in JSON format with fields: intent, query, confidence";
const config = {
  responseMimeType: "application/json",
  responseSchema: schema // This conflicts with the prompt
};
```

### ❌ Don't Make Schemas Too Complex

```typescript
// BAD: Overly complex schema
const badSchema = {
  type: Type.OBJECT,
  properties: {
    level1: {
      type: Type.OBJECT,
      properties: {
        level2: {
          type: Type.OBJECT,
          properties: {
            level3: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  // Too many nested levels
                }
              }
            }
          }
        }
      }
    }
  }
};
```

### ❌ Don't Forget Required Fields

```typescript
// BAD: No required fields specified
const unreliableSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING },
    confidence: { type: Type.NUMBER }
  }
  // Missing: required: ["intent", "confidence"]
};
```

## Troubleshooting

### Schema Validation Errors

If you're getting schema validation errors:

1. **Check schema complexity** - Simplify nested structures
2. **Verify required fields** - Ensure all required fields are properly specified
3. **Test with minimal schema** - Start simple and add complexity gradually

### Inconsistent Output

If output is still inconsistent:

1. **Add propertyOrdering** - Ensures consistent field order
2. **Use enums** - Constrain string values to specific options
3. **Specify constraints** - Add minimum/maximum for numbers

### Performance Issues

If schema processing is slow:

1. **Reduce schema size** - Remember schemas count toward token limits
2. **Cache schemas** - Don't regenerate schemas on each request
3. **Use simpler types** - Avoid complex nested structures

### Fallback Strategy

For maximum reliability, implement a fallback approach:

```typescript
async function generateWithFallback(prompt: string) {
  try {
    // Try with native schema first
    return await generateWithSchema(prompt);
  } catch (error) {
    console.warn('Schema generation failed, falling back to prompt engineering');
    // Fallback to prompt engineering
    return await generateWithPrompt(prompt);
  }
}
```

## Key Takeaways

1. **Native structured output is significantly more reliable** than prompt engineering
2. **Keep schemas simple and focused** for best results
3. **Always specify required fields** and property ordering
4. **Use enums for constrained values** to improve consistency
5. **Test with minimal schemas first** before adding complexity
6. **Consider the new `@google/genai` package** for latest features

## Resources

- [Google AI Structured Output Documentation](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API Response Schema Reference](https://cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1/GenerationConfig)
- [OpenAPI 3.0 Schema Specification](https://swagger.io/specification/)

---

*This guide is based on research conducted in January 2025 and reflects best practices for Gemini 2.5 Flash JSON output.*