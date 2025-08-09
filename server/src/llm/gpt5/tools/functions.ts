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
 * This function generates contextual music alternatives based on what was rejected,
 * providing 4-5 options with emoji labels for the UI.
 * 
 * Example use cases:
 * - User: "I don't like that song, play something else" 
 * - User: "Not this artist, different music please"
 * - User: "Play something different from Taylor Swift"
 */
export async function provideMusicAlternatives(
  args: z.infer<typeof MusicAlternativesSchema>
): Promise<MusicAlternatives> {
  // For the Responses API, we actually need to generate the alternatives
  // based on what was rejected. This is a demonstration implementation.
  
  const { rejectedItem } = args;
  
  // Generate contextual alternatives based on what was rejected
  const alternatives: MusicAlternatives['alternatives'] = [];
  
  if (rejectedItem.type === 'artist') {
    // If they rejected an artist, suggest different genres/moods
    alternatives.push({
      emoji: '⚡',
      label: 'More upbeat',
      value: 'upbeat',
      description: 'Higher energy music with driving beats',
      exampleQuery: 'play upbeat songs'
    });
    alternatives.push({
      emoji: '🎸',
      label: 'Rock/Alternative',
      value: 'rock',
      description: 'Guitar-driven rock and alternative music',
      exampleQuery: 'play rock music'
    });
    alternatives.push({
      emoji: '🎹',
      label: 'Jazz/Soul',
      value: 'jazz',
      description: 'Smooth jazz, soul, and R&B vibes',
      exampleQuery: 'play jazz music'
    });
    alternatives.push({
      emoji: '🎵',
      label: 'Indie/Folk',
      value: 'indie',
      description: 'Independent and folk music',
      exampleQuery: 'play indie folk music'
    });
    alternatives.push({
      emoji: '🕺',
      label: 'Dance/Electronic',
      value: 'electronic',
      description: 'Electronic, dance, and EDM tracks',
      exampleQuery: 'play electronic dance music'
    });
  } else if (rejectedItem.type === 'song') {
    // If they rejected a song, suggest different moods/styles
    alternatives.push({
      emoji: '☀️',
      label: 'Happier mood',
      value: 'happy',
      description: 'Uplifting, positive, feel-good music',
      exampleQuery: 'play happy songs'
    });
    alternatives.push({
      emoji: '🎺',
      label: 'Different genre',
      value: 'different_genre',
      description: 'Try a completely different musical style',
      exampleQuery: 'play something different'
    });
    alternatives.push({
      emoji: '📼',
      label: 'Throwback hits',
      value: 'throwback',
      description: 'Classic hits from past decades',
      exampleQuery: 'play throwback hits'
    });
    alternatives.push({
      emoji: '🎲',
      label: 'Surprise me',
      value: 'random',
      description: 'Random discovery from different genres',
      exampleQuery: 'surprise me with music'
    });
  } else {
    // Generic alternatives for other rejection types
    alternatives.push({
      emoji: '⚡',
      label: 'High energy',
      value: 'high_energy',
      description: 'Energetic, fast-paced music',
      exampleQuery: 'play high energy music'
    });
    alternatives.push({
      emoji: '🎤',
      label: 'Vocal focus',
      value: 'vocals',
      description: 'Great vocals and singing',
      exampleQuery: 'play songs with great vocals'
    });
    alternatives.push({
      emoji: '🎹',
      label: 'Instrumental',
      value: 'instrumental',
      description: 'Focus on instruments and melodies',
      exampleQuery: 'play instrumental music'
    });
    alternatives.push({
      emoji: '🎲',
      label: 'Random discovery',
      value: 'discovery',
      description: 'Discover something completely new',
      exampleQuery: 'play something I haven\'t heard'
    });
  }
  
  // Ensure we have 4-5 alternatives (trim if we have more than 5)
  const finalAlternatives = alternatives.slice(0, 5);
  
  return {
    responseMessage: `What direction would you like to go instead of ${rejectedItem.name}?`,
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