import { z } from 'zod';
import { MusicAlternativesSchema, MusicAlternatives } from '../../schemas/v2/music-alternatives';

/**
 * Function implementations for GPT-5 Responses API
 * 
 * These are the actual function implementations that get executed
 * when the model calls them via the Responses API function calling.
 */

/**
 * Provides music alternatives when user rejects a song or asks for "something else"
 * 
 * This function acts as a pass-through for the AI's suggestions, allowing GPT-5
 * to provide contextual alternatives that get displayed in the UI.
 * 
 * The AI generates the alternatives based on:
 * - What was rejected (song, artist, genre, playlist)
 * - Current conversation context
 * - User's taste profile
 * - Music knowledge and creativity
 * 
 * Example use cases:
 * - User: "I don't like that song, play something else" 
 * - User: "Not this artist, different music please"
 * - User: "Play something different from Taylor Swift"
 */
export async function provideMusicAlternatives(
  args: z.infer<typeof MusicAlternativesSchema>
): Promise<MusicAlternatives> {
  // IMPORTANT: This function should NOT generate its own alternatives!
  // The AI has already provided thoughtful, contextual alternatives.
  // We simply validate and pass them through to the UI.
  
  const { responseMessage, rejectedItem, alternatives } = args;
  
  // Validate we have the required number of alternatives (1-5)
  if (!alternatives || alternatives.length === 0) {
    throw new Error('AI must provide at least 1 alternative');
  }
  
  if (alternatives.length > 5) {
    console.log(`AI provided ${alternatives.length} alternatives, trimming to 5`);
  }
  
  // Ensure we have at most 5 alternatives for UI consistency
  const finalAlternatives = alternatives.slice(0, 5);
  
  // Log what the AI suggested for debugging
  console.log('AI-generated alternatives:', {
    responseMessage,
    rejectedItem,
    alternativeCount: finalAlternatives.length,
    alternatives: finalAlternatives.map(alt => `${alt.emoji} ${alt.label}`)
  });
  
  // Return exactly what the AI provided (validated and trimmed)
  return {
    responseMessage: responseMessage || `What would you like to hear instead of ${rejectedItem.name}?`,
    rejectedItem,
    alternatives: finalAlternatives
  };
}

/**
 * Map of function names to their implementations
 * Used for runtime function execution
 */
export const functionImplementations = {
  provide_music_alternatives: provideMusicAlternatives
} as const;

/**
 * Type for function implementations
 */
export type FunctionImplementations = typeof functionImplementations;