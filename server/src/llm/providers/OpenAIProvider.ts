/**
 * OpenAI Provider with GPT-5 Support
 * 
 * GPT-5 Features (Released August 7, 2025):
 * - Automatic routing: Model decides optimal settings based on query complexity
 * - reasoning_effort: Control reasoning depth ('minimal', 'low', 'medium', 'high')
 * - verbosity: Control response length ('low', 'medium', 'high')
 * - Model variants: gpt-5, gpt-5-mini, gpt-5-nano
 * 
 * Speed Optimization for Music Commands (Default):
 * {
 *   model: 'gpt-5' or 'gpt-5-nano',
 *   reasoning_effort: 'minimal',   // Fastest for instruction-following
 *   verbosity: 'low',              // Concise JSON responses
 *   max_completion_tokens: 8192,   // Sufficient for music commands
 * }
 * 
 * Default Behavior for Music Commands:
 * - reasoning_effort: 'minimal' (fastest, great for instruction-following)
 * - verbosity: 'low' (concise responses, less tokens)
 * - max_completion_tokens: 8192 (prevents length limit errors)
 * - These defaults optimize for speed while maintaining quality
 */

// Use named export for compatibility with both dev and production
import { OpenAI } from 'openai';
import { LLMRequest, LLMResponse } from '../orchestrator';
import { 
  getOpenAISchemaForIntent,
  getRawZodSchemaForIntent,
  getOpenAISystemPromptForIntent,
  OpenAIUnifiedSchema
} from '../openai-schemas';
import { validateIntent, ValidationOptions } from '../intent-validator';
import { PromptAdapter } from '../prompts/adapter';

export interface OpenAIProviderOptions {
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
}

export const OPENAI_MODELS = {
  GPT_5: 'gpt-5',  // Latest GPT-5 model
  GPT_5_MINI: 'gpt-5-mini',  
  GPT_5_NANO: 'gpt-5-nano', 
  GPT_4_1: 'gpt-4.1-2025-04-14',  // Latest GPT-4.1 model
};

export class OpenAIProvider {
  private client: OpenAI;
  private timeout: number;
  private maxRetries: number;

  constructor(options: OpenAIProviderOptions) {
    if (!options.apiKey) {
      throw new Error('OpenAI API key is required');
    }
      
    this.client = new OpenAI({ 
      apiKey: options.apiKey,
      timeout: options.timeout || 300000,  // Increased to 5 minutes for GPT-5
      maxRetries: options.maxRetries || 2
    });
    this.timeout = options.timeout ?? 300000;  // Increased to 5 minutes for GPT-5
    this.maxRetries = options.maxRetries ?? 2;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Always use unified schema for JSON requests
      let openaiSchema = null;
      
      if (request.response_format?.type === 'json_object') {
        // Use the unified schema that includes all possible intents
        openaiSchema = OpenAIUnifiedSchema;
      }
      
      // Build the system prompt using the new adapter
      const userRequest = request.messages.find(m => m.role === 'user')?.content || '';
      
      // Extract taste profile from conversation context for system prompt
      let tasteProfile = '';
      
      if (request.conversationContext) {
        // Extract taste profile only - conversation history will be handled natively
        const tasteProfileMatch = request.conversationContext.match(/User's Music Taste Profile:[\s\S]*?(?=\n\n|$)/);
        if (tasteProfileMatch) {
          tasteProfile = tasteProfileMatch[0];
        }
      }
      
      // Use the new prompt adapter without conversation context (handled natively now)
      const systemPrompt = PromptAdapter.forOpenAI(
        userRequest,
        tasteProfile
      );
      
      console.log(`🎯 Using OpenAI Direct API with unified structured output and new prompt system`);
      
      // Convert messages to OpenAI format with native conversation history
      const requiresJSON = request.response_format?.type === 'json_object';
      const messages = this.formatMessagesForOpenAI(request, systemPrompt, requiresJSON);
      
      let response;
      
      // Use structured output if JSON format is requested and schema is available
      if (request.response_format?.type === 'json_object' && openaiSchema) {
        // Map the model ID to the actual OpenAI model
        const actualModel = this.mapModelId(request.model || OPENAI_MODELS.GPT_4_1);
        console.log(`🔧 Using OpenAI structured output with pre-wrapped schema for ${actualModel}`);
        
        // Debug: Log the schema structure
        console.log('📋 OpenAI schema structure:', JSON.stringify(openaiSchema, null, 2));
        
        // Build request parameters
        const params: any = {
          model: actualModel,
          messages,
          response_format: openaiSchema
        };
        
        // Add GPT-5 specific parameters if using GPT-5 models
        if (actualModel.startsWith('gpt-5')) {
          // GPT-5 uses max_completion_tokens instead of max_tokens
          // For structured output, we need to ensure enough tokens for JSON completion
          if ((request as any).max_completion_tokens !== undefined) {
            params.max_completion_tokens = (request as any).max_completion_tokens;
          } else if (request.max_tokens !== undefined) {
            params.max_completion_tokens = request.max_tokens;
          } else {
            // For structured output, set a reasonable default to avoid length limit errors
            // Music commands typically need 1000-3000 tokens for complete JSON
            // Set to 8192 to be safe while keeping responses fast
            params.max_completion_tokens = 8192; // Balanced for music command responses
          }
          
          // GPT-5's automatic router decides optimal settings by default
          // Only override if explicitly provided in the request
          if ((request as any).reasoning_effort !== undefined) {
            params.reasoning_effort = (request as any).reasoning_effort; // 'minimal', 'low', 'medium', 'high'
          } else {
            // Default to 'minimal' for music commands - fastest response times
            // The docs say minimal "performs especially well in coding and instruction following scenarios"
            params.reasoning_effort = 'minimal';
          }
          
          if ((request as any).verbosity !== undefined) {
            params.verbosity = (request as any).verbosity; // 'low', 'medium', 'high'
          } else {
            // Default to 'low' verbosity for music commands - concise JSON responses
            // This reduces token count and improves response time
            params.verbosity = 'low';
          }
          
          // GPT-5 only supports default temperature (1.0)
          // Only set if explicitly provided and not the default
          if (request.temperature !== undefined && request.temperature !== 1.0) {
            console.warn(`GPT-5 only supports temperature=1.0, requested ${request.temperature} will be ignored`);
            // Don't set temperature parameter for GPT-5
          }
        } else {
          params.max_tokens = request.max_tokens ?? 4000;
          params.temperature = request.temperature ?? 0.7;
        }
        
        response = await this.client.chat.completions.parse(params);
        
        // Extract parsed content from structured response
        const content = response.choices[0].message.parsed;
        
        if (!content) {
          throw new Error('OpenAI structured output returned null - the response may have been filtered');
        }
        
        // Convert parsed object back to JSON string for consistent interface
        const jsonContent = JSON.stringify(content);
        
        return {
          content: jsonContent,
          usage: {
            prompt_tokens: response.usage?.prompt_tokens || 0,
            completion_tokens: response.usage?.completion_tokens || 0,
            total_tokens: response.usage?.total_tokens || 0
          },
          model: response.model || request.model || OPENAI_MODELS.GPT_4_1,
          provider: 'openai-direct'
        };
      } else {
        // Fall back to regular completion for non-JSON requests or when no schema is available
        const actualModel = this.mapModelId(request.model || OPENAI_MODELS.GPT_4_1);
        console.log(`🔧 Using OpenAI regular completion for ${actualModel}`);
        
        // Build request parameters
        const params: any = {
          model: actualModel,
          messages
        };
        
        // Add GPT-5 specific parameters if using GPT-5 models
        if (actualModel.startsWith('gpt-5')) {
          // GPT-5 uses max_completion_tokens instead of max_tokens
          // For structured output, we need to ensure enough tokens for JSON completion
          if ((request as any).max_completion_tokens !== undefined) {
            params.max_completion_tokens = (request as any).max_completion_tokens;
          } else if (request.max_tokens !== undefined) {
            params.max_completion_tokens = request.max_tokens;
          } else {
            // For structured output, set a reasonable default to avoid length limit errors
            // Music commands typically need 1000-3000 tokens for complete JSON
            // Set to 8192 to be safe while keeping responses fast
            params.max_completion_tokens = 8192; // Balanced for music command responses
          }
          
          // GPT-5's automatic router decides optimal settings by default
          // Only override if explicitly provided in the request
          if ((request as any).reasoning_effort !== undefined) {
            params.reasoning_effort = (request as any).reasoning_effort; // 'minimal', 'low', 'medium', 'high'
          } else {
            // Default to 'minimal' for music commands - fastest response times
            // The docs say minimal "performs especially well in coding and instruction following scenarios"
            params.reasoning_effort = 'minimal';
          }
          
          if ((request as any).verbosity !== undefined) {
            params.verbosity = (request as any).verbosity; // 'low', 'medium', 'high'
          } else {
            // Default to 'low' verbosity for music commands - concise JSON responses
            // This reduces token count and improves response time
            params.verbosity = 'low';
          }
          
          // GPT-5 only supports default temperature (1.0)
          // Only set if explicitly provided and not the default
          if (request.temperature !== undefined && request.temperature !== 1.0) {
            console.warn(`GPT-5 only supports temperature=1.0, requested ${request.temperature} will be ignored`);
            // Don't set temperature parameter for GPT-5
          }
        } else {
          params.max_tokens = request.max_tokens ?? 4000;
          params.temperature = request.temperature ?? 0.7;
        }
        
        // If JSON format is requested but no schema is available, use JSON mode
        if (request.response_format?.type === 'json_object') {
          console.log(`📝 JSON mode requested without schema - using response_format`);
          params.response_format = { type: 'json_object' };
        }
        
        response = await this.client.chat.completions.create(params);
        
        // Extract content from regular response
        const content = response.choices[0].message.content || '';
        
        return {
          content,
          usage: {
            prompt_tokens: response.usage?.prompt_tokens || 0,
            completion_tokens: response.usage?.completion_tokens || 0,
            total_tokens: response.usage?.total_tokens || 0
          },
          model: response.model || request.model || OPENAI_MODELS.GPT_4_1,
          provider: 'openai-direct'
        };
      }
      
    } catch (error) {
      console.error('OpenAI Provider error:', error);
      
      // Handle specific OpenAI errors
      const errorObj = error as any;
      if (errorObj && errorObj.status) {
        if (errorObj.status === 429) {
          throw new Error('OpenAI API rate limit exceeded');
        } else if (errorObj.status === 401) {
          throw new Error('Invalid OpenAI API key');
        } else if (errorObj.status === 400) {
          throw new Error(`OpenAI API bad request: ${errorObj.message}`);
        }
        throw new Error(`OpenAI API error (${errorObj.status}): ${errorObj.message}`);
      }
      
      throw new Error(`OpenAI Provider error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map model IDs from OpenRouter format to OpenAI format
   */
  private mapModelId(modelId: string): string {
    // Remove any provider prefix
    const cleanId = modelId.replace(/^openai\//, '');
    
    // Check if it's a GPT-5 model
    if (cleanId === 'gpt-5' || cleanId === 'gpt-5-mini' || cleanId === 'gpt-5-nano') {
      return cleanId; // Use GPT-5 models as-is
    }
    
    // Check if it's a specific gpt-4.1 variant with date
    if (cleanId.startsWith('gpt-4.1-')) {
      // This is a specific GPT-4.1 model with date, use it as-is
      return cleanId;
    }
    
    // Map specific model IDs
    switch (cleanId) {
      case 'gpt-4.1':
        return 'gpt-4.1-2025-04-14'; // Use the latest GPT-4.1 model
      case 'gpt-4o':
        return 'gpt-4o';
      case 'gpt-4.1-mini':
      case 'gpt-4o-mini':
        return 'gpt-4o-mini';
      case 'gpt-4.1-nano':
        return 'gpt-4o-mini'; // Use mini as fallback for nano
      default:
        // If it's already a valid OpenAI model ID, use it
        if (cleanId.startsWith('gpt-')) {
          return cleanId;
        }
        // Default to gpt-4o for unknown models
        return 'gpt-4o';
    }
  }

  private determineIntentType(request: LLMRequest): string {
    // Check if intentType is explicitly provided in the request
    const explicitIntent = (request as any).intentType;
    if (explicitIntent) {
      return explicitIntent;
    }
    
    // Simple heuristic based on request content
    const content = request.messages[request.messages.length - 1]?.content || '';
    const contentLower = content.toLowerCase();
    
    // Check for playlist discovery intents
    if (content.includes('selectedPlaylistIds') || content.includes('select') && content.includes('playlist')) {
      return 'playlist_selection';
    }
    
    if (contentLower.includes('summarize') || contentLower.includes('summary') || contentLower.includes('characteristics')) {
      return 'playlist_summarization';
    }
    
    // Most music commands should use the default MusicCommandIntent schema
    // Use case-insensitive matching for reliability
    if (contentLower.includes('play') || contentLower.includes('queue') || contentLower.includes('music') || 
        contentLower.includes('pause') || contentLower.includes('skip') || contentLower.includes('volume')) {
      return 'music_command'; // Use default schema
    }
    
    // Only use music_knowledge for specific knowledge questions
    if (contentLower.includes('who') || contentLower.includes('what') || contentLower.includes('when') || 
        contentLower.includes('where') || contentLower.includes('why') || contentLower.includes('how')) {
      return 'music_knowledge';
    }
    
    // Default to music_command instead of conversational since we don't have a conversational schema
    // This ensures we always have a valid schema for structured output
    return 'music_command';
  }

  // Note: Schema and system prompt logic has been moved to openai-schemas.ts
  // for better organization and maintainability. The getOpenAISchemaForIntent()
  // and getOpenAISystemPromptForIntent() functions now handle this logic.

  /**
   * Convert LLMRequest to OpenAI format with native message history support
   */
  private formatMessagesForOpenAI(request: LLMRequest, systemPrompt?: string, requiresJSON?: boolean): any[] {
    const formattedMessages: any[] = [];
    
    // Add system message if provided
    if (systemPrompt) {
      let finalSystemPrompt = systemPrompt;
      // If JSON is required but not mentioned in the prompt, add it
      if (requiresJSON && !systemPrompt.includes('JSON')) {
        finalSystemPrompt = systemPrompt + '\n\nIMPORTANT: You must respond with valid JSON.';
      }
      formattedMessages.push({
        role: 'system',
        content: finalSystemPrompt
      });
    } else if (requiresJSON) {
      // No system prompt but JSON is required
      formattedMessages.push({
        role: 'system',
        content: 'You must respond with valid JSON.'
      });
    }
    
    // DEPRECATED: Parse and add conversation history if present (legacy support)
    // Modern approach uses native message arrays in request.messages
    if (request.conversationContext) {
      console.warn('⚠️ OpenAI: conversationContext is deprecated - prefer native message arrays');
      // Check if we already have conversation history in the messages array
      const hasConversationHistory = request.messages.length > 2;
      if (hasConversationHistory) {
        console.warn('⚠️ OpenAI: Both conversationContext and message history present - using native messages');
      } else {
        const historyMessages = this.parseConversationContext(request.conversationContext);
        formattedMessages.push(...historyMessages);
      }
    }
    
    // Convert current messages
    for (const message of request.messages) {
      if (message.role === 'system') {
        // If this is a system message and we haven't added one yet, use it
        if (formattedMessages.length === 0 || formattedMessages[0].role !== 'system') {
          let content = message.content;
          if (requiresJSON && !content.includes('JSON')) {
            content = content + '\n\nIMPORTANT: You must respond with valid JSON.';
          }
          formattedMessages.push({
            role: 'system',
            content: content
          });
        }
        continue;
      }
      
      formattedMessages.push({
        role: message.role,
        content: message.content
      });
    }
    
    return formattedMessages;
  }

  /**
   * Validate structured output against intent types
   */
  private async validateStructuredOutput(content: string, request: LLMRequest): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const parsed = JSON.parse(content);
      
      const validationOptions: ValidationOptions = {
        strict: false,
        normalize: false,
        logErrors: true,
        context: {
          source: 'openai-direct' as const,
          model: request.model || OPENAI_MODELS.GPT_4_1,
          timestamp: Date.now(),
          rawResponse: content
        }
      };

      const result = await validateIntent(parsed, validationOptions);
      return {
        isValid: result.isValid,
        errors: result.errors
      };
      
    } catch (error) {
      return {
        isValid: false,
        errors: [`JSON parsing failed: ${error}`]
      };
    }
  }
  /**
   * Parse conversation context string into OpenAI message objects
   * Handles formats like:
   * - "User: \"command\"\nAssistant: response" (for chat responses)
   * - "User: \"command\"\nAction: played Taylor Swift - Shake It Off" (for music actions)
   */
  private parseConversationContext(conversationContext: string): any[] {
    const messages: any[] = [];
    
    // Split by double newlines to separate conversation entries
    const entries = conversationContext.split('\n\n').filter(entry => entry.trim());
    
    for (const entry of entries) {
      const lines = entry.split('\n').filter(line => line.trim());
      if (lines.length < 2) continue;
      
      // Extract user message (first line)
      const userLine = lines[0];
      const userMatch = userLine.match(/^\[?\d*\]?\s*User:\s*"([^"]+)"/);
      if (!userMatch) continue;
      
      const userContent = userMatch[1];
      
      // Extract response (second line)
      const responseLine = lines[1];
      let assistantContent = '';
      
      // Handle Assistant: format (chat responses)
      const assistantMatch = responseLine.match(/^\s*Assistant:\s*(.+)$/);
      if (assistantMatch) {
        assistantContent = assistantMatch[1];
      } else {
        // Handle Action: format (music actions)
        const actionMatch = responseLine.match(/^\s*Action:\s*(.+)$/);
        if (actionMatch) {
          const action = actionMatch[1];
          // Convert action to a more conversational response
          if (action.toLowerCase().includes('played')) {
            assistantContent = `I ${action.toLowerCase()}.`;
          } else if (action.toLowerCase().includes('queued')) {
            assistantContent = `I ${action.toLowerCase()}.`;
          } else {
            assistantContent = `I performed the action: ${action}.`;
          }
        } else {
          // Fallback: use the entire response line
          assistantContent = responseLine.replace(/^\s*\w+:\s*/, '');
        }
      }
      
      // Add user and assistant messages
      if (userContent && assistantContent) {
        messages.push(
          { role: 'user', content: userContent },
          { role: 'assistant', content: assistantContent }
        );
      }
    }
    
    return messages;
  }
}
