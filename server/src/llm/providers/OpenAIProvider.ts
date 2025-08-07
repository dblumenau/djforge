/**
 * OpenAI Provider with GPT-5 Support
 * 
 * GPT-5 Features (Released August 7, 2025):
 * - Automatic routing: Model decides optimal settings based on query complexity
 * - reasoning_effort: Control reasoning depth ('minimal', 'low', 'medium', 'high')
 * - verbosity: Control response length ('low', 'medium', 'high')
 * - Model variants: gpt-5, gpt-5-mini, gpt-5-nano
 * 
 * Speed Optimization Example:
 * {
 *   model: 'gpt-5-nano',           // Ultra-fast model
 *   reasoning_effort: 'minimal',   // Skip extensive reasoning
 *   verbosity: 'low',              // Short responses
 *   max_completion_tokens: 500,    // Limit output length
 *   temperature: 0.2               // More deterministic
 * }
 * 
 * Default Behavior:
 * - Let GPT-5's router automatically choose settings
 * - Model analyzes query complexity and optimizes accordingly
 * - Only override when specific behavior is needed
 */

import OpenAI from 'openai';
import { LLMRequest, LLMResponse } from '../orchestrator';
import { 
  getOpenAISchemaForIntent,
  getRawZodSchemaForIntent,
  getOpenAISystemPromptForIntent,
  OpenAIUnifiedSchema
} from '../openai-schemas';
import { validateIntent, ValidationOptions } from '../intent-validator';

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
      // Always use unified schema for JSON requests - let the model determine the intent
      // This is more robust than trying to pre-determine the intent type
      let openaiSchema = null;
      let systemPrompt = getOpenAISystemPromptForIntent('music_command'); // Default comprehensive prompt
      
      if (request.response_format?.type === 'json_object') {
        // Use the unified schema that includes all possible intents
        openaiSchema = OpenAIUnifiedSchema;
      }
      
      // Check if there's an explicit intent type override (for specialized cases like playlist discovery)
      const explicitIntent = (request as any).intentType;
      if (explicitIntent && explicitIntent !== 'music_command') {
        // Override with specific prompt if explicitly requested
        systemPrompt = getOpenAISystemPromptForIntent(explicitIntent);
      }
      
      // Handle conversation context
      if (request.conversationContext) {
        // Split the context into sections
        const lines = request.conversationContext.split('\n').filter(line => line.trim());
        
        // Extract currently playing track
        const currentlyPlayingLine = lines.find(line => line.includes('Currently playing:'));
        let currentlyPlayingTrack = '';
        if (currentlyPlayingLine) {
          currentlyPlayingTrack = currentlyPlayingLine;
        }
        
        // Extract taste profile
        let tasteProfile = '';
        const tasteProfileMatch = request.conversationContext.match(/User's Music Taste Profile:[\s\S]*?(?=\n\n|$)/);
        if (tasteProfileMatch) {
          tasteProfile = tasteProfileMatch[0];
        }
        
        // Extract conversation history (anything after "Recent music plays:")
        let conversationContext = '';
        const conversationMatch = request.conversationContext.match(/Recent music plays:[\s\S]*$/);
        if (conversationMatch) {
          conversationContext = conversationMatch[0];
        }
        
        // Build the context sections for the system prompt
        let contextSections = '';
        
        if (currentlyPlayingTrack) {
          contextSections += `\n\n### Currently Playing Track ###\n${currentlyPlayingTrack}`;
        } else {
          contextSections += `\n\n### Currently Playing Track ###\nNo track currently playing`;
        }
        
        if (tasteProfile) {
          contextSections += `\n\n### User Taste Profile (Secondary Reference) ###\n${tasteProfile}`;
        }
        
        if (conversationContext) {
          contextSections += `\n\n### Conversation History ###\n${conversationContext}`;
        }
        
        systemPrompt += contextSections;
      }
      
      console.log(`🎯 Using OpenAI Direct API with unified structured output`);
      
      // Convert messages to OpenAI format
      const requiresJSON = request.response_format?.type === 'json_object';
      const messages = this.formatMessagesForOpenAI(request.messages, systemPrompt, requiresJSON);
      
      let response;
      
      // Use structured output if JSON format is requested and schema is available
      if (request.response_format?.type === 'json_object' && openaiSchema) {
        // Map the model ID to the actual OpenAI model
        const actualModel = this.mapModelId(request.model || OPENAI_MODELS.GPT_4_1);
        console.log(`🔧 Using OpenAI structured output with pre-wrapped schema for ${actualModel}`);
        
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
            // GPT-5 supports up to 128,000 output tokens
            params.max_completion_tokens = 65536; // Use half of max to balance speed/completeness
          }
          
          // GPT-5's automatic router decides optimal settings by default
          // Only override if explicitly provided in the request
          if ((request as any).reasoning_effort !== undefined) {
            params.reasoning_effort = (request as any).reasoning_effort; // 'minimal', 'low', 'medium', 'high'
          }
          // Otherwise, let GPT-5's router automatically choose based on query complexity
          
          if ((request as any).verbosity !== undefined) {
            params.verbosity = (request as any).verbosity; // 'low', 'medium', 'high'
          }
          // Otherwise, let GPT-5 determine appropriate verbosity
          
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
            // GPT-5 supports up to 128,000 output tokens
            params.max_completion_tokens = 65536; // Use half of max to balance speed/completeness
          }
          
          // GPT-5's automatic router decides optimal settings by default
          // Only override if explicitly provided in the request
          if ((request as any).reasoning_effort !== undefined) {
            params.reasoning_effort = (request as any).reasoning_effort; // 'minimal', 'low', 'medium', 'high'
          }
          // Otherwise, let GPT-5's router automatically choose based on query complexity
          
          if ((request as any).verbosity !== undefined) {
            params.verbosity = (request as any).verbosity; // 'low', 'medium', 'high'
          }
          // Otherwise, let GPT-5 determine appropriate verbosity
          
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
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          throw new Error('OpenAI API rate limit exceeded');
        } else if (error.status === 401) {
          throw new Error('Invalid OpenAI API key');
        } else if (error.status === 400) {
          throw new Error(`OpenAI API bad request: ${error.message}`);
        }
        throw new Error(`OpenAI API error (${error.status}): ${error.message}`);
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
   * Convert LLMRequest messages to OpenAI format
   */
  private formatMessagesForOpenAI(messages: LLMRequest['messages'], systemPrompt?: string, requiresJSON?: boolean): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const formattedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    
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
    
    // Convert other messages
    for (const message of messages) {
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
  private validateStructuredOutput(content: string, request: LLMRequest): { isValid: boolean; errors: string[] } {
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

      const result = validateIntent(parsed, validationOptions);
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
}