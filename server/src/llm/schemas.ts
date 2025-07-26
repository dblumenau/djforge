import { z } from 'zod';

// Music command interpretation schema
export const MusicCommandSchema = z.object({
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
    'unknown'
  ]),
  
  query: z.string().optional().describe('The search query if searching for music'),
  
  artist: z.string().optional().describe('Artist name if specified'),
  
  track: z.string().optional().describe('Track/song name if specified'),
  
  album: z.string().optional().describe('Album name if specified'),
  
  value: z.number().optional().describe('Numeric value for volume commands'),
  
  volume_level: z.number().optional().describe('Volume level between 0-100'),
  
  enabled: z.boolean().optional().describe('Boolean flag for shuffle/repeat commands'),
  
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
  
  alternatives: z.array(z.string()).default([])
    .describe('Alternative interpretations or suggestions'),
  
  enhancedQuery: z.string().optional()
    .describe('Enhanced Spotify search query with proper operators'),
    
  // For queue_multiple_songs intent
  songs: z.array(z.object({
    artist: z.string(),
    track: z.string(),
    album: z.string().optional()
  })).optional()
    .describe('Array of songs for queue_multiple_songs intent'),
    
  // For queue_multiple_songs theme
  theme: z.string().optional()
    .describe('Theme description for multiple queued songs'),
    
  // AI Discovery fields
  isAIDiscovery: z.boolean().optional()
    .describe('True when AI made creative choice (not following explicit user request)'),
    
  aiReasoning: z.string().optional()
    .describe('Explanation of why AI chose this when isAIDiscovery is true')
});

export type MusicCommand = z.infer<typeof MusicCommandSchema>;

// Spotify search enhancement schema
export const SpotifySearchEnhancementSchema = z.object({
  originalQuery: z.string(),
  
  enhancedQuery: z.string()
    .describe('Optimized query using Spotify search operators'),
  
  searchType: z.enum(['track', 'artist', 'album', 'playlist'])
    .describe('What type of content to search for'),
  
  filters: z.object({
    artist: z.string().optional(),
    album: z.string().optional(),
    year: z.string().optional(),
    genre: z.string().optional(),
    tag: z.array(z.string()).optional()
  }).optional(),
  
  popularity: z.object({
    min: z.number().min(0).max(100).optional(),
    max: z.number().min(0).max(100).optional()
  }).optional()
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
  })).optional()
    .describe('Specific song recommendations if applicable'),
  
  context: z.object({
    genre: z.string().optional(),
    era: z.string().optional(),
    mood: z.string().optional(),
    cultural_references: z.array(z.string()).optional()
  }).optional(),
  
  confidence: z.number().min(0).max(1)
});

export type MusicKnowledge = z.infer<typeof MusicKnowledgeSchema>;

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  suggestion: z.string().optional(),
  fallback: z.string().optional()
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Batch command schema for multiple operations
export const BatchCommandSchema = z.object({
  commands: z.array(MusicCommandSchema),
  
  executionOrder: z.enum(['sequential', 'parallel'])
    .describe('How to execute multiple commands'),
  
  context: z.string().optional()
    .describe('Shared context for all commands')
});

export type BatchCommand = z.infer<typeof BatchCommandSchema>;

// System prompts for different use cases
export const SYSTEM_PROMPTS = {
  MUSIC_INTERPRETER: `You are an expert music command interpreter for a Spotify controller. 
Your task is to understand natural language music commands and convert them to structured JSON.

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

When you make a creative choice (like "play something melancholy" where you choose a specific track), set isAIDiscovery: true and include aiReasoning explaining your choice.

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