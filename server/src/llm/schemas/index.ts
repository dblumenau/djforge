import { z } from 'zod';

// Import all intent schemas
import {
  PlaySpecificSongSchema,
  PlayPlaylistSchema,
  PlayControlSchema
} from './intents/play';

import {
  QueueSpecificSongSchema,
  QueueMultipleSongsSchema,
  QueuePlaylistSchema
} from './intents/queue';

import { ClarificationModeSchema } from './intents/clarification';

import {
  PauseSchema,
  SkipSchema,
  PreviousSchema,
  NextSchema,
  BackSchema,
  ResumeSchema,
  SetVolumeSchema,
  VolumeSchema,
  SetShuffleSchema,
  SetRepeatSchema,
  ClearQueueSchema
} from './intents/control';

import {
  ChatSchema,
  AskQuestionSchema,
  ExplainReasoningSchema,
  UnknownSchema
} from './intents/conversational';

import {
  GetCurrentTrackSchema,
  GetDevicesSchema,
  GetPlaylistsSchema,
  GetRecentlyPlayedSchema,
  GetPlaybackInfoSchema,
  SearchSchema
} from './intents/info';

// Export the discriminated union of all music commands
export const MusicCommandSchema = z.discriminatedUnion('intent', [
  // Play intents
  PlaySpecificSongSchema,
  PlayPlaylistSchema,
  PlayControlSchema,
  
  // Queue intents
  QueueSpecificSongSchema,
  QueueMultipleSongsSchema,
  QueuePlaylistSchema,
  
  // Clarification
  ClarificationModeSchema,
  
  // Control intents
  PauseSchema,
  SkipSchema,
  PreviousSchema,
  NextSchema,
  BackSchema,
  ResumeSchema,
  SetVolumeSchema,
  VolumeSchema,
  SetShuffleSchema,
  SetRepeatSchema,
  ClearQueueSchema,
  
  // Conversational intents
  ChatSchema,
  AskQuestionSchema,
  ExplainReasoningSchema,
  UnknownSchema,
  
  // Info intents
  GetCurrentTrackSchema,
  GetDevicesSchema,
  GetPlaylistsSchema,
  GetRecentlyPlayedSchema,
  GetPlaybackInfoSchema,
  SearchSchema
]);

// Export type inference
export type MusicCommand = z.infer<typeof MusicCommandSchema>;

// Export individual schemas for direct use
export {
  PlaySpecificSongSchema,
  QueueSpecificSongSchema,
  QueueMultipleSongsSchema,
  ClarificationModeSchema,
  ChatSchema,
  AskQuestionSchema
  // ... etc
};

// Re-export base schemas
export * from './base';