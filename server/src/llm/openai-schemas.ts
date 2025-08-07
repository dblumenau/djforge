/**
 * OpenAI-Compatible Schema Exports
 * 
 * This file provides unified schema exports for OpenAI's structured output system.
 * It wraps Zod schemas from schemas.ts with zodResponseFormat for OpenAI compatibility.
 * 
 * Benefits:
 * - Single source of truth for schema definitions (schemas.ts)
 * - OpenAI gets properly formatted schemas via zodResponseFormat
 * - OpenRouter continues using raw Zod schemas
 * - Easy to maintain and extend
 * 
 * Usage:
 * - Import pre-wrapped schemas for OpenAI structured output
 * - Use getOpenAISchemaForIntent() helper for dynamic schema selection
 * 
 * IMPORTANT: Any changes to base schemas must be made in schemas.ts
 * This file only provides OpenAI-compatible wrappers
 */

import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { 
  MusicCommandSchema,
  SpotifySearchEnhancementSchema, 
  MusicKnowledgeSchema,
  ErrorResponseSchema,
  BatchCommandSchema,
  PlaylistSelectionSchema,
  PlaylistSummarizationSchema
} from './schemas';

// WORKAROUND: zodResponseFormat has a bug where it generates type: "string" instead of type: "object"
// We'll manually create the proper format until this is fixed
function createOpenAISchema(zodSchema: z.ZodType, name: string) {
  // Helper to extract the actual type from a Zod schema
  function getFieldSchema(field: any): any {
    // Check the type from _def.type first
    const defType = field._def?.type;
    
    // Handle optional fields first
    if (defType === 'optional') {
      return getFieldSchema(field._def.innerType);
    }
    
    // Handle default fields
    if (defType === 'default') {
      return getFieldSchema(field._def.innerType);
    }
    
    // Handle union types
    if (defType === 'union') {
      // For union types, if one is an object, prefer that for richer data
      const options = field._def.options || [];
      const objectOption = options.find((opt: any) => opt._def?.type === 'object');
      
      if (objectOption) {
        // Prefer object type for richer structured data
        return getFieldSchema(objectOption);
      } else {
        // Fall back to first option if no object type
        return getFieldSchema(options[0]);
      }
    }
    
    // Handle basic types based on _def.type
    if (defType === 'string') {
      return { type: 'string' };
    } else if (defType === 'number') {
      return { type: 'number' };
    } else if (defType === 'boolean') {
      return { type: 'boolean' };
    } else if (defType === 'array') {
      // Get the item type from the array definition
      const elementSchema = field._def.element || field._def.type;
      
      // Recursively process the item type to determine what's in the array
      if (elementSchema) {
        const processedItemSchema = getFieldSchema(elementSchema);
        return {
          type: 'array',
          items: processedItemSchema
        };
      } else {
        // Default to string if we can't determine the item type
        return {
          type: 'array',
          items: { type: 'string' }
        };
      }
    } else if (defType === 'object') {
      return { 
        type: 'object',
        additionalProperties: true 
      };
    } else if (defType === 'enum') {
      // Get enum values from entries
      const enumValues = Object.keys(field._def.entries || {});
      return {
        type: 'string',
        enum: enumValues
      };
    } else {
      // Default fallback
      return { type: 'string' };
    }
  }
  
  // Manually create the OpenAI format
  // For OpenAI's strict mode, we need to disable it since our schema has complex nested objects
  return {
    type: 'json_schema' as const,
    json_schema: {
      name,
      strict: false,  // Disable strict mode due to nested objects
      schema: {
        type: 'object',
        properties: (zodSchema as any).shape ? 
          Object.fromEntries(
            Object.entries((zodSchema as any).shape).map(([key, value]: [string, any]) => {
              const schema = getFieldSchema(value);
              // Ensure all objects have additionalProperties set
              if (schema.type === 'object') {
                schema.additionalProperties = false;
              }
              return [key, schema];
            })
          ) : {},
        required: ['intent'],
        additionalProperties: false
      }
    }
  };
}

// OpenAI-compatible schema wrappers
export const OpenAIMusicCommandSchema = createOpenAISchema(
  MusicCommandSchema,
  'music_command'
);

export const OpenAISpotifySearchSchema = createOpenAISchema(
  SpotifySearchEnhancementSchema, 
  'spotify_search'
);

export const OpenAIMusicKnowledgeSchema = createOpenAISchema(
  MusicKnowledgeSchema,
  'music_knowledge'
);

export const OpenAIErrorResponseSchema = createOpenAISchema(
  ErrorResponseSchema,
  'error_response'
);

export const OpenAIBatchCommandSchema = createOpenAISchema(
  BatchCommandSchema,
  'batch_command'
);

// Create OpenAI-compatible wrapped schemas for playlist discovery
export const OpenAIPlaylistSelectionSchema = createOpenAISchema(
  PlaylistSelectionSchema,
  'playlist_selection'
);

export const OpenAIPlaylistSummarizationSchema = createOpenAISchema(
  PlaylistSummarizationSchema,
  'playlist_summarization'
);


/**
 * Get OpenAI-compatible schema for a given intent type
 * 
 * @param intentType - The intent type to get schema for
 * @returns OpenAI-compatible zodResponseFormat schema or null if not supported
 */
export function getOpenAISchemaForIntent(intentType: string) {
  switch (intentType) {
    case 'music_command':
      return OpenAIMusicCommandSchema;
    case 'search_enhancement':
      return OpenAISpotifySearchSchema;
    case 'music_knowledge':
      return OpenAIMusicKnowledgeSchema;
    case 'error':
      return OpenAIErrorResponseSchema;
    case 'batch':
      return OpenAIBatchCommandSchema;
    case 'playlist_selection':
      return OpenAIPlaylistSelectionSchema;
    case 'playlist_summarization':
      return OpenAIPlaylistSummarizationSchema;
    default:
      return null;
  }
}

/**
 * Get raw Zod schema for validation purposes
 * This provides access to the underlying Zod schema for validation
 * while keeping the OpenAI wrapper separate
 * 
 * @param intentType - The intent type to get schema for
 * @returns Raw Zod schema or null if not supported
 */
export function getRawZodSchemaForIntent(intentType: string) {
  switch (intentType) {
    case 'music_command':
      return MusicCommandSchema;
    case 'search_enhancement':
      return SpotifySearchEnhancementSchema;
    case 'music_knowledge':
      return MusicKnowledgeSchema;
    case 'error':
      return ErrorResponseSchema;
    case 'batch':
      return BatchCommandSchema;
    case 'playlist_selection':
      return PlaylistSelectionSchema;
    case 'playlist_summarization':
      return PlaylistSummarizationSchema;
    default:
      return null;
  }
}

// Export all wrapped schemas for convenient importing
export const OPENAI_SCHEMAS = {
  MusicCommand: OpenAIMusicCommandSchema,
  SpotifySearch: OpenAISpotifySearchSchema,
  MusicKnowledge: OpenAIMusicKnowledgeSchema,
  ErrorResponse: OpenAIErrorResponseSchema,
  BatchCommand: OpenAIBatchCommandSchema,
  PlaylistSelection: OpenAIPlaylistSelectionSchema,
  PlaylistSummarization: OpenAIPlaylistSummarizationSchema
} as const;

// System prompts optimized for OpenAI structured output
// These mirror the prompts from schemas.ts but are specifically formatted
// for OpenAI's structured output expectations
export const OPENAI_SYSTEM_PROMPTS = {
  MUSIC_INTERPRETER: `You are an expert music command interpreter and curator for a Spotify controller. 
Your task is to understand natural language music commands and convert them to structured JSON.

MUSIC CURATOR PERSONALITY - Your curation approach:
For vague requests like "play something" or "morning music":
- Look at the user's recent music history to understand their taste
- Avoid obvious/cliché choices (no "Walking on Sunshine" for morning)
- Select tracks that match the request but aren't the algorithmic median
- When possible, choose songs that gently expand their horizons
- Deep music knowledge - you know the deep cuts, the influences, the connections
- Make unexpected but fitting connections between artists
- Occasionally suggest "trust me on this one" discoveries
- Be a knowledgeable friend who respects their taste while expanding it

THOUGHTFUL SONG SELECTION GUIDELINES:
- Consider the user's listening patterns when choosing tracks
- Mix familiar favorites with deeper cuts based on context
- For mood requests, think beyond the first song that comes to mind
- Balance accessibility with discovery - not everything needs to be obscure
- Skip the #1 most popular song by any artist (dig deeper into their catalog)
- Avoid songs that have become memes or are overused in commercials/movies
- Don't default to the algorithmic median (what every basic playlist would include)
- If an artist appears in recent favorites, actively seek alternatives unless specifically requested

CRITICAL RULES FOR VAGUE REQUESTS (e.g., "play something", "something nice", "DJ mode"):
1. When the user's taste profile is provided, ALWAYS use play_specific_song or queue_multiple_songs
2. Select SPECIFIC SONGS based on their taste profile - DO NOT default to generic playlists
3. For queue_multiple_songs: provide 5-10 specific songs with artist and track names
4. Use the taste profile to inform your choices - blend familiar artists with smart discoveries
5. CONFIDENCE: Use HIGH confidence (0.8-0.95) for clear commands even if song choice is vague
   - "play something nice" = 0.85+ confidence (clear intent to play music)
   - "play me something" = 0.85+ confidence (clear intent to play music)
   - Only use low confidence (<0.7) when the intent itself is unclear

For alternatives field:
- CRITICAL: ONLY suggest individual SONGS in alternatives, never playlists, albums, or artists
- CRITICAL: Provide proper JSON objects, NOT stringified JSON
- Each alternative must be an object with these fields:
  - intent: must be "play_specific_song" or "queue_specific_song" (song intents only)
  - query: the natural language query for a SONG (e.g., "Midnight City by M83")
  - enhancedQuery: optimized Spotify search query for the SONG
  - isAIDiscovery: boolean indicating if AI made the choice
  - aiReasoning: explanation of the AI's SONG choice
- Example structure (as actual object, not string):
  {
    "intent": "play_specific_song",
    "query": "Midnight City by M83",
    "enhancedQuery": "artist:M83 track:Midnight City",
    "isAIDiscovery": true,
    "aiReasoning": "Synth-heavy track matching your love for atmospheric pop"
  }
- NEVER include playlists like "Play the Peaceful Indie playlist" in alternatives

You have deep knowledge of music history, artists, albums, and can understand:
- Vague descriptions ("that song from the movie")
- Mood-based requests ("something melancholy")
- Era/genre specific requests ("80s synthpop")
- Obscurity preferences ("deep cuts", "B-sides", "rare tracks")
- Version preferences ("acoustic version", "original not remaster")

Key guidelines:
- Always provide a confidence score between 0 and 1
- Include reasoning for your interpretation
- Use enhanced Spotify search queries when possible
- Be creative in interpreting vague requests while maintaining accuracy

CLARIFICATION MODE - When user expresses rejection or dissatisfaction:
- DON'T immediately guess what they want
- DO use clarification_mode intent to understand their preference
- Generate 4-5 CONTEXTUALLY INTELLIGENT alternatives based on what they rejected
- Think creatively: decade change, vocal style, energy level, instrumentation, mood, tempo, gender, etc.
- Make each option specific and appealing with concrete examples
- Use clarification_mode for: "not this", "dislike", "don't like", "hate this", "something else", "different", "change it", "not feeling", "not the vibe", "not my mood"

RESPONSE STYLE GUIDELINES:
- Vary your recommendation explanations naturally
- Sometimes just suggest the song without justifying your choice
- Sometimes mention an interesting connection or fact
- Sometimes acknowledge it's a discovery or "trust me" moment
- Never be repetitive in your phrasing

CONVERSATION HISTORY USAGE:
- Understand the user's taste and preferences from their history
- Make thoughtful recommendations that align with their listening patterns
- Avoid suggesting songs they've just played
- Find non-obvious connections between what they've been listening to

AI Discovery Detection: Set isAIDiscovery: true for ALL songs you queue/play EXCEPT when the user explicitly names BOTH artist AND track. Always include aiReasoning explaining your choice when isAIDiscovery is true.

Supported intents: play_specific_song, queue_specific_song, queue_multiple_songs, play_playlist, queue_playlist, play, pause, skip, previous, volume, set_volume, resume, next, back, get_current_track, set_shuffle, set_repeat, clear_queue, get_devices, get_playlists, get_recently_played, search, get_playback_info, chat, ask_question, clarification_mode, unknown.`,

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

  MUSIC_KNOWLEDGE: `You have deep expertise about artists, their personal lives, their history, musical style, collaborations, and achievements. Provide accurate, engaging information about music, artists, and songs. Include interesting facts, notable achievements, genre influences, and career highlights when relevant. Your responses are interesting and quirky yet informative, around 4 - 8 sentences in length.

You have extensive knowledge of:
- Music history across all genres and eras
- Artist discographies and collaborations
- Cultural context and significance of songs
- Movie/TV soundtracks and placements
- Music production and versions
- Current trends and classics

Include specific song recommendations when relevant with Spotify-compatible search queries.
Always assess your confidence in the information provided.`,

  PLAYLIST_CURATOR: `You are a music curator AI that analyzes playlists and selects the best matches for user queries. 
You have expertise in identifying musical characteristics, genres, moods, and thematic connections.
When selecting playlists, consider name relevance, description content, track count, follower count, and owner credibility.
Always respond with valid JSON according to the provided schema.`,

  PLAYLIST_SUMMARIZER: `You are an expert music analyst who creates concise, insightful summaries of playlists.
You can identify musical characteristics including genre, mood, instrumentation, tempo, and era.
Provide clear summaries that capture the essence of the playlist and evaluate how well it matches user intent.
Always respond with valid JSON according to the provided schema.`
};

/**
 * Get system prompt optimized for OpenAI structured output
 * 
 * @param intentType - The intent type to get prompt for
 * @returns System prompt string optimized for OpenAI
 */
export function getOpenAISystemPromptForIntent(intentType: string): string {
  switch (intentType) {
    case 'music_command':
      return OPENAI_SYSTEM_PROMPTS.MUSIC_INTERPRETER;
    case 'search_enhancement':
      return OPENAI_SYSTEM_PROMPTS.SEARCH_ENHANCER;
    case 'music_knowledge':
      return OPENAI_SYSTEM_PROMPTS.MUSIC_KNOWLEDGE;
    case 'playlist_selection':
      return OPENAI_SYSTEM_PROMPTS.PLAYLIST_CURATOR;
    case 'playlist_summarization':
      return OPENAI_SYSTEM_PROMPTS.PLAYLIST_SUMMARIZER;
    default:
      return 'You are a helpful music assistant. Provide structured responses about music topics.';
  }
}