/**
 * OpenAI-Compatible Schema Generation
 * 
 * This file generates OpenAI-compatible schemas from our Zod discriminated unions.
 * It properly handles the discriminated union structure for OpenAI's structured output.
 */

import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

// Import the new discriminated union schemas
import { 
  MusicCommandSchema,
  PlaySpecificSongSchema,
  QueueSpecificSongSchema,
  QueueMultipleSongsSchema,
  ClarificationModeSchema,
  ChatSchema,
  AskQuestionSchema
} from './schemas/index';

// Import other schemas that might be needed
import { 
  SpotifySearchEnhancementSchema, 
  MusicKnowledgeSchema,
  ErrorResponseSchema,
  BatchCommandSchema,
  PlaylistSelectionSchema,
  PlaylistSummarizationSchema
} from './schemas';

/**
 * Generate OpenAI schema for the unified music command discriminated union
 */
export const OpenAIUnifiedSchema = zodResponseFormat(
  MusicCommandSchema,
  'music_command'
);

/**
 * Generate individual schemas for specific intents (if needed for specialized flows)
 */
export const OpenAIPlaySpecificSongSchema = zodResponseFormat(
  PlaySpecificSongSchema,
  'play_specific_song'
);

export const OpenAIQueueMultipleSongsSchema = zodResponseFormat(
  QueueMultipleSongsSchema,
  'queue_multiple_songs'
);

export const OpenAIClarificationModeSchema = zodResponseFormat(
  ClarificationModeSchema,
  'clarification_mode'
);

/**
 * Helper function to get the appropriate schema for a given intent type
 * This is primarily for backward compatibility and specialized flows
 */
export function getOpenAISchemaForIntent(intentType: string) {
  switch (intentType) {
    case 'music_command':
      return OpenAIUnifiedSchema;
    case 'play_specific_song':
      return OpenAIPlaySpecificSongSchema;
    case 'queue_multiple_songs':
      return OpenAIQueueMultipleSongsSchema;
    case 'clarification_mode':
      return OpenAIClarificationModeSchema;
    case 'spotify_search':
      return zodResponseFormat(SpotifySearchEnhancementSchema, 'spotify_search');
    case 'music_knowledge':
      return zodResponseFormat(MusicKnowledgeSchema, 'music_knowledge');
    default:
      // Default to unified schema for any unspecified intent
      return OpenAIUnifiedSchema;
  }
}

/**
 * Get raw Zod schema for intent (for providers that need it)
 */
export function getRawZodSchemaForIntent(intentType: string) {
  switch (intentType) {
    case 'music_command':
      return MusicCommandSchema;
    case 'play_specific_song':
      return PlaySpecificSongSchema;
    case 'queue_multiple_songs':
      return QueueMultipleSongsSchema;
    case 'clarification_mode':
      return ClarificationModeSchema;
    default:
      return MusicCommandSchema;
  }
}

/**
 * Get the system prompt for OpenAI based on intent type
 * Uses the new unified prompt system
 */
import { PromptAdapter } from './prompts/adapter';

export function getOpenAISystemPromptForIntent(
  intentType: string,
  userRequest?: string,
  tasteProfile?: string,
  conversationContext?: string
): string {
  // For OpenAI, we always use the unified prompt adapter
  // The intentType parameter is kept for backward compatibility
  // but the actual intent is determined by the model based on the user request
  
  if (!userRequest) {
    // If no user request provided, return a basic instruction prompt
    return PromptAdapter.forOpenAI(
      "Interpret the user's music command and respond with the appropriate intent and required fields.",
      tasteProfile,
      conversationContext
    );
  }
  
  return PromptAdapter.forOpenAI(userRequest, tasteProfile, conversationContext);
}

// Note: All schemas are already exported above via individual export statements

/**
 * Legacy exports for backward compatibility
 */
export const OpenAIMusicCommandSchema = OpenAIUnifiedSchema;
export const OpenAISpotifySearchSchema = zodResponseFormat(
  SpotifySearchEnhancementSchema,
  'spotify_search'
);
export const OpenAIMusicKnowledgeSchema = zodResponseFormat(
  MusicKnowledgeSchema,
  'music_knowledge'
);