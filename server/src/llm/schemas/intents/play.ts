import { z } from 'zod';
import { BaseCommandSchema, AlternativeSchema } from '../base';

export const PlaySpecificSongSchema = BaseCommandSchema.extend({
  intent: z.literal('play_specific_song'),
  artist: z.string().min(1), // REQUIRED
  track: z.string().min(1),  // REQUIRED
  album: z.string().optional(),
  alternatives: z.array(AlternativeSchema).optional(),
  enhancedQuery: z.string().optional()
});

export const PlayPlaylistSchema = BaseCommandSchema.extend({
  intent: z.literal('play_playlist'),
  query: z.string().min(1), // REQUIRED - playlist name/search
  enhancedQuery: z.string().optional(),
  alternatives: z.array(AlternativeSchema).optional()
});

export const PlayControlSchema = BaseCommandSchema.extend({
  intent: z.literal('play')
  // No additional fields required for simple play command
});