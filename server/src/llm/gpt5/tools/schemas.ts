import { z } from 'zod';
import { MusicAlternativesSchema } from '../../schemas/v2/music-alternatives';
import { PlaySpecificSongSchema } from '../../schemas/v2/spotify-actions';

// Session validation schema - runtime validation for loaded sessions
export const SessionDataSchema = z.object({
  lastResponseId: z.string().nullable(),
  conversationHistory: z.array(z.object({
    responseId: z.string(),
    input: z.string(),
    output: z.string(),
    timestamp: z.string(),
    model: z.string(),
    usage: z.any().optional(), // ResponseUsage type is complex, using any for now
    hadFunctionCall: z.boolean().optional() // Track if response had function calls
  })),
  metadata: z.record(z.any())
});

// Tool schemas using Zod
export const WeatherSchema = z.object({
  location: z.string().describe("City and state, e.g. San Francisco, CA"),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius")
});

export const MusicSearchSchema = z.object({
  query: z.string().describe("Artist name, song title, or genre"),
  type: z.enum(["track", "artist", "album", "playlist"]).default("track"),
  limit: z.number().min(1).max(50).default(10)
});

export const CodeExecutionSchema = z.object({
  language: z.enum(["python", "javascript", "typescript", "bash"]),
  code: z.string().describe("Code to execute"),
  timeout: z.number().default(5000).describe("Execution timeout in ms")
});

/**
 * Music Alternatives Schema for Rejection Scenarios
 * 
 * This schema handles the "clarification_mode" intent when users reject
 * a song/artist and say things like "play something else", "not this", etc.
 * 
 * The function provides 4-5 alternative music directions, each with:
 * - An emoji label for visual distinction in UI
 * - A short descriptive label
 * - An internal value identifier
 * - A longer description of the alternative
 * - An example query that would be executed if selected
 * 
 * Example emojis: ⚡🎸🎹🎤🎵🎺🎷🕺💃📼☀️🎲
 * 
 * This enables smart contextual alternatives based on what was rejected,
 * such as offering "More upbeat indie" if user rejects "Phoebe Bridgers"
 */
// MusicAlternativesSchema is now imported from ../../../schemas/v2/music-alternatives

export { MusicAlternativesSchema, PlaySpecificSongSchema };