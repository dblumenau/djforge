import { z } from 'zod';
import { MusicAlternativesSchema, MusicAlternatives } from '../../schemas/v2/music-alternatives';
import { PlaySpecificSongSchema, PlaySpecificSongResult } from '../../schemas/v2/spotify-actions';
import { SpotifyControl } from '../../../spotify/control';
import { SpotifyAuthTokens } from '../../../types';

/**
 * Function implementations for GPT-5 Responses API
 * 
 * These are the actual function implementations that get executed
 * when the model calls them via the Responses API function calling.
 */

/**
 * Function result type that includes status signals for the AI
 */
export interface MusicAlternativesResult extends MusicAlternatives {
  // Signal to AI that alternatives are ready and no further calls needed
  status: 'alternatives_ready';
  // Indicates we're waiting for user to select an option
  userAction: 'awaiting_selection';
}

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
): Promise<MusicAlternativesResult> {
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
  // Include a signal that alternatives have been successfully provided
  return {
    responseMessage: responseMessage || `What would you like to hear instead of ${rejectedItem.name}?`,
    rejectedItem,
    alternatives: finalAlternatives,
    // Signal to the AI that alternatives are ready for user presentation
    status: 'alternatives_ready',
    userAction: 'awaiting_selection'
  };
}

/**
 * Context passed to functions that need external services
 */
export interface FunctionContext {
  spotifyTokens?: SpotifyAuthTokens;
  userId?: string;
}

/**
 * Play a specific song on Spotify
 * 
 * This function searches for and plays a specific track immediately,
 * replacing the current queue.
 * 
 * Example use cases:
 * - User: "Play Bohemian Rhapsody by Queen"
 * - User: "Play Hotel California"
 * - User: "Play that Taylor Swift song about December"
 */
export async function playSpecificSong(
  args: z.infer<typeof PlaySpecificSongSchema>,
  context?: FunctionContext
): Promise<PlaySpecificSongResult> {
  // Validate the arguments
  const validated = PlaySpecificSongSchema.parse(args);
  
  // Check if we have Spotify tokens
  if (!context?.spotifyTokens) {
    return {
      success: false,
      message: 'Spotify authentication required. Please log in to Spotify first.',
      status: 'failed',
      error: 'No Spotify tokens available'
    };
  }
  
  try {
    // Create SpotifyControl instance
    const spotifyControl = new SpotifyControl(
      context.spotifyTokens,
      // Token refresh callback - we'll update context if needed
      (newTokens) => {
        if (context) {
          context.spotifyTokens = newTokens;
        }
      }
    );
    
    // Call the searchAndPlay method
    const result = await spotifyControl.searchAndPlay(
      `${validated.artist} ${validated.track}`,
      validated.artist,
      validated.track,
      validated.album || undefined
    );
    
    // Transform the result to our expected format
    if (result.success && result.track) {
      return {
        success: true,
        message: result.message,
        track: {
          name: result.track.name,
          artist: result.track.artist,
          album: result.track.album,
          uri: result.track.uri,
          popularity: result.track.popularity
        },
        alternatives: result.alternatives?.map(alt => ({
          name: alt.name,
          artist: alt.artists?.[0]?.name || 'Unknown',
          album: alt.album?.name || 'Unknown',
          uri: alt.uri
        })),
        status: 'playing',
        userAction: 'none'
      };
    } else {
      // Handle the case where no track was found
      return {
        success: false,
        message: result.message || `Could not find "${validated.track}" by ${validated.artist}`,
        status: 'failed',
        userAction: validated.alternatives && validated.alternatives.length > 0 ? 'awaiting_selection' : 'none',
        error: result.message
      };
    }
  } catch (error) {
    console.error('Error playing specific song:', error);
    return {
      success: false,
      message: `Failed to play song: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Map of function names to their implementations
 * Used for runtime function execution
 * 
 * Note: Some functions require a context parameter for external services
 */
export const functionImplementations = {
  provide_music_alternatives: provideMusicAlternatives,
  play_specific_song: playSpecificSong
} as const;

/**
 * Type for function implementations
 */
export type FunctionImplementations = typeof functionImplementations;