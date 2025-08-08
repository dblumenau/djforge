import { z } from 'zod';
import { BaseCommandSchema, AlternativeSchema } from '../base';

export const PlaySpecificSongSchema = BaseCommandSchema.extend({
  intent: z.literal('play_specific_song'),
  artist: z.string().min(1), // REQUIRED
  track: z.string().min(1),  // REQUIRED
  album: z.string().optional().nullable(),
  alternatives: z.array(AlternativeSchema).optional().nullable(),
  enhancedQuery: z.string().optional().nullable()
});

export const PlayPlaylistSchema = BaseCommandSchema.extend({
  intent: z.literal('play_playlist'),
  query: z.string().min(1), // REQUIRED - playlist name/search
  enhancedQuery: z.string().optional().nullable(),
  alternatives: z.array(AlternativeSchema).optional().nullable()
});

export const PlayControlSchema = BaseCommandSchema.extend({
  intent: z.literal('play')
  // No additional fields required for simple play command
});