# GPT-5 Integration Refactor Specification

## Problem Statement

GPT-5 integration is failing to work correctly with the DJ Forge application due to fundamental architectural issues in how schemas and prompts are managed across different LLM providers.

### Current Issues

1. **Empty Required Fields**: GPT-5 returns empty `artist` and `track` fields for `play_specific_song` intent, causing UI failures
2. **Inconsistent Prompts**: Claude/OpenRouter and GPT-5 receive completely different prompts from different files
3. **Schema Misalignment**: Zod schemas mark critical fields as optional when they're required for specific intents
4. **Duplicate Prompt Maintenance**: Same logic exists in multiple files with different formats
5. **No Discriminated Unions**: Schema doesn't enforce conditional field requirements based on intent type
6. **Unexpected JSON Fields**: GPT-5 adds fields like `checklist` that break the UI
7. **Missing Intent Support**: `clarification_mode` intent missing from OpenAI schema enum

## Root Causes

### 1. Dual Prompt System
- **Claude/OpenRouter**: Uses prompt from `/server/src/routes/simple-llm-interpreter.ts` with explicit JSON examples
- **GPT-5**: Uses prompt from `/server/src/llm/openai-schemas.ts` with Zod schema definitions
- **Result**: GPT-5 lacks concrete examples showing required field structure

### 2. Schema Definition Issues
```typescript
// Current schema - everything is optional
artist: z.string().optional()
track: z.string().optional()

// But UI requires these for play_specific_song!
```

### 3. OpenAI "Optimization" Problem
- OpenAI's prompt optimizer tool converted JSON examples to Zod schemas
- Lost critical context about field requirements
- Added confusing instructions like "Begin with a checklist" that GPT-5 interprets literally

## Proposed Solution Architecture

### 1. Unified Schema with Discriminated Unions

Create proper discriminated unions in Zod that enforce field requirements per intent:

```typescript
// schemas.ts
const BaseCommand = z.object({
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  modifiers: ModifiersSchema.optional(),
  isAIDiscovery: z.boolean().optional(),
  aiReasoning: z.string().optional()
});

const PlaySpecificSongSchema = BaseCommand.extend({
  intent: z.literal('play_specific_song'),
  artist: z.string().min(1), // REQUIRED
  track: z.string().min(1),  // REQUIRED
  album: z.string().optional(),
  alternatives: z.array(AlternativeSchema).optional()
});

const QueueMultipleSongsSchema = BaseCommand.extend({
  intent: z.literal('queue_multiple_songs'),
  songs: z.array(z.object({
    artist: z.string().min(1),
    track: z.string().min(1),
    album: z.string().optional()
  })).min(1).max(10), // REQUIRED array
  theme: z.string().optional()
});

const ClarificationModeSchema = BaseCommand.extend({
  intent: z.literal('clarification_mode'),
  responseMessage: z.string(),
  currentContext: z.object({
    rejected: z.string(),
    rejectionType: z.enum(['artist', 'genre', 'mood', 'song'])
  }),
  options: z.array(ClarificationOptionSchema).min(4).max(5),
  uiType: z.literal('clarification_buttons')
});

// ... other intent schemas ...

export const MusicCommandSchema = z.discriminatedUnion('intent', [
  PlaySpecificSongSchema,
  QueueSpecificSongSchema,
  QueueMultipleSongsSchema,
  PlayPlaylistSchema,
  ClarificationModeSchema,
  ChatSchema,
  // ... all other schemas
]);
```

### 2. Unified Prompt System

Create a single source of truth for prompts:

```typescript
// prompts/unified-music-prompt.ts
export const UNIFIED_MUSIC_PROMPT = {
  base: `You are a music curator...`,
  
  examples: {
    play_specific_song: {
      description: "When user wants one specific song",
      example: {
        intent: "play_specific_song",
        artist: "Phoebe Bridgers",  // REQUIRED
        track: "Motion Sickness",    // REQUIRED
        confidence: 0.9,
        reasoning: "Selected based on indie preference"
      }
    },
    queue_multiple_songs: {
      description: "When user wants multiple songs",
      example: {
        intent: "queue_multiple_songs",
        songs: [  // REQUIRED array
          { artist: "Boygenius", track: "True Blue" },
          { artist: "Soccer Mommy", track: "Circle the Drain" }
        ],
        confidence: 0.9,
        reasoning: "Selected indie tracks"
      }
    },
    clarification_mode: {
      description: "When user says 'play something else', 'not this'",
      example: {
        intent: "clarification_mode",
        responseMessage: "What direction would you like?",
        currentContext: { rejected: "Phoebe Bridgers", rejectionType: "artist" },
        options: [/* ... */],
        uiType: "clarification_buttons"
      }
    }
  },
  
  rules: {
    play_specific_song: [
      "MUST provide artist and track fields",
      "Do NOT leave these empty",
      "Do NOT put info only in aiReasoning"
    ],
    clarification_mode: [
      "Use for 'play something else', 'not this', 'something different'",
      "NEVER use ask_question for rejection",
      "Provide 4-5 specific alternatives"
    ]
  }
};
```

### 3. Provider-Specific Adapters

```typescript
// providers/prompt-adapter.ts
export class PromptAdapter {
  static forOpenRouter(unifiedPrompt: UnifiedPrompt): string {
    // Convert to text format with JSON examples
    return `${unifiedPrompt.base}
    
    RESPONSE FORMAT:
    ${JSON.stringify(unifiedPrompt.examples.play_specific_song.example, null, 2)}
    
    RULES:
    ${unifiedPrompt.rules.play_specific_song.join('\n')}`;
  }
  
  static forOpenAI(unifiedPrompt: UnifiedPrompt): string {
    // Convert to OpenAI's preferred format
    // NO "Begin with checklist" instruction!
    return `${unifiedPrompt.base}
    
    # CRITICAL REQUIREMENTS
    ${Object.entries(unifiedPrompt.rules).map(([intent, rules]) => 
      `For ${intent}:\n${rules.map(r => `- ${r}`).join('\n')}`
    ).join('\n\n')}
    
    # EXAMPLES
    ${Object.entries(unifiedPrompt.examples).map(([key, val]) =>
      `${val.description}:\n\`\`\`json\n${JSON.stringify(val.example, null, 2)}\n\`\`\``
    ).join('\n\n')}`;
  }
  
  static forGemini(unifiedPrompt: UnifiedPrompt): string {
    // Gemini-specific formatting
    return unifiedPrompt.base + '\n\n' + 
           'You will receive a responseSchema that defines the exact structure.';
  }
}
```

### 4. OpenAI Schema Generator

```typescript
// openai-schemas.ts
export function generateOpenAISchema() {
  const discriminatedSchemas = [
    PlaySpecificSongSchema,
    QueueMultipleSongsSchema,
    ClarificationModeSchema,
    // ...
  ];
  
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: 'music_command',
      strict: false,
      schema: {
        type: 'object',
        oneOf: discriminatedSchemas.map(schema => 
          zodToJsonSchema(schema)
        ),
        discriminator: { propertyName: 'intent' }
      }
    }
  };
}
```

### 5. Runtime Validation

```typescript
// validation/command-validator.ts
export function validateMusicCommand(data: unknown): ValidationResult {
  const result = MusicCommandSchema.safeParse(data);
  
  if (!result.success) {
    // Specific error messages for common issues
    const errors = result.error.issues;
    
    if (errors.some(e => e.path.includes('artist') && e.code === 'too_small')) {
      return {
        isValid: false,
        error: "Artist field is required for play_specific_song intent"
      };
    }
    
    if (errors.some(e => e.path.includes('track') && e.code === 'too_small')) {
      return {
        isValid: false,
        error: "Track field is required for play_specific_song intent"
      };
    }
  }
  
  return { isValid: true, data: result.data };
}
```

## Implementation Steps

### Phase 1: Schema Refactor
1. Create discriminated union schemas in `schemas.ts`
2. Update TypeScript types to use inferred types from Zod
3. Add comprehensive tests for each intent type

### Phase 2: Unified Prompt System
1. Create `prompts/unified-music-prompt.ts` with all examples
2. Implement `PromptAdapter` class for provider-specific formatting
3. Remove duplicate prompt definitions from multiple files

### Phase 3: OpenAI Integration Fix
1. Update `OpenAIProvider` to use new prompt adapter
2. Fix `openai-schemas.ts` to generate proper discriminated schemas
3. Remove "checklist" and other problematic instructions
4. Add `clarification_mode` to all relevant enums

### Phase 4: Testing & Validation
1. Add integration tests for each provider
2. Test all intent types with production-like data
3. Validate that UI receives required fields
4. Performance testing with new schema structure

### Phase 5: Deployment
1. Deploy to production
2. Monitor error rates
3. Verify all intents work correctly

## Success Metrics

1. **Zero "empty field" errors** for play_specific_song intent
2. **Consistent responses** across all LLM providers
3. **Reduced prompt maintenance** - single source of truth
4. **Better type safety** - compile-time guarantees for required fields
5. **Improved error messages** - clear validation feedback

## File Structure After Refactor

```
server/src/llm/
├── schemas/
│   ├── base.ts              # Base schemas and shared types
│   ├── intents/             # Intent-specific schemas
│   │   ├── play.ts
│   │   ├── queue.ts
│   │   ├── clarification.ts
│   │   └── ...
│   └── index.ts             # Discriminated union export
├── prompts/
│   ├── unified-prompt.ts    # Single source of truth
│   ├── examples.ts          # JSON examples
│   └── adapter.ts           # Provider-specific formatting
├── providers/
│   ├── openai.ts           # Uses prompt adapter
│   ├── openrouter.ts       # Uses prompt adapter
│   └── gemini.ts           # Uses prompt adapter
└── validation/
    └── command-validator.ts # Runtime validation
```

## Key Insights

1. **The root problem is architectural** - not just prompt tweaking
2. **Discriminated unions solve the optional field problem** at the type level
3. **Unified prompts reduce maintenance burden** and inconsistencies
4. **Provider adapters allow optimization** without losing consistency
5. **GPT-5's literal interpretation** requires explicit, unambiguous instructions
6. **JSON examples are crucial** - schemas alone aren't enough for LLMs

This refactor will make the system more maintainable, type-safe, and consistent across all LLM providers while fixing the immediate GPT-5 issues.