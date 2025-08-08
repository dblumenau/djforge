import { z } from 'zod';

// Shared schemas used across multiple intents
export const ModifiersSchema = z.object({
  obscurity: z.union([
    z.enum(['popular', 'obscure', 'rare', 'deep_cut', 'hidden']),
    z.string()
  ]).optional().nullable(),
  version: z.union([
    z.enum(['original', 'remix', 'acoustic', 'live', 'demo', 'remaster']),
    z.string()
  ]).optional().nullable(),
  mood: z.string().optional().nullable(),
  era: z.string().optional().nullable(),
  genre: z.string().optional().nullable(),
  exclude: z.array(z.string()).nullable().default([])
}).default({ exclude: [] });

export const AlternativeSchema = z.union([
  z.string(),
  z.object({
    intent: z.string().optional().nullable(),
    query: z.string().optional().nullable(),
    theme: z.string().optional().nullable(),
    enhancedQuery: z.string().optional().nullable(),
    isAIDiscovery: z.boolean().optional().nullable(),
    aiReasoning: z.string().optional().nullable()
  })
]);

export const BaseCommandSchema = z.object({
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  modifiers: ModifiersSchema.optional().nullable(),
  isAIDiscovery: z.boolean().optional().nullable(),
  aiReasoning: z.string().optional().nullable()
});

export const SongSchema = z.object({
  artist: z.string().min(1),
  track: z.string().min(1),
  album: z.string().optional().nullable()
});