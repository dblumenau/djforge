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
import { 
  FULL_CURATOR_GUIDELINES,
  ALTERNATIVES_APPROACH,
  RESPONSE_VARIATION,
  CONVERSATIONAL_ASSISTANT_PROMPT
} from './music-curator-prompts';

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
        'set_volume',
        'resume',
        'next',
        'back',
        'get_current_track',
        'set_shuffle',
        'set_repeat',
        'clear_queue',
        'get_devices',
        'get_playlists',
        'get_recently_played',
        'search',
        'get_playback_info',
        'chat',
        'ask_question',
        'clarification_mode',
        'explain_reasoning',
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
    volume_level: {
      type: Type.NUMBER,
      description: 'Volume level between 0-100',
      minimum: 0,
      maximum: 100
    },
    enabled: {
      type: Type.BOOLEAN,
      description: 'Boolean flag for shuffle/repeat commands'
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
    },
    isAIDiscovery: {
      type: Type.BOOLEAN,
      description: 'True when AI made creative choice (not following explicit user request)'
    },
    aiReasoning: {
      type: Type.STRING,
      description: 'Brief explanation (1-2 sentences) of why AI chose this when isAIDiscovery is true'
    },
    currentContext: {
      type: Type.OBJECT,
      properties: {
        rejected: {
          type: Type.STRING,
          description: 'What the user rejected (artist name, genre, etc.)'
        },
        rejectionType: {
          type: Type.STRING,
          enum: ['artist', 'genre', 'mood', 'song', 'style'],
          description: 'Type of rejection'
        }
      },
      description: 'Context about what was rejected for clarification_mode'
    },
    options: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          direction: {
            type: Type.STRING,
            description: 'Unique identifier for this direction'
          },
          description: {
            type: Type.STRING,
            description: 'User-friendly description of this alternative'
          },
          example: {
            type: Type.STRING,
            description: 'Specific example or explanation'
          },
          icon: {
            type: Type.STRING,
            description: 'Emoji icon representing this direction'
          },
          followUpQuery: {
            type: Type.STRING,
            description: 'Command to send when user selects this option'
          }
        },
        required: ['direction', 'description', 'example', 'icon']
      },
      description: 'Alternative directions for clarification_mode'
    },
    uiType: {
      type: Type.STRING,
      enum: ['clarification_buttons', 'text_response'],
      description: 'UI type for rendering the response'
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
    'volume_level',
    'enabled',
    'modifiers',
    'confidence',
    'reasoning',
    'alternatives',
    'enhancedQuery',
    'responseMessage',
    'songs',
    'theme',
    'isAIDiscovery',
    'aiReasoning'
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
  MUSIC_INTERPRETER: `You are a thoughtful music curator with encyclopedic knowledge of music across all genres and eras.

### Primary Goal ###
Your single most important goal is to find excellent matches for the user's request.

### How to Use the Provided Context ###
1. **User Request**: This is your primary instruction. Fulfill it directly and precisely.
2. **Currently Playing Track**: Information about what's playing right now (if anything).
3. **User Taste Profile**: This is secondary reference information.
   - DO use it if the User Request is vague (e.g., "play something for me", "I want new music")
   - DO NOT let it override a specific User Request for a genre, artist, or style. If the request is for 'spoken-word', you must provide 'spoken-word', even if it's not in the user's profile.
4. **Conversation History**: Last 10 messages for context
   - Use this to understand contextual references like "play that again", "the second one", "what we were talking about"
   - For follow-up questions, use this history to maintain context
   - This history should NOT overly influence new music recommendations
   - Make fresh recommendations based on the current request, not past conversations

${FULL_CURATOR_GUIDELINES}

Your task is to understand natural language music commands and convert them to structured responses.

You can understand:
- Vague descriptions ("that song from the movie")
- Mood-based requests ("something melancholy")
- Era/genre specific requests ("80s synthpop")
- Obscurity preferences ("deep cuts", "B-sides", "rare tracks")
- Version preferences ("acoustic version", "original not remaster")

Key guidelines:
- Always provide a confidence score between 0 and 1
- Include reasoning for your interpretation
- ${ALTERNATIVES_APPROACH}
- ${RESPONSE_VARIATION}
- Use enhanced Spotify search queries when possible
- Be creative in interpreting vague requests while maintaining accuracy
- CONFIDENCE: Use HIGH confidence (0.8-0.95) for clear commands even if song choice is vague
  * "play something nice" = 0.85+ confidence (clear intent to play music)
  * "play me something" = 0.85+ confidence (clear intent to play music)
  * Only use low confidence (<0.7) when the intent itself is unclear
- IMPORTANT: For conversational intents (chat, ask_question, get_playback_info), you MUST include the actual answer in the responseMessage field. ${CONVERSATIONAL_ASSISTANT_PROMPT}
- CRITICAL: For get_playback_info intent, use the "Currently Playing Track" section to answer questions like "what's playing", "current song", etc.
- CRITICAL: For queue_multiple_songs intent, you MUST provide 5-8 specific songs in the songs array. Each song needs artist, track, and optionally album. Do NOT return queue_multiple_songs without the songs array!
- IMPORTANT: For queue_multiple_songs, analyze the context (current song, recent plays) to suggest similar songs
- CRITICAL: For ALBUM requests (when user mentions "album"), use play_playlist or queue_playlist intent with the query field containing the album name, artist, and the word "album" (e.g., "lover taylor swift album", "dark side of the moon album")

Supported intents: play_specific_song, queue_specific_song, queue_multiple_songs, play_playlist (also for albums), queue_playlist (also for albums), play, pause, skip, previous, volume, set_volume, resume, next, back, get_current_track, set_shuffle, set_repeat, clear_queue, get_devices, get_playlists, get_recently_played, search, get_playback_info, chat, ask_question, unknown.

Album Request Examples:
- "play the album lover by taylor swift" → intent: play_playlist, query: "lover taylor swift album"
- "queue folklore album" → intent: queue_playlist, query: "folklore album"
- "play dark side of the moon" → intent: play_playlist, query: "dark side of the moon album"
- "play taylor swift's 1989" → intent: play_playlist, query: "1989 taylor swift album"

AI Discovery Detection: Set isAIDiscovery: true for ALL songs you queue/play EXCEPT when the user explicitly names BOTH artist AND track. Include aiReasoning (keep it brief - 1-2 sentences max). Examples:
- "play something melancholy" → isAIDiscovery: true (you choose the specific track)
- "queue up something else that is sad" → isAIDiscovery: true (you choose the tracks)
- "play some Taylor Swift" → isAIDiscovery: true (you choose which Taylor Swift songs)
- "queue songs like this one" → isAIDiscovery: true (you choose similar songs)
- "play my discover weekly" → isAIDiscovery: true (you select from the playlist)
- "play Anti-Hero by Taylor Swift" → isAIDiscovery: false (user specified exact artist AND track)
- "play the song I just mentioned" → isAIDiscovery: false (direct repeat of user's specific request)

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

// Playlist Discovery Selection Schema - For selecting best playlists from search results
export const PlaylistSelectionSchema = {
  type: Type.OBJECT,
  properties: {
    selectedPlaylistIds: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        description: 'Spotify playlist ID'
      },
      description: 'Array of selected playlist IDs that best match the user query'
    },
    reasoning: {
      type: Type.STRING,
      description: 'Brief explanation of why these playlists were selected'
    }
  },
  required: ['selectedPlaylistIds'],
  propertyOrdering: ['selectedPlaylistIds', 'reasoning']
};

// Playlist Discovery Summarization Schema - For generating playlist summaries with characteristics
export const PlaylistSummarizationSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: '2-3 sentence description of the playlist'
    },
    characteristics: {
      type: Type.OBJECT,
      properties: {
        primaryGenre: {
          type: Type.STRING,
          description: 'Primary music genre'
        },
        mood: {
          type: Type.STRING,
          description: 'Overall mood or vibe'
        },
        instrumentation: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: 'Key instruments featured'
        },
        tempo: {
          type: Type.STRING,
          enum: ['slow', 'medium', 'fast', 'varied'],
          description: 'Overall tempo'
        },
        decadeRange: {
          type: Type.STRING,
          description: 'Decade range of music (e.g., "2010s-2020s")'
        }
      },
      required: ['primaryGenre', 'mood', 'tempo']
    },
    matchScore: {
      type: Type.NUMBER,
      description: 'Match score between 0.0 and 1.0',
      minimum: 0,
      maximum: 1
    },
    reasoning: {
      type: Type.STRING,
      description: 'Brief explanation of the match score'
    }
  },
  required: ['summary', 'characteristics', 'matchScore'],
  propertyOrdering: ['summary', 'characteristics', 'matchScore', 'reasoning']
};

// Schema selection helper
export function getSchemaForIntent(intentType: string) {
  switch (intentType) {
    case 'playlist_selection':
      return PlaylistSelectionSchema;
    case 'playlist_summarization':
      return PlaylistSummarizationSchema;
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
    case 'playlist_selection':
      return 'You are a music curator AI that analyzes playlists and selects the best matches for user queries. Focus on relevance, quality, and variety. Always respond with valid JSON.';
    case 'playlist_summarization':
      return 'You are a music analysis AI that creates engaging summaries of Spotify playlists. Focus on being informative yet concise. Identify key characteristics and assess match quality. Always respond with valid JSON.';
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