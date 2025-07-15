import { GoogleGenerativeAI, GenerativeModel, Part, FunctionCallingMode } from '@google/generative-ai';
import { LLMRequest, LLMResponse } from '../orchestrator';

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
  private client: GoogleGenerativeAI;
  private enableGrounding: boolean;
  private timeout: number;
  private maxRetries: number;

  constructor(options: GeminiServiceOptions) {
    this.client = new GoogleGenerativeAI(options.apiKey);
    this.enableGrounding = options.enableGrounding ?? true;
    this.timeout = options.timeout ?? 30000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const model = this.getModel(request.model || 'gemini-2.5-flash');
    
    try {
      // Check if grounding is requested and enabled
      const useGrounding = this.enableGrounding && this.shouldUseGrounding(request);
      
      if (useGrounding) {
        return await this.completeWithGrounding(model, request);
      } else {
        return await this.completeStandard(model, request);
      }
    } catch (error) {
      console.error('GeminiService error:', error);
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async completeWithGrounding(model: GenerativeModel, request: LLMRequest): Promise<GroundedResponse> {
    const tools = [
      {
        googleSearchRetrieval: {
          // Enable Google Search grounding
        }
      }
    ];

    const result = await model.generateContent({
      contents: this.formatMessages(request.messages),
      tools,
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.AUTO
        }
      },
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.max_tokens ?? 2000,
        responseMimeType: request.response_format?.type === 'json_object' ? 'application/json' : 'text/plain'
      }
    });

    const response = result.response;
    const content = response.text();
    
    // Extract grounding metadata from response
    const { sources, searchQueries, groundingMetadata } = this.extractGroundingMetadata(response);

    return {
      content,
      usage: {
        prompt_tokens: result.response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: result.response.usageMetadata?.totalTokenCount || 0
      },
      model: request.model || 'gemini-2.5-flash',
      provider: 'google-direct',
      isGrounded: sources.length > 0,
      sources,
      searchQueries,
      groundingMetadata
    };
  }

  private async completeStandard(model: GenerativeModel, request: LLMRequest): Promise<LLMResponse> {
    const result = await model.generateContent({
      contents: this.formatMessages(request.messages),
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.max_tokens ?? 2000,
        responseMimeType: request.response_format?.type === 'json_object' ? 'application/json' : 'text/plain'
      }
    });

    const response = result.response;
    const content = response.text();

    return {
      content,
      usage: {
        prompt_tokens: result.response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: result.response.usageMetadata?.totalTokenCount || 0
      },
      model: request.model || 'gemini-2.5-flash',
      provider: 'google-direct'
    };
  }

  private getModel(modelName: string): GenerativeModel {
    // Map OpenRouter model names to Google API model names
    const modelMap: Record<string, string> = {
      'google/gemini-2.5-pro': 'gemini-2.5-pro',
      'google/gemini-2.5-flash': 'gemini-2.5-flash',
      'google/gemini-2.5-pro-preview': 'gemini-2.5-pro-preview',
      'google/gemini-2.5-flash-lite-preview-06-17': 'gemini-2.5-flash-lite-preview-0617',
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gemini-2.5-flash': 'gemini-2.5-flash',
      'gemini-2.5-pro-preview': 'gemini-2.5-pro-preview',
    };

    const actualModelName = modelMap[modelName] || modelName;
    return this.client.getGenerativeModel({ model: actualModelName });
  }

  private formatMessages(messages: LLMRequest['messages']): Array<{ role: string; parts: Part[] }> {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));
  }

  private shouldUseGrounding(request: LLMRequest): boolean {
    // Only use grounding for certain types of queries
    const content = request.messages[request.messages.length - 1]?.content || '';
    
    // Enable grounding for questions, searches, and knowledge queries
    const groundingTriggers = [
      'what is',
      'who is',
      'when did',
      'where is',
      'how to',
      'tell me about',
      'search for',
      'find information',
      'latest',
      'recent',
      'current',
      'news',
      'update'
    ];

    return groundingTriggers.some(trigger => 
      content.toLowerCase().includes(trigger)
    );
  }

  private extractGroundingMetadata(response: any): {
    sources: GroundedSource[];
    searchQueries: string[];
    groundingMetadata: {
      searchResultsCount: number;
      groundingScore: number;
    };
  } {
    const sources: GroundedSource[] = [];
    const searchQueries: string[] = [];
    
    // Extract grounding metadata from response
    // This is a simplified implementation - actual structure depends on Google's API response format
    try {
      const metadata = response.usageMetadata?.groundingMetadata;
      if (metadata) {
        // Extract sources from grounding metadata
        if (metadata.searchEntryPoint?.searchResults) {
          metadata.searchEntryPoint.searchResults.forEach((result: any) => {
            sources.push({
              title: result.title || 'Unknown',
              url: result.url || '',
              snippet: result.snippet || ''
            });
          });
        }

        // Extract search queries
        if (metadata.searchQueries) {
          searchQueries.push(...metadata.searchQueries);
        }
      }
    } catch (error) {
      console.warn('Failed to extract grounding metadata:', error);
    }

    return {
      sources,
      searchQueries,
      groundingMetadata: {
        searchResultsCount: sources.length,
        groundingScore: sources.length > 0 ? 1.0 : 0.0
      }
    };
  }

  // Validation method to check if API key is valid
  async validateConnection(): Promise<{ isValid: boolean; error?: string }> {
    try {
      const model = this.getModel('gemini-2.5-flash');
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        generationConfig: {
          maxOutputTokens: 10
        }
      });

      const response = result.response;
      return {
        isValid: !!response.text(),
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper method to check supported models
  static getSupportedModels(): string[] {
    return [
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
      'google/gemini-2.5-pro-preview',
      'google/gemini-2.5-flash-lite-preview-06-17',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-pro-preview'
    ];
  }

  // Helper method to check if a model supports grounding
  static supportsGrounding(model: string): boolean {
    const groundingCapableModels = [
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
      'google/gemini-2.5-pro-preview',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-pro-preview'
    ];

    return groundingCapableModels.includes(model);
  }
}