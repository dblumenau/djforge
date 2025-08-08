import { z } from 'zod';

/**
 * OpenAI-Compatible Flattened Music Command Schema
 * 
 * This schema flattens all fields from our discriminated union schemas into a single
 * structure that OpenAI's API can handle properly. It includes ALL intents including
 * the critical `clarification_mode` intent that was missing from the legacy schema.
 * 
 * All intent-specific fields are made optional with .nullable() for OpenAI compatibility.
 */

export const OpenAIFlattenedMusicCommandSchema = z.object({
  // Intent field with ALL possible intents - MOST IMPORTANT FIELD
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
    'next',
    'back',
    'resume',
    'volume',
    'set_volume',
    'set_shuffle',
    'set_repeat',
    'clear_queue',
    'get_current_track',
    'get_devices',
    'get_playlists',
    'get_recently_played',
    'get_playback_info',
    'search',
    'chat',
    'ask_question',
    'explain_reasoning',
    'clarification_mode',  // CRITICAL: This was missing from legacy schema!
    'unknown'
  ]).describe('The type of music command to execute'),

  // Base fields (always present - inherited from BaseCommandSchema)
  confidence: z.number().min(0).max(1)
    .describe('Confidence level in the interpretation (0-1)'),
  
  reasoning: z.string()
    .describe('Brief explanation of why this interpretation was chosen'),
  
  // Common optional fields used across multiple intents  
  query: z.string().optional().nullable()
    .describe('The search query if searching for music'),
  
  artist: z.string().optional().nullable()
    .describe('Artist name if specified'),
  
  track: z.string().optional().nullable()
    .describe('Track/song name if specified'),
  
  album: z.string().optional().nullable()
    .describe('Album name if specified'),
  
  enhancedQuery: z.string().optional().nullable()
    .describe('Enhanced Spotify search query with proper operators'),
  
  alternatives: z.array(z.union([
    z.string(),
    z.object({
      intent: z.string().optional().nullable(),
      query: z.string().optional().nullable(),
      theme: z.string().optional().nullable(),
      enhancedQuery: z.string().optional().nullable(),
      isAIDiscovery: z.boolean().optional().nullable(),
      aiReasoning: z.string().optional().nullable()
    })
  ])).optional().nullable()
    .describe('Alternative interpretations or suggestions (strings or structured objects)'),
  
  // Modifiers object - flattened structure from ModifiersSchema
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
      .describe('Specific version type requested'),
    
    mood: z.string().optional().nullable()
      .describe('Desired mood or feeling'),
    
    era: z.string().optional().nullable()
      .describe('Time period or era (e.g., "80s", "90s", "2000s")'),
    
    genre: z.string().optional().nullable()
      .describe('Musical genre if specified'),
    
    exclude: z.array(z.string()).optional().nullable().default([])
      .describe('Terms to exclude from search')
  }).optional().nullable(),
  
  // AI Discovery fields (from BaseCommandSchema)
  isAIDiscovery: z.boolean().optional().nullable()
    .describe('True when AI made creative choice (not following explicit user request)'),
  
  aiReasoning: z.string().optional().nullable()
    .describe('Explanation of why AI chose this when isAIDiscovery is true'),
  
  // Volume control fields (from SetVolumeSchema and VolumeSchema)
  value: z.number().optional().nullable()
    .describe('Numeric value for volume commands'),
  
  volume_level: z.number().min(0).max(100).optional().nullable()
    .describe('Volume level between 0-100'),
  
  // Shuffle/repeat fields (from SetShuffleSchema and SetRepeatSchema)
  enabled: z.boolean().optional().nullable()
    .describe('Boolean flag for shuffle/repeat commands'),
  
  // Queue multiple songs fields (from QueueMultipleSongsSchema)
  songs: z.array(z.object({
    artist: z.string(),
    track: z.string(),
    album: z.string().optional().nullable()
  })).optional().nullable()
    .describe('Array of songs for queue_multiple_songs intent'),
  
  theme: z.string().optional().nullable()
    .describe('Theme description for multiple queued songs'),
  
  // Chat/conversation fields (from conversational schemas)
  message: z.string().optional().nullable()
    .describe('Response message for chat intent'),
  
  answer: z.string().optional().nullable()
    .describe('Answer for ask_question intent'),
  
  explanation: z.string().optional().nullable()
    .describe('Explanation for explain_reasoning intent'),
  
  // CLARIFICATION MODE FIELDS (CRITICAL - these were completely missing!)
  responseMessage: z.string().optional().nullable()
    .describe('Message to display to user asking for clarification'),
  
  currentContext: z.object({
    rejected: z.string()
      .describe('What the user rejected or wants to avoid'),
    rejectionType: z.enum(['artist', 'genre', 'mood', 'song'])
      .describe('Type of rejection to help provide better alternatives')
  }).optional().nullable()
    .describe('Context about what the user is trying to clarify or avoid'),
  
  options: z.array(z.object({
    label: z.string()
      .describe('Display label for the option button'),
    value: z.string() 
      .describe('Value to send when this option is selected'),
    description: z.string().optional().nullable()
      .describe('Optional longer description of this option')
  })).optional().nullable()
    .describe('Array of clarification options to present to user (4-5 options)'),
  
  uiType: z.enum(['clarification_buttons']).optional().nullable()
    .describe('UI component type to render for clarification')
});

export type OpenAIFlattenedMusicCommand = z.infer<typeof OpenAIFlattenedMusicCommandSchema>;

