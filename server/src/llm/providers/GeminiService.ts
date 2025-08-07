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
      // Check for explicit intent type in request
      let intentType = (request as any).intentType || this.determineIntentType(request);
      
      // Determine schema based on request context
      const schema = getSchemaForIntent(intentType);
      let systemPrompt = getSystemPromptForIntent(intentType);
      
      // Handle conversation context
      let tasteProfile = '';
      let currentlyPlayingTrack = '';
      let conversationContext = '';
      
      if (request.conversationContext) {
        // Split the context into sections
        const lines = request.conversationContext.split('\n').filter(line => line.trim());
        
        // Extract currently playing track
        const currentlyPlayingLine = lines.find(line => line.includes('Currently playing:'));
        if (currentlyPlayingLine) {
          currentlyPlayingTrack = currentlyPlayingLine;
        }
        
        // Extract taste profile
        const tasteProfileMatch = request.conversationContext.match(/User's Music Taste Profile:[\s\S]*?(?=\n\n|$)/);
        if (tasteProfileMatch) {
          tasteProfile = tasteProfileMatch[0];
        }
        
        // Extract conversation history (anything after "Recent music plays:")
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
      
      // Check if response was truncated due to token limit
      if (response?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        throw new Error('Response truncated: Token limit exceeded. The request requires more output tokens than the current limit allows.');
      }
      
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
    const contentLower = content.toLowerCase();
    
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
      // Log the response structure for debugging
      console.log('🔍 Gemini response structure:', {
        hasResponse: !!response,
        responseType: typeof response,
        hasText: !!response?.text,
        hasCandidates: !!response?.candidates,
        candidatesLength: response?.candidates?.length,
        responseKeys: response ? Object.keys(response) : [],
        finishReason: response?.candidates?.[0]?.finishReason
      });
      
      // Check if response has a direct text method (common in @google/genai)
      if (response?.text && typeof response.text === 'function') {
        try {
          const textContent = response.text();
          console.log('📤 Extracted via text() method:', textContent?.substring(0, 200));
          return textContent || '';
        } catch (textError) {
          console.warn('Failed to call text() method:', textError);
        }
      }
      
      // Check if response has direct text property
      if (response?.text && typeof response.text === 'string') {
        console.log('📤 Extracted via text property:', response.text.substring(0, 200));
        return response.text;
      }
      
      // Check candidates array structure
      if (response?.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        
        // Try different paths for content extraction
        if (candidate.content?.parts?.[0]?.text) {
          console.log('📤 Extracted via candidates.content.parts:', candidate.content.parts[0].text.substring(0, 200));
          return candidate.content.parts[0].text;
        }
        
        if (candidate.text) {
          console.log('📤 Extracted via candidates.text:', candidate.text.substring(0, 200));
          return candidate.text;
        }
        
        // Check if candidate has output directly (for structured responses)
        if (candidate.output) {
          const output = typeof candidate.output === 'string' 
            ? candidate.output 
            : JSON.stringify(candidate.output);
          console.log('📤 Extracted via candidates.output:', output.substring(0, 200));
          return output;
        }
      }
      
      // Check if response itself is the content (for structured output)
      if (response?.response) {
        const content = typeof response.response === 'string'
          ? response.response
          : JSON.stringify(response.response);
        console.log('📤 Extracted via response.response:', content.substring(0, 200));
        return content;
      }
      
      // If response is already a parsed object (possible with structured output)
      if (response && typeof response === 'object' && !response.candidates && !response.text) {
        // Check if it looks like our expected schema
        if (response.selectedPlaylistIds || response.summary || response.intent) {
          const content = JSON.stringify(response);
          console.log('📤 Response appears to be pre-parsed structured output:', content.substring(0, 200));
          return content;
        }
      }
      
      // Special handling for MAX_TOKENS finish reason
      if (response?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        console.error('❌ Gemini response truncated due to MAX_TOKENS');
        return '';
      }
      
      console.error('❌ Unexpected Gemini response format. Full response structure:', JSON.stringify(response, null, 2).substring(0, 1000));
      return '';
    } catch (error) {
      console.error('❌ Error extracting content from Gemini response:', error);
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