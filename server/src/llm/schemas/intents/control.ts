import { z } from 'zod';
import { BaseCommandSchema } from '../base';

export const PauseSchema = BaseCommandSchema.extend({
  intent: z.literal('pause')
});

export const SkipSchema = BaseCommandSchema.extend({
  intent: z.literal('skip')
});

export const PreviousSchema = BaseCommandSchema.extend({
  intent: z.literal('previous')
});

export const NextSchema = BaseCommandSchema.extend({
  intent: z.literal('next')
});

export const BackSchema = BaseCommandSchema.extend({
  intent: z.literal('back')
});

export const ResumeSchema = BaseCommandSchema.extend({
  intent: z.literal('resume')
});

export const SetVolumeSchema = BaseCommandSchema.extend({
  intent: z.literal('set_volume'),
  volume_level: z.number().min(0).max(100) // REQUIRED for volume
});

export const VolumeSchema = BaseCommandSchema.extend({
  intent: z.literal('volume'),
  value: z.number().optional() // Optional adjustment value
});

export const SetShuffleSchema = BaseCommandSchema.extend({
  intent: z.literal('set_shuffle'),
  enabled: z.boolean() // REQUIRED
});

export const SetRepeatSchema = BaseCommandSchema.extend({
  intent: z.literal('set_repeat'),
  enabled: z.boolean() // REQUIRED
});

export const ClearQueueSchema = BaseCommandSchema.extend({
  intent: z.literal('clear_queue')
});