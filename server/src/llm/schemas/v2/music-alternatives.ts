import { z } from 'zod';

/**
 * Schema for providing music alternatives when user rejects a song
 * Used by GPT-5 Responses API for structured output with strict mode
 * 
 * Example use case: When user says "I don't like that song, play something else"
 * The system provides 4-5 alternative music directions with emoji labels,
 * such as offering "More upbeat indie" if user rejects "Phoebe Bridgers"
 */
export const MusicAlternativesSchema = z.object({
  responseMessage: z.string().describe("Question asking what direction to go instead"),
  rejectedItem: z.object({
    name: z.string().describe("What was rejected (artist name, song title, genre)"),
    type: z.enum(["artist", "song", "genre", "mood", "style"]).describe("Type of item that was rejected")
  }),
  alternatives: z.array(z.object({
    emoji: z.string().max(2).describe("Single emoji representing this direction"),
    label: z.string().describe("Short descriptive label for the alternative"),
    value: z.string().describe("Internal value identifier"),
    description: z.string().describe("Longer description of what this alternative offers"),
    exampleQuery: z.string().describe("Example command to execute if this option is selected")
  })).min(4).max(5).describe("4-5 alternative music directions with emoji labels")
});

export type MusicAlternatives = z.infer<typeof MusicAlternativesSchema>;

/**
 * Tool response types that include music alternatives
 */
export const ToolResponseSchemas = {
  provide_music_alternatives: MusicAlternativesSchema
};

export type ToolResponses = {
  provide_music_alternatives: MusicAlternatives;
};