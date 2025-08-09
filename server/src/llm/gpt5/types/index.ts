/**
 * TypeScript interfaces and type definitions for GPT-5 Responses API
 * 
 * This file contains the pure TypeScript types extracted from the test script,
 * providing type safety for OpenAI Responses API integration.
 */

// Import response types from the responses module
import type {
  Response,
  ResponseCreateParams,
  ResponseErrorEvent,
  ResponseFormatTextConfig,
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseReasoningItem,
  ResponseStreamEvent,
  ResponseTextDeltaEvent,
  ResponseUsage,
  Tool
} from 'openai/resources/responses/responses';

// Session management types
export interface SessionData {
  lastResponseId: string | null;
  conversationHistory: Array<{
    responseId: string;
    input: string;
    output: string;
    timestamp: string;
    model: string;
    usage?: ResponseUsage;
  }>;
  metadata: Record<string, any>;
}

// Re-export OpenAI response types for convenience
export type {
  Response,
  ResponseCreateParams,
  ResponseErrorEvent,
  ResponseFormatTextConfig,
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseReasoningItem,
  ResponseStreamEvent,
  ResponseTextDeltaEvent,
  ResponseUsage,
  Tool
};