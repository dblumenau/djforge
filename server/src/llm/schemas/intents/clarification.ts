import { z } from 'zod';
import { BaseCommandSchema } from '../base';

const ClarificationOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  description: z.string().optional()
});

export const ClarificationModeSchema = BaseCommandSchema.extend({
  intent: z.literal('clarification_mode'),
  responseMessage: z.string().min(1), // REQUIRED
  currentContext: z.object({
    rejected: z.string(),
    rejectionType: z.enum(['artist', 'genre', 'mood', 'song'])
  }), // REQUIRED
  options: z.array(ClarificationOptionSchema).min(4).max(5), // REQUIRED
  uiType: z.literal('clarification_buttons')
});