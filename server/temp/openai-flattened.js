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
        'clarification_mode', // CRITICAL: This was missing from legacy schema!
        'unknown'
    ]).describe('The type of music command to execute'),
    // Base fields (always present - inherited from BaseCommandSchema)
    confidence: z.number().min(0).max(1)
        .describe('Confidence level in the interpretation (0-1)'),
    reasoning: z.string()
        .describe('Brief explanation of why this interpretation was chosen'),
    // Common optional fields used across multiple intents  
    query: z.string().optional()
        .describe('The search query if searching for music'),
    artist: z.string().optional()
        .describe('Artist name if specified'),
    track: z.string().optional()
        .describe('Track/song name if specified'),
    album: z.string().optional()
        .describe('Album name if specified'),
    enhancedQuery: z.string().optional()
        .describe('Enhanced Spotify search query with proper operators'),
    alternatives: z.array(z.union([
        z.string(),
        z.object({
            intent: z.string().optional(),
            query: z.string().optional(),
            theme: z.string().optional(),
            enhancedQuery: z.string().optional(),
            isAIDiscovery: z.boolean().optional(),
            aiReasoning: z.string().optional()
        })
    ])).optional()
        .describe('Alternative interpretations or suggestions (strings or structured objects)'),
    // Modifiers object - flattened structure from ModifiersSchema
    modifiers: z.object({
        obscurity: z.union([
            z.enum(['popular', 'obscure', 'rare', 'deep_cut', 'hidden']),
            z.string()
        ]).optional()
            .describe('How popular/obscure the track should be'),
        version: z.union([
            z.enum(['original', 'remix', 'acoustic', 'live', 'demo', 'remaster']),
            z.string()
        ]).optional()
            .describe('Specific version type requested'),
        mood: z.string().optional()
            .describe('Desired mood or feeling'),
        era: z.string().optional()
            .describe('Time period or era (e.g., "80s", "90s", "2000s")'),
        genre: z.string().optional()
            .describe('Musical genre if specified'),
        exclude: z.array(z.string()).optional().default([])
            .describe('Terms to exclude from search')
    }).optional(),
    // AI Discovery fields (from BaseCommandSchema)
    isAIDiscovery: z.boolean().optional()
        .describe('True when AI made creative choice (not following explicit user request)'),
    aiReasoning: z.string().optional()
        .describe('Explanation of why AI chose this when isAIDiscovery is true'),
    // Volume control fields (from SetVolumeSchema and VolumeSchema)
    value: z.number().optional()
        .describe('Numeric value for volume commands'),
    volume_level: z.number().min(0).max(100).optional()
        .describe('Volume level between 0-100'),
    // Shuffle/repeat fields (from SetShuffleSchema and SetRepeatSchema)
    enabled: z.boolean().optional()
        .describe('Boolean flag for shuffle/repeat commands'),
    // Queue multiple songs fields (from QueueMultipleSongsSchema)
    songs: z.array(z.object({
        artist: z.string(),
        track: z.string(),
        album: z.string().optional()
    })).optional()
        .describe('Array of songs for queue_multiple_songs intent'),
    theme: z.string().optional()
        .describe('Theme description for multiple queued songs'),
    // Chat/conversation fields (from conversational schemas)
    message: z.string().optional()
        .describe('Response message for chat intent'),
    answer: z.string().optional()
        .describe('Answer for ask_question intent'),
    explanation: z.string().optional()
        .describe('Explanation for explain_reasoning intent'),
    // CLARIFICATION MODE FIELDS (CRITICAL - these were completely missing!)
    responseMessage: z.string().optional()
        .describe('Message to display to user asking for clarification'),
    currentContext: z.object({
        rejected: z.string()
            .describe('What the user rejected or wants to avoid'),
        rejectionType: z.enum(['artist', 'genre', 'mood', 'song'])
            .describe('Type of rejection to help provide better alternatives')
    }).optional()
        .describe('Context about what the user is trying to clarify or avoid'),
    options: z.array(z.object({
        label: z.string()
            .describe('Display label for the option button'),
        value: z.string()
            .describe('Value to send when this option is selected'),
        description: z.string().optional()
            .describe('Optional longer description of this option')
    })).optional()
        .describe('Array of clarification options to present to user (4-5 options)'),
    uiType: z.enum(['clarification_buttons']).optional()
        .describe('UI component type to render for clarification')
});
/**
 * Type-safe converter to ensure OpenAI flattened responses are compatible
 * with existing code that expects undefined instead of null for optional fields.
 * This function ensures that null values are converted to undefined for type safety.
 */
export function convertOpenAIResponse(response) {
    // This handles any remaining null to undefined conversions
    const cleaned = { ...response };
    // Convert null to undefined for all string fields
    const stringFields = ['query', 'artist', 'track', 'album', 'enhancedQuery', 'theme', 'message', 'answer', 'explanation', 'responseMessage'];
    stringFields.forEach(field => {
        if (cleaned[field] === null) {
            cleaned[field] = undefined;
        }
    });
    // Handle nested object fields
    if (cleaned.alternatives) {
        cleaned.alternatives = cleaned.alternatives.map((alt) => {
            if (typeof alt === 'object' && alt !== null) {
                const cleanedAlt = { ...alt };
                ['intent', 'query', 'theme', 'enhancedQuery', 'aiReasoning'].forEach(field => {
                    if (cleanedAlt[field] === null) {
                        cleanedAlt[field] = undefined;
                    }
                });
                return cleanedAlt;
            }
            return alt;
        });
    }
    // Handle modifiers
    if (cleaned.modifiers) {
        ['obscurity', 'version', 'mood', 'era', 'genre'].forEach(field => {
            if (cleaned.modifiers[field] === null) {
                cleaned.modifiers[field] = undefined;
            }
        });
    }
    // Handle songs array
    if (cleaned.songs) {
        cleaned.songs = cleaned.songs.map((song) => ({
            ...song,
            album: song.album === null ? undefined : song.album
        }));
    }
    // Handle currentContext
    if (cleaned.currentContext && cleaned.currentContext === null) {
        cleaned.currentContext = undefined;
    }
    // Handle options
    if (cleaned.options) {
        cleaned.options = cleaned.options.map((option) => ({
            ...option,
            description: option.description === null ? undefined : option.description
        }));
    }
    return cleaned;
}
