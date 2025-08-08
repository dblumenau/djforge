import { z } from 'zod';
import { BaseCommandSchema } from '../base';

export const ChatSchema = BaseCommandSchema.extend({
  intent: z.literal('chat'),
  message: z.string().min(1), // REQUIRED - the response to show
  query: z.string().optional() // Original query
});

export const AskQuestionSchema = BaseCommandSchema.extend({
  intent: z.literal('ask_question'),
  answer: z.string().min(1), // REQUIRED - the answer to show
  query: z.string().optional() // Original question
});

export const ExplainReasoningSchema = BaseCommandSchema.extend({
  intent: z.literal('explain_reasoning'),
  explanation: z.string().min(1), // REQUIRED
  query: z.string().optional()
});

export const UnknownSchema = BaseCommandSchema.extend({
  intent: z.literal('unknown'),
  query: z.string().optional(),
  message: z.string().optional()
});