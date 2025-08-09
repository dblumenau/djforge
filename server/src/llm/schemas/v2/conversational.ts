import { z } from 'zod';
import { BaseCommandSchema } from './base';

/**
 * Conversational intent schemas for non-action responses
 * These intents return text responses without triggering Spotify actions
 */

/**
 * Chat intent - For general music discussion and conversation
 */
export const ChatSchema = BaseCommandSchema.extend({
  intent: z.literal('chat').describe("Intent type for general music discussion"),
  message: z.string().min(1).describe("The conversational response to show the user"),
  query: z.string().optional().nullable().describe("The original user query")
});

/**
 * Ask Question intent - For answering music-related questions
 */
export const AskQuestionSchema = BaseCommandSchema.extend({
  intent: z.literal('ask_question').describe("Intent type for answering music questions"),
  answer: z.string().min(1).describe("The answer to the user's question"),
  query: z.string().optional().nullable().describe("The original question asked")
});

/**
 * Explain Reasoning intent - For explaining AI's decision-making process
 */
export const ExplainReasoningSchema = BaseCommandSchema.extend({
  intent: z.literal('explain_reasoning').describe("Intent type for explaining AI reasoning"),
  explanation: z.string().min(1).describe("Detailed explanation of the AI's reasoning"),
  query: z.string().optional().nullable().describe("The original query being explained")
});

/**
 * Unknown intent - Fallback for unparseable or unclear commands
 */
export const UnknownSchema = BaseCommandSchema.extend({
  intent: z.literal('unknown').describe("Fallback intent for unclear commands"),
  query: z.string().optional().nullable().describe("The original unparseable query"),
  message: z.string().optional().nullable().describe("Optional message explaining why the command couldn't be understood")
});

/**
 * Union of all conversational intent schemas
 */
export const ConversationalIntentSchema = z.union([
  ChatSchema,
  AskQuestionSchema,
  ExplainReasoningSchema,
  UnknownSchema
]);

/**
 * Type exports for TypeScript usage
 */
export type Chat = z.infer<typeof ChatSchema>;
export type AskQuestion = z.infer<typeof AskQuestionSchema>;
export type ExplainReasoning = z.infer<typeof ExplainReasoningSchema>;
export type Unknown = z.infer<typeof UnknownSchema>;
export type ConversationalIntent = z.infer<typeof ConversationalIntentSchema>;

/**
 * Helper type guard functions
 */
export const isConversationalIntent = (intent: string): boolean => {
  return ['chat', 'ask_question', 'explain_reasoning', 'unknown'].includes(intent);
};

export const requiresResponseMessage = (intent: string): boolean => {
  return ['chat', 'ask_question', 'explain_reasoning'].includes(intent);
};