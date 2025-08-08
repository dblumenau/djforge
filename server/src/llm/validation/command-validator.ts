import { z } from 'zod';
import { MusicCommandSchema } from '../schemas/index';

export interface ValidationResult {
  isValid: boolean;
  data?: any;
  error?: string;
  details?: z.ZodError;
  suggestions?: string[];
}

/**
 * Validate a music command against the discriminated union schema
 * Provides detailed error messages for common issues
 */
export function validateMusicCommand(data: unknown): ValidationResult {
  try {
    const result = MusicCommandSchema.safeParse(data);
    
    if (result.success) {
      return {
        isValid: true,
        data: result.data
      };
    }
    
    // Parse errors to provide helpful messages
    const errors = result.error.issues;
    const errorMessages: string[] = [];
    const suggestions: string[] = [];
    
    // Check for specific common errors
    for (const error of errors) {
      const path = error.path.join('.');
      
      // Check for missing required fields in play_specific_song
      if (path === 'artist' && error.code === 'too_small') {
        errorMessages.push('Artist field is required for play_specific_song intent');
        suggestions.push('Ensure the artist field is not empty');
      } else if (path === 'track' && error.code === 'too_small') {
        errorMessages.push('Track field is required for play_specific_song intent');
        suggestions.push('Ensure the track field is not empty');
      } 
      // Check for missing songs array in queue_multiple_songs
      else if (path === 'songs' && error.code === 'too_small') {
        errorMessages.push('Songs array is required for queue_multiple_songs intent');
        suggestions.push('Provide an array of 1-10 songs with artist and track fields');
      }
      // Check for invalid intent
      else if (path === 'intent' && error.code === 'invalid_union_discriminator') {
        errorMessages.push(`Invalid intent: ${(data as any)?.intent}`);
        suggestions.push('Use a valid intent from the schema');
        
        // Check if it's a deprecated intent
        const deprecatedIntents = ['search_and_play', 'queue_add', 'search_and_queue'];
        if (deprecatedIntents.includes((data as any)?.intent)) {
          suggestions.push(`Intent '${(data as any)?.intent}' is deprecated. Use 'play_specific_song' or 'queue_specific_song' instead`);
        }
      }
      // Check for missing clarification_mode fields
      else if ((data as any)?.intent === 'clarification_mode') {
        if (path === 'responseMessage' && error.code === 'invalid_type') {
          errorMessages.push('responseMessage is required for clarification_mode');
        } else if (path === 'currentContext' && error.code === 'invalid_type') {
          errorMessages.push('currentContext is required for clarification_mode');
        } else if (path === 'options' && error.code === 'too_small') {
          errorMessages.push('options array (4-5 items) is required for clarification_mode');
        }
      }
      // Check for volume level issues
      else if (path === 'volume_level' && (data as any)?.intent === 'set_volume') {
        if (error.code === 'invalid_type') {
          errorMessages.push('volume_level must be a number for set_volume intent');
        } else if (error.code === 'too_small' || error.code === 'too_big') {
          errorMessages.push('volume_level must be between 0 and 100');
        }
      }
      // Check for query field issues (playlists, etc)
      else if (path === 'query' && error.code === 'too_small') {
        errorMessages.push('Query field cannot be empty for this intent');
        suggestions.push('Provide a valid search query or playlist name');
      }
      // Generic error for other cases
      else {
        errorMessages.push(`${path}: ${error.message}`);
      }
    }
    
    return {
      isValid: false,
      error: errorMessages.join('; '),
      details: result.error,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
    
  } catch (error) {
    return {
      isValid: false,
      error: `Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Validate and fix common issues in music commands
 * Attempts to repair minor issues while maintaining data integrity
 */
export function validateAndRepair(data: any): ValidationResult {
  // First try direct validation
  const initialResult = validateMusicCommand(data);
  if (initialResult.isValid) {
    return initialResult;
  }
  
  // Attempt repairs for common issues
  const repaired = { ...data };
  let wasRepaired = false;
  
  // Fix empty strings that should be present - DON'T repair, just return error
  if (repaired.intent === 'play_specific_song' || repaired.intent === 'queue_specific_song') {
    if (repaired.artist === '') {
      return {
        isValid: false,
        error: 'Artist cannot be empty for song-specific intents',
        suggestions: ['Provide a valid artist name']
      };
    }
    if (repaired.track === '') {
      return {
        isValid: false,
        error: 'Track cannot be empty for song-specific intents',
        suggestions: ['Provide a valid track name']
      };
    }
  }
  
  // Fix deprecated intents
  if (repaired.intent === 'search_and_play') {
    repaired.intent = 'play_specific_song';
    wasRepaired = true;
  } else if (repaired.intent === 'search_and_queue' || repaired.intent === 'queue_add') {
    repaired.intent = 'queue_specific_song';
    wasRepaired = true;
  }
  
  // Ensure confidence is in range
  if (typeof repaired.confidence === 'number') {
    if (repaired.confidence > 1) {
      repaired.confidence = repaired.confidence / 100; // Assume it was a percentage
      wasRepaired = true;
    }
    repaired.confidence = Math.max(0, Math.min(1, repaired.confidence));
  } else if (repaired.confidence === undefined || repaired.confidence === null) {
    repaired.confidence = 0.7; // Default confidence
    wasRepaired = true;
  }
  
  // Ensure reasoning exists
  if (!repaired.reasoning) {
    repaired.reasoning = 'Interpreted from user command';
    wasRepaired = true;
  }
  
  // Only re-validate if we actually made repairs
  if (wasRepaired) {
    return validateMusicCommand(repaired);
  }
  
  // If no repairs were made, return the original error
  return initialResult;
}

/**
 * Check if a command needs user confirmation based on confidence
 */
export function needsConfirmation(command: any): boolean {
  const destructiveIntents = [
    'play_specific_song',
    'queue_specific_song',
    'play_playlist',
    'queue_playlist',
    'queue_multiple_songs'
  ];
  
  const isDestructive = destructiveIntents.includes(command.intent);
  const lowConfidence = command.confidence < 0.7;
  
  return isDestructive && lowConfidence;
}

/**
 * Extract essential fields even if validation fails
 * Used as a fallback for partial data
 */
export function extractEssentialFields(data: any): any {
  return {
    intent: data.intent || 'unknown',
    confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
    reasoning: data.reasoning || 'Fallback extraction',
    // Extract fields based on intent
    ...(data.intent === 'play_specific_song' && {
      artist: data.artist || '',
      track: data.track || ''
    }),
    ...(data.intent === 'queue_multiple_songs' && {
      songs: Array.isArray(data.songs) ? data.songs : []
    }),
    ...(data.intent === 'set_volume' && {
      volume_level: data.volume_level || data.volume || 50
    })
  };
}