import { z } from 'zod';

// Music command interpretation schema (legacy - flat structure)
const OldMusicCommandSchema = z.object({
  intent: z.enum([
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
    'explain_reasoning',
    'unknown'
  ]),
  
  query: z.string().optional().nullable().describe('The search query if searching for music'),
  
  artist: z.string().optional().nullable().describe('Artist name if specified'),
  
  track: z.string().optional().nullable().describe('Track/song name if specified'),
  
  album: z.string().optional().nullable().describe('Album name if specified'),
  
  value: z.number().optional().nullable().describe('Numeric value for volume commands'),
  
  volume_level: z.number().optional().nullable().describe('Volume level between 0-100'),
  
  enabled: z.boolean().optional().nullable().describe('Boolean flag for shuffle/repeat commands'),
  
  modifiers: z.object({
    obscurity: z.union([
      z.enum(['popular', 'obscure', 'rare', 'deep_cut', 'hidden']),
      z.string()
    ]).optional().nullable()
      .describe('How popular/obscure the track should be'),
    
    version: z.union([
      z.enum(['original', 'remix', 'acoustic', 'live', 'demo', 'remaster']),
      z.string()
    ]).optional().nullable()
      .describe('Specific version of the track'),
    
    mood: z.string().optional().nullable()
      .describe('Mood or vibe requested (e.g., "melancholy", "upbeat", "chill")'),
    
    era: z.string().optional().nullable()
      .describe('Time period or era (e.g., "80s", "90s", "2000s")'),
    
    genre: z.string().optional().nullable()
      .describe('Musical genre if specified'),
    
    exclude: z.array(z.string()).nullable().default([])
      .describe('Terms to exclude from search')
  }).default({ exclude: [] }),
  
  confidence: z.number().min(0).max(1)
    .describe('Confidence level in the interpretation (0-1)'),
  
  reasoning: z.string()
    .describe('Brief explanation of why this interpretation was chosen'),
  
  alternatives: z.array(
    z.union([
      z.string(),
      z.object({
        intent: z.string().optional().nullable(),
        query: z.string().optional().nullable(),
        theme: z.string().optional().nullable(),
        enhancedQuery: z.string().optional().nullable(),
        isAIDiscovery: z.boolean().optional().nullable(),
        aiReasoning: z.string().optional().nullable()
      })
    ])
  ).default([])
    .describe('Alternative interpretations or suggestions (strings or structured objects)'),
  
  enhancedQuery: z.string().optional().nullable()
    .describe('Enhanced Spotify search query with proper operators'),
    
  // For queue_multiple_songs intent
  songs: z.array(z.object({
    artist: z.string(),
    track: z.string(),
    album: z.string().optional().nullable()
  })).optional().nullable()
    .describe('Array of songs for queue_multiple_songs intent'),
    
  // For queue_multiple_songs theme
  theme: z.string().optional().nullable()
    .describe('Theme description for multiple queued songs'),
    
  // AI Discovery fields
  isAIDiscovery: z.boolean().optional().nullable()
    .describe('True when AI made creative choice (not following explicit user request)'),
    
  aiReasoning: z.string().optional().nullable()
    .describe('Explanation of why AI chose this when isAIDiscovery is true')
});

export type MusicCommand = z.infer<typeof OldMusicCommandSchema>;

// Spotify search enhancement schema
export const SpotifySearchEnhancementSchema = z.object({
  originalQuery: z.string(),
  
  enhancedQuery: z.string()
    .describe('Optimized query using Spotify search operators'),
  
  searchType: z.enum(['track', 'artist', 'album', 'playlist'])
    .describe('What type of content to search for'),
  
  filters: z.object({
    artist: z.string().optional().nullable(),
    album: z.string().optional().nullable(),
    year: z.string().optional().nullable(),
    genre: z.string().optional().nullable(),
    tag: z.array(z.string()).optional().nullable()
  }).optional().nullable(),
  
  popularity: z.object({
    min: z.number().min(0).max(100).optional().nullable(),
    max: z.number().min(0).max(100).optional().nullable()
  }).optional().nullable()
    .describe('Popularity range for obscure/rare requests'),
  
  explanation: z.string()
    .describe('Why these search parameters were chosen')
});

export type SpotifySearchEnhancement = z.infer<typeof SpotifySearchEnhancementSchema>;

// Music knowledge response schema
export const MusicKnowledgeSchema = z.object({
  query: z.string(),
  
  answer: z.string()
    .describe('Direct answer to the music-related question'),
  
  recommendations: z.array(z.object({
    artist: z.string(),
    track: z.string(),
    reason: z.string()
      .describe('Why this is recommended'),
    spotifyQuery: z.string()
      .describe('Query to find this on Spotify')
  })).optional().nullable()
    .describe('Specific song recommendations if applicable'),
  
  context: z.object({
    genre: z.string().optional().nullable(),
    era: z.string().optional().nullable(),
    mood: z.string().optional().nullable(),
    cultural_references: z.array(z.string()).optional().nullable()
  }).optional().nullable(),
  
  confidence: z.number().min(0).max(1)
});

export type MusicKnowledge = z.infer<typeof MusicKnowledgeSchema>;

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  suggestion: z.string().optional().nullable(),
  fallback: z.string().optional().nullable()
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Batch command schema for multiple operations
export const BatchCommandSchema = z.object({
  commands: z.array(OldMusicCommandSchema),
  
  executionOrder: z.enum(['sequential', 'parallel'])
    .describe('How to execute multiple commands'),
  
  context: z.string().optional().nullable()
    .describe('Shared context for all commands')
});

export type BatchCommand = z.infer<typeof BatchCommandSchema>;

// Playlist Selection Schema - for selecting best matching playlists
export const PlaylistSelectionSchema = z.object({
  selectedPlaylistIds: z.array(z.string()).max(50)
    .describe('Array of selected playlist IDs that best match the user query'),
  reasoning: z.string().optional().nullable()
    .describe('Brief explanation of why these playlists were selected')
});

export type PlaylistSelection = z.infer<typeof PlaylistSelectionSchema>;

// Playlist Summarization Schema - for generating playlist summaries with characteristics
export const PlaylistSummarizationSchema = z.object({
  summary: z.string()
    .describe('2-3 sentence description of the playlist'),
  alignmentLevel: z.enum(['strong', 'moderate', 'weak', 'tangential']).optional().nullable()
    .describe('How well the playlist aligns with the query'),
  characteristics: z.object({
    primaryGenre: z.string().optional().nullable(),
    mood: z.string().optional().nullable(),
    instrumentation: z.array(z.string()).optional().nullable(),
    tempo: z.string().optional().nullable(),
    decadeRange: z.string().optional().nullable()
  }).optional().nullable()
    .describe('Musical characteristics of the playlist'),
  matchScore: z.number().min(0).max(1).optional().nullable()
    .describe('Match score between 0.0 and 1.0'),
  reasoning: z.string().optional().nullable()
    .describe('Brief explanation of the match score')
});

export type PlaylistSummarization = z.infer<typeof PlaylistSummarizationSchema>;

// System prompts for different use cases
export const SYSTEM_PROMPTS = {
  MUSIC_INTERPRETER: `You are an expert music command interpreter for a Spotify controller. 
Your task is to understand natural language music commands and convert them to structured JSON.

CRITICAL RULES FOR VAGUE REQUESTS (e.g., "play something", "something nice", "DJ mode"):
1. When the user's taste profile is provided, ALWAYS use play_specific_song or queue_multiple_songs
2. Select SPECIFIC SONGS based on their taste profile - DO NOT default to generic playlists
3. For queue_multiple_songs: provide 5-10 specific songs in the songs array with artist, track, and optional album
4. Use the taste profile to inform your choices - blend familiar artists with smart discoveries
5. CONFIDENCE: Use HIGH confidence (0.8-0.95) for clear commands even if song choice is vague
   - "play something nice" = 0.85+ confidence (clear intent to play music)
   - "play me something" = 0.85+ confidence (clear intent to play music)
   - Only use low confidence (<0.7) when the intent itself is unclear

You have deep knowledge of music history, artists, albums, and can understand:
- Vague descriptions ("that song from the movie")
- Mood-based requests ("something melancholy")
- Era/genre specific requests ("80s synthpop")
- Obscurity preferences ("deep cuts", "B-sides", "rare tracks")
- Version preferences ("acoustic version", "original not remaster")

You must respond with a JSON object containing these fields:
- intent: one of "play_specific_song", "queue_specific_song", "queue_multiple_songs", "play_playlist", "queue_playlist", "play", "pause", "skip", "previous", "volume", "set_volume", "resume", "next", "back", "get_current_track", "set_shuffle", "set_repeat", "clear_queue", "get_devices", "get_playlists", "get_recently_played", "search", "get_playback_info", "chat", "ask_question", "unknown"
- query (optional): search query string
- artist (optional): artist name
- track (optional): track name
- album (optional): album name
- value (optional): numeric value for volume
- modifiers: object with obscurity, version, mood, era, genre, exclude fields
- confidence: number between 0 and 1
- reasoning: string explaining your interpretation
- alternatives: array of alternative suggestions
- enhancedQuery (optional): optimized Spotify search query
- isAIDiscovery (optional): true when AI made creative choice (not following explicit user request)
- aiReasoning (optional): explanation of why AI chose this when isAIDiscovery is true

Set isAIDiscovery: true for ALL songs you queue/play EXCEPT when the user explicitly names BOTH artist AND track (e.g., "play Anti-Hero by Taylor Swift"). Always include aiReasoning explaining your choice when isAIDiscovery is true.

Be creative in interpreting vague requests while maintaining high confidence in clear commands.`,

  SEARCH_ENHANCER: `You are a Spotify search query optimizer. 
Convert natural language music requests into optimal Spotify search queries using these operators:
- artist: for artist names
- album: for album names  
- track: for song titles
- year: for release year or ranges (year:2020, year:1990-2000)
- genre: for genres
- tag:hipster for less popular tracks
- NOT to exclude terms

You must respond with JSON containing:
- originalQuery: the original search query provided
- enhancedQuery: your optimized Spotify search query
- searchType: one of "track", "artist", "album", "playlist"
- filters: optional object with artist, album, year, genre, tag fields
- popularity: optional object with min/max values (0-100)
- explanation: why you chose these search parameters

Examples:
- "obscure Beatles" → enhancedQuery: "artist:Beatles tag:hipster"
- "original Space Oddity not remaster" → enhancedQuery: "track:'Space Oddity' artist:'David Bowie' NOT remaster"`,

  MUSIC_KNOWLEDGE: `You are a knowledgeable music expert and DJ with extensive knowledge of:
- Music history across all genres and eras
- Artist discographies and collaborations
- Cultural context and significance of songs
- Movie/TV soundtracks and placements
- Music production and versions
- Current trends and classics

Provide helpful, accurate information and thoughtful recommendations.
Always respond with valid JSON matching the provided schema.`
};

// Helper function to create a schema-validated LLM request
export function createSchemaRequest(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema,
  model?: string
) {
  return {
    messages: [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt }
    ],
    response_format: { type: 'json_object' as const },
    schema,
    model,
    temperature: 0.7,
    conversationContext: undefined as string | undefined
  };
}

// Re-export the new discriminated union schemas
export * from './schemas/index';

// Export the old flat schema as LegacyMusicCommandSchema for backward compatibility
/**
 * @deprecated Use the discriminated union MusicCommandSchema from './schemas/index' instead
 */
export const LegacyMusicCommandSchema = OldMusicCommandSchema;