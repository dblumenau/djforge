import { z } from 'zod';
import { BaseCommandSchema, AlternativeSchema } from '../base';

export const GetCurrentTrackSchema = BaseCommandSchema.extend({
  intent: z.literal('get_current_track')
});

export const GetDevicesSchema = BaseCommandSchema.extend({
  intent: z.literal('get_devices')
});

export const GetPlaylistsSchema = BaseCommandSchema.extend({
  intent: z.literal('get_playlists')
});

export const GetRecentlyPlayedSchema = BaseCommandSchema.extend({
  intent: z.literal('get_recently_played')
});

export const GetPlaybackInfoSchema = BaseCommandSchema.extend({
  intent: z.literal('get_playback_info')
});

export const SearchSchema = BaseCommandSchema.extend({
  intent: z.literal('search'),
  query: z.string().min(1), // REQUIRED for search
  enhancedQuery: z.string().optional(),
  alternatives: z.array(AlternativeSchema).optional()
});