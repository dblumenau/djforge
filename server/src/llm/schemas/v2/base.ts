import { z } from 'zod';

/**
 * Base schema for all command responses
 * Provides common fields like confidence, reasoning, and modifiers
 */

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

export const BaseCommandSchema = z.object({
  confidence: z.number().min(0).max(1).describe("Confidence level in the interpretation (0-1)"),
  reasoning: z.string().describe("Explanation of why this intent was chosen"),
  modifiers: ModifiersSchema.optional().nullable().describe("Optional modifiers for music selection"),
  isAIDiscovery: z.boolean().optional().nullable().describe("Whether this is an AI-suggested discovery"),
  aiReasoning: z.string().optional().nullable().describe("AI's reasoning for discovery suggestions")
});

export type Modifiers = z.infer<typeof ModifiersSchema>;
export type BaseCommand = z.infer<typeof BaseCommandSchema>;