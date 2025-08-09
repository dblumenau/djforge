import { z } from 'zod';

/**
 * Schema for playing a specific song via Spotify
 * Used by GPT-5 Responses API for structured output with strict mode
 * 
 * Example use case: When user says "Play Bohemian Rhapsody by Queen"
 * The system searches for and plays the specific track
 */
export const PlaySpecificSongSchema = z.object({
  artist: z.string()
    .min(1)
    .describe("Artist name (required for accurate search)"),
  
  track: z.string()
    .min(1)
    .describe("Track/song name (required)"),
  
  album: z.union([z.string(), z.null()])
    .optional()
    .describe("Album name for disambiguation (optional)"),
  
  confidence: z.number()
    .min(0)
    .max(1)
    .default(1.0)
    .describe("Confidence score that this is what the user wants (0-1)"),
  
  enhancedQuery: z.union([z.string(), z.null()])
    .optional()
    .describe("Enhanced search query if the basic artist/track search might need refinement"),
  
  alternatives: z.array(z.object({
    artist: z.string().describe("Alternative artist name"),
    track: z.string().describe("Alternative track name"),
    album: z.union([z.string(), z.null()]).optional().describe("Alternative album name"),
    reason: z.string().describe("Why this alternative might be relevant")
  }))
    .max(3)
    .optional()
    .describe("Alternative songs if the primary search fails"),
  
  userContext: z.union([z.string(), z.null()])
    .optional()
    .describe("Context about why the user wants this song (for conversation continuity)")
});

export type PlaySpecificSong = z.infer<typeof PlaySpecificSongSchema>;

/**
 * Result type for play_specific_song function
 */
export interface PlaySpecificSongResult {
  success: boolean;
  message: string;
  track?: {
    name: string;
    artist: string;
    album: string;
    uri: string;
    popularity?: number;
  };
  alternatives?: Array<{
    name: string;
    artist: string;
    album: string;
    uri: string;
  }>;
  status: 'playing' | 'queued' | 'failed' | 'searching';
  userAction?: 'none' | 'awaiting_confirmation' | 'awaiting_selection';
  error?: string;
}

/**
 * Export schemas for tool response types
 */
export const SpotifyActionSchemas = {
  play_specific_song: PlaySpecificSongSchema
};

export type SpotifyActions = {
  play_specific_song: PlaySpecificSong;
};