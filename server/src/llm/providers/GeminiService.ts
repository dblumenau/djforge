import { GoogleGenAI, Type } from "@google/genai";
import { LLMRequest, LLMResponse } from '../orchestrator';
import { 
  getSchemaForIntent, 
  getSystemPromptForIntent, 
  GEMINI_SCHEMAS 
} from '../gemini-schemas';
import { validateIntent, ValidationOptions } from '../intent-validator';

export interface GeminiServiceOptions {
  apiKey: string;
  enableGrounding?: boolean;
  timeout?: number;
  maxRetries?: number;
}

export interface GroundedSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface GroundedResponse extends LLMResponse {
  isGrounded: boolean;
  sources?: GroundedSource[];
  searchQueries?: string[];
  groundingMetadata?: {
    searchResultsCount: number;
    groundingScore: number;
  };
}

export class GeminiService {
  private client: GoogleGenAI;
  private enableGrounding: boolean;
  private timeout: number;
  private maxRetries: number;

  constructor(options: GeminiServiceOptions) {
    // FIXED: Use proper API key initialization for @google/genai v1.9.0
    this.client = new GoogleGenAI({ apiKey: options.apiKey });
    this.enableGrounding = options.enableGrounding ?? true;
    this.timeout = options.timeout ?? 30000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Determine schema based on request context
      const intentType = this.determineIntentType(request);
      const schema = getSchemaForIntent(intentType);
      let systemPrompt = getSystemPromptForIntent(intentType);
      
      // Handle conversation context
      let tasteProfile = '';
      let conversationContext = '';
      
      if (request.conversationContext) {
        // Check if the context includes a taste profile
        const tasteProfileMatch = request.conversationContext.match(/User's Music Taste Profile:[\s\S]*?(?=\n\n|$)/);
        if (tasteProfileMatch) {
          // Extract taste profile
          tasteProfile = tasteProfileMatch[0];
          // Remove taste profile from conversation context
          conversationContext = request.conversationContext.replace(tasteProfileMatch[0], '').trim();
        } else {
          conversationContext = request.conversationContext;
        }
        
        // Only add conversation context to system prompt (not taste profile)
        if (conversationContext) {
          systemPrompt += `\n\nCONVERSATION CONTEXT:\n${conversationContext}`;
        }
      }
      
      console.log(`🎯 Using @google/genai API with native responseSchema for intent: ${intentType}`);
      
      // Convert messages to Gemini format
      const contents = this.formatMessagesForGemini(request.messages);
      
      // Use the @google/genai API with proper message format and system instruction
      const response = await this.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.max_tokens ?? 4000
        }
      });
      
      
      // Extract content from the response
      const content = this.extractContentFromResponse(response);
      
      // Validate the response
      if (request.response_format?.type === 'json_object') {
        const validationResult = this.validateStructuredOutput(content, request);
        if (!validationResult.isValid) {
          console.warn('Gemini API structured output validation failed:', validationResult.errors);
        }
      }
      
      return {
        content,
        usage: {
          prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
          completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: response.usageMetadata?.totalTokenCount || 0
        },
        model: request.model || 'gemini-2.5-flash',
        provider: 'google-genai-direct'
      };
      
    } catch (error) {
      console.error('GeminiService error:', error);
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private determineIntentType(request: LLMRequest): string {
    // Simple heuristic based on request content
    const content = request.messages[request.messages.length - 1]?.content || '';
    
    // Most music commands should use the default MusicCommandIntent schema
    if (content.includes('play') || content.includes('queue') || content.includes('music') || 
        content.includes('pause') || content.includes('skip') || content.includes('volume')) {
      return 'music_command'; // Use default schema
    }
    
    // Only use music_knowledge for specific knowledge questions
    if (content.includes('who') || content.includes('what') || content.includes('when') || 
        content.includes('where') || content.includes('why') || content.includes('how')) {
      return 'music_knowledge';
    }
    
    return 'conversational';
  }


  /**
   * Convert LLMRequest messages to Gemini format
   */
  private formatMessagesForGemini(messages: LLMRequest['messages']): any[] {
    return messages
      .filter(message => message.role !== 'system') // System messages go to systemInstruction
      .map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }]
      }));
  }

  /**
   * Extract content from Gemini response
   */
  private extractContentFromResponse(response: any): string {
    try {
      // For structured output, the response should be in the candidates array
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          return candidate.content.parts[0].text || '';
        }
      }
      
      // Fallback to response.text if available
      if (response.text) {
        return response.text;
      }
      
      console.warn('Unexpected response format:', response);
      return '';
    } catch (error) {
      console.error('Error extracting content from response:', error);
      return '';
    }
  }

  private validateStructuredOutput(content: string, request: LLMRequest): { isValid: boolean; errors: string[] } {
    try {
      const parsed = JSON.parse(content);
      
      const validationOptions: ValidationOptions = {
        strict: false,
        normalize: false,
        logErrors: true,
        context: {
          source: 'gemini-direct' as const,
          model: request.model || 'gemini-2.5-flash',
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