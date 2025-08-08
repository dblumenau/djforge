import { z } from 'zod';
import { BaseCommandSchema, AlternativeSchema, SongSchema } from '../base';

export const QueueSpecificSongSchema = BaseCommandSchema.extend({
  intent: z.literal('queue_specific_song'),
  artist: z.string().min(1), // REQUIRED
  track: z.string().min(1),  // REQUIRED
  album: z.string().optional().nullable(),
  alternatives: z.array(AlternativeSchema).optional().nullable(),
  enhancedQuery: z.string().optional().nullable()
});

export const QueueMultipleSongsSchema = BaseCommandSchema.extend({
  intent: z.literal('queue_multiple_songs'),
  songs: z.array(SongSchema).min(1).max(10), // REQUIRED array
  theme: z.string().optional().nullable(),
  alternatives: z.array(AlternativeSchema).optional().nullable()
});

export const QueuePlaylistSchema = BaseCommandSchema.extend({
  intent: z.literal('queue_playlist'),
  query: z.string().min(1), // REQUIRED - playlist name/search
  enhancedQuery: z.string().optional().nullable(),
  alternatives: z.array(AlternativeSchema).optional().nullable()
});