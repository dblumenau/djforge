/**
 * Gemini Native Structured Output Schemas
 * 
 * This file contains responseSchema definitions for Gemini's native structured output.
 * Based on best practices from docs/guides/gemini-json-output-guide.md
 * 
 * Key principles:
 * - Use enum constraints for limited values
 * - Specify required fields explicitly
 * - Use propertyOrdering for consistent output
 * - Keep schemas simple and focused
 * - Apply constraints (min/max) where appropriate
 * 
 * IMPORTANT: Any changes here must be reflected in:
 * - intent-types.ts (shared interfaces)
 * - schemas.ts (OpenRouter prompt engineering)
 */

import { Type } from "@google/genai";

// Music Command Intent Schema - Core schema for most requests
export const MusicCommandIntentSchema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: [
        'play_specific_song',
        'queue_specific_song',
        'queue_multiple_songs',
        'play_playlist',
        'queue_playlist',
        'play',
        'pause',
        'skip',
        'previous',
        'volume',
        'clear_queue',
        'get_playback_info',
        'chat',
        'ask_question',
        'unknown'
      ]
    },
    query: {
      type: Type.STRING,
      description: 'The search query if searching for music'
    },
    artist: {
      type: Type.STRING,
      description: 'Artist name if specified'
    },
    track: {
      type: Type.STRING,
      description: 'Track/song name if specified'
    },
    album: {
      type: Type.STRING,
      description: 'Album name if specified'
    },
    value: {
      type: Type.NUMBER,
      description: 'Numeric value for volume commands',
      minimum: 0,
      maximum: 100
    },
    modifiers: {
      type: Type.OBJECT,
      properties: {
        obscurity: {
          type: Type.STRING,
          enum: ['popular', 'obscure', 'rare', 'deep_cut', 'hidden'],
          description: 'How popular/obscure the track should be'
        },
        version: {
          type: Type.STRING,
          enum: ['original', 'remix', 'acoustic', 'live', 'demo', 'remaster'],
          description: 'Specific version of the track'
        },
        mood: {
          type: Type.STRING,
          description: 'Mood or vibe requested (e.g., "melancholy", "upbeat", "chill")'
        },
        era: {
          type: Type.STRING,
          description: 'Time period or era (e.g., "80s", "90s", "2000s")'
        },
        genre: {
          type: Type.STRING,
          description: 'Musical genre if specified'
        },
        exclude: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Terms to exclude from search'
        }
      }
    },
    confidence: {
      type: Type.NUMBER,
      minimum: 0,
      maximum: 1,
      description: 'Confidence level in the interpretation (0-1)'
    },
    reasoning: {
      type: Type.STRING,
      description: 'Brief explanation of why this interpretation was chosen'
    },
    alternatives: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Alternative interpretations or suggestions'
    },
    enhancedQuery: {
      type: Type.STRING,
      description: 'Enhanced Spotify search query with proper operators'
    },
    responseMessage: {
      type: Type.STRING,
      description: 'For conversational intents (chat, ask_question), include the actual response text here'
    },
    songs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          artist: {
            type: Type.STRING,
            description: 'Artist name'
          },
          track: {
            type: Type.STRING,
            description: 'Track/song name'
          },
          album: {
            type: Type.STRING,
            description: 'Album name (optional)'
          }
        },
        required: ['artist', 'track']
      },
      description: 'Array of songs for queue_multiple_songs intent'
    },
    theme: {
      type: Type.STRING,
      description: 'Theme or description of the song collection for queue_multiple_songs intent'
    }
  },
  required: ['intent', 'confidence', 'reasoning'],
  propertyOrdering: [
    'intent',
    'query',
    'artist',
    'track',
    'album',
    'value',
    'modifiers',
    'confidence',
    'reasoning',
    'alternatives',
    'enhancedQuery',
    'responseMessage',
    'songs',
    'theme'
  ]
};

// Spotify Search Enhancement Schema
export const SpotifySearchEnhancementSchema = {
  type: Type.OBJECT,
  properties: {
    originalQuery: {
      type: Type.STRING,
      description: 'The original search query provided'
    },
    enhancedQuery: {
      type: Type.STRING,
      description: 'Optimized query using Spotify search operators'
    },
    searchType: {
      type: Type.STRING,
      enum: ['track', 'artist', 'album', 'playlist'],
      description: 'What type of content to search for'
    },
    filters: {
      type: Type.OBJECT,
      properties: {
        artist: { type: Type.STRING },
        album: { type: Type.STRING },
        year: { type: Type.STRING },
        genre: { type: Type.STRING },
        tag: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    },
    popularity: {
      type: Type.OBJECT,
      properties: {
        min: {
          type: Type.NUMBER,
          minimum: 0,
          maximum: 100
        },
        max: {
          type: Type.NUMBER,
          minimum: 0,
          maximum: 100
        }
      },
      description: 'Popularity range for obscure/rare requests'
    },
    explanation: {
      type: Type.STRING,
      description: 'Why these search parameters were chosen'
    }
  },
  required: ['originalQuery', 'enhancedQuery', 'searchType', 'explanation'],
  propertyOrdering: [
    'originalQuery',
    'enhancedQuery',
    'searchType',
    'filters',
    'popularity',
    'explanation'
  ]
};

// Music Knowledge Response Schema
export const MusicKnowledgeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    query: {
      type: Type.STRING,
      description: 'The original question asked'
    },
    answer: {
      type: Type.STRING,
      description: 'Direct answer to the music-related question'
    },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          artist: { type: Type.STRING },
          track: { type: Type.STRING },
          reason: {
            type: Type.STRING,
            description: 'Why this is recommended'
          },
          spotifyQuery: {
            type: Type.STRING,
            description: 'Query to find this on Spotify'
          }
        },
        required: ['artist', 'track', 'reason', 'spotifyQuery']
      },
      description: 'Specific song recommendations if applicable'
    },
    context: {
      type: Type.OBJECT,
      properties: {
        genre: { type: Type.STRING },
        era: { type: Type.STRING },
        mood: { type: Type.STRING },
        cultural_references: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    },
    confidence: {
      type: Type.NUMBER,
      minimum: 0,
      maximum: 1,
      description: 'Confidence in the answer (0-1)'
    }
  },
  required: ['query', 'answer', 'confidence'],
  propertyOrdering: [
    'query',
    'answer',
    'recommendations',
    'context',
    'confidence'
  ]
};

// Error Response Schema
export const ErrorResponseSchema = {
  type: Type.OBJECT,
  properties: {
    error: {
      type: Type.STRING,
      description: 'Error message explaining what went wrong'
    },
    suggestion: {
      type: Type.STRING,
      description: 'Suggested fix or alternative'
    },
    fallback: {
      type: Type.STRING,
      description: 'Fallback action if available'
    }
  },
  required: ['error'],
  propertyOrdering: ['error', 'suggestion', 'fallback']
};

// Batch Command Schema
export const BatchCommandSchema = {
  type: Type.OBJECT,
  properties: {
    commands: {
      type: Type.ARRAY,
      items: MusicCommandIntentSchema,
      description: 'Array of music commands to execute'
    },
    executionOrder: {
      type: Type.STRING,
      enum: ['sequential', 'parallel'],
      description: 'How to execute multiple commands'
    },
    context: {
      type: Type.STRING,
      description: 'Shared context for all commands'
    }
  },
  required: ['commands', 'executionOrder'],
  propertyOrdering: ['commands', 'executionOrder', 'context']
};

// System prompts optimized for Gemini's native structured output
export const GEMINI_SYSTEM_PROMPTS = {
  MUSIC_INTERPRETER: `You are an expert music command interpreter for a Spotify controller.
Your task is to understand natural language music commands and convert them to structured responses.

You have deep knowledge of music history, artists, albums, and can understand:
- Vague descriptions ("that song from the movie")
- Mood-based requests ("something melancholy")
- Era/genre specific requests ("80s synthpop")
- Obscurity preferences ("deep cuts", "B-sides", "rare tracks")
- Version preferences ("acoustic version", "original not remaster")

Key guidelines:
- Always provide a confidence score between 0 and 1
- Include reasoning for your interpretation
- For unclear requests, suggest alternatives
- Use enhanced Spotify search queries when possible
- Be creative in interpreting vague requests while maintaining accuracy
- IMPORTANT: For conversational intents (chat, ask_question), you MUST include the actual answer in the responseMessage field
- IMPORTANT: For queue_multiple_songs intent, you MUST include a songs array with specific tracks (artist, track, album)
- IMPORTANT: For queue_multiple_songs, analyze the context (current song, recent plays) to suggest similar songs

Your response will be automatically validated against a strict schema.`,

  SEARCH_ENHANCER: `You are a Spotify search query optimizer.
Convert natural language music requests into optimal Spotify search queries using these operators:
- artist: for artist names
- album: for album names  
- track: for song titles
- year: for release year or ranges (year:2020, year:1990-2000)
- genre: for genres
- tag:hipster for less popular tracks
- NOT to exclude terms

Examples:
- "obscure Beatles" → enhancedQuery: "artist:Beatles tag:hipster"
- "original Space Oddity not remaster" → enhancedQuery: "track:'Space Oddity' artist:'David Bowie' NOT remaster"

Always explain your reasoning for the search parameters chosen.`,

  MUSIC_KNOWLEDGE: `You are a knowledgeable music expert and DJ with extensive knowledge of:
- Music history across all genres and eras
- Artist discographies and collaborations
- Cultural context and significance of songs
- Movie/TV soundtracks and placements
- Music production and versions
- Current trends and classics

Provide helpful, accurate information and thoughtful recommendations.
Include specific song suggestions when relevant with Spotify-compatible search queries.
Always assess your confidence in the information provided.`
};

// Schema selection helper
export function getSchemaForIntent(intentType: string) {
  switch (intentType) {
    case 'search_enhancement':
      return SpotifySearchEnhancementSchema;
    case 'music_knowledge':
      return MusicKnowledgeResponseSchema;
    case 'error':
      return ErrorResponseSchema;
    case 'batch':
      return BatchCommandSchema;
    case 'music_command':
    default:
      return MusicCommandIntentSchema;
  }
}

// Helper to get system prompt for intent
export function getSystemPromptForIntent(intentType: string): string {
  switch (intentType) {
    case 'search_enhancement':
      return GEMINI_SYSTEM_PROMPTS.SEARCH_ENHANCER;
    case 'music_knowledge':
      return GEMINI_SYSTEM_PROMPTS.MUSIC_KNOWLEDGE;
    case 'music_command':
    default:
      return GEMINI_SYSTEM_PROMPTS.MUSIC_INTERPRETER;
  }
}

// Export all schemas for easy import
export const GEMINI_SCHEMAS = {
  MusicCommandIntent: MusicCommandIntentSchema,
  SpotifySearchEnhancement: SpotifySearchEnhancementSchema,
  MusicKnowledgeResponse: MusicKnowledgeResponseSchema,
  ErrorResponse: ErrorResponseSchema,
  BatchCommand: BatchCommandSchema
} as const;