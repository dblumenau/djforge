import axios, { AxiosError } from 'axios';
import { z } from 'zod';
import { normalizeLLMResponse } from './normalizer';
import { GeminiService } from './providers/GeminiService';
import { validateIntent, ValidationOptions } from './intent-validator';
import { LLMLoggingService } from '../services/llm-logging.service';

// LLM Provider Configuration
export interface LLMProvider {
  name: string;
  baseURL: string;
  apiKey: string;
  models: string[];
  supportsJSON: boolean;
  maxRetries?: number;
  timeout?: number;
}

// Request/Response Types
export interface LLMRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' } | undefined;
  schema?: z.ZodSchema;
  conversationContext?: string; // Added for conversation history integration
  skipValidation?: boolean; // Skip intent validation for non-command responses (e.g., playlist discovery)
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  provider: string;
  flow?: 'openrouter' | 'gemini-direct';
  rawResponse?: any;  // Complete raw response before processing
  fullRequest?: any;  // Complete request object
  processingSteps?: Array<{
    step: string;
    before: any;
    after: any;
  }>;
}

// OpenRouter Models (Updated 2025-07-12)
export const OPENROUTER_MODELS = {
  // Anthropic Claude Models
  CLAUDE_OPUS_4: 'anthropic/claude-opus-4',
  CLAUDE_SONNET_4: 'anthropic/claude-sonnet-4',
  CLAUDE_HAIKU_4: 'anthropic/claude-4-haiku',

  // OpenAI Models
  O3_PRO: 'openai/o3-pro',
  O3: 'openai/o3',
  O3_DEEP_RESEARCH: 'openai/o3-deep-research',
  O3_PRO_2025_06_10: 'openai/o3-pro-2025-06-10',
  O4_MINI: 'openai/o4-mini',
  O4_MINI_DEEP_RESEARCH: 'openai/o4-mini-deep-research',
  O1: 'openai/o1',
  O1_PRO: 'openai/o1-pro',
  GPT_4_1: 'openai/gpt-4.1',
  GPT_4_1_NANO: 'openai/gpt-4.1-nano',
  GPT_4O: 'openai/gpt-4o',
  GPT_4O_MINI: 'openai/gpt-4o-mini',
  CODEX_MINI: 'openai/codex-mini',
  
  // Google Gemini Models
  GEMINI_2_5_PRO: 'google/gemini-2.5-pro',
  GEMINI_2_5_PRO_PREVIEW: 'google/gemini-2.5-pro-preview',
  GEMINI_2_5_FLASH: 'google/gemini-2.5-flash',
  GEMINI_2_5_FLASH_LITE: 'google/gemini-2.5-flash-lite-preview-06-17',
  
  // Meta Llama Models
  LLAMA_GUARD_4_12B: 'meta-llama/llama-guard-4-12b',
  
  // Mistral Models
  MISTRAL_MEDIUM_3: 'mistralai/mistral-medium-3',
  DEVSTRAL_MEDIUM: 'mistralai/devstral-medium',
  DEVSTRAL_SMALL: 'mistralai/devstral-small',
  DEVSTRAL_SMALL_2505: 'mistralai/devstral-small-2505',
  MAGISTRAL_SMALL_2506: 'mistralai/magistral-small-2506',
  MAGISTRAL_MEDIUM_2506: 'mistralai/magistral-medium-2506',
  MISTRAL_SMALL_3_2: 'mistralai/mistral-small-3.2-24b-instruct',
  
  // DeepSeek Models
  DEEPSEEK_R1_DISTILL: 'deepseek/deepseek-r1-distill-qwen-7b',
  DEEPSEEK_R1_QWEN3_8B: 'deepseek/deepseek-r1-0528-qwen3-8b',
  DEEPSEEK_R1_0528: 'deepseek/deepseek-r1-0528',
  DEEPSEEK_PROVER_V2: 'deepseek/deepseek-prover-v2',
  
  // X.AI Grok Models
  GROK_4: 'x-ai/grok-4',
  GROK_3: 'x-ai/grok-3',
  GROK_3_MINI: 'x-ai/grok-3-mini',
  
  // Qwen Models
  QWEN3_235B: 'qwen/qwen3-235b-a22b',
  QWEN3_32B: 'qwen/qwen3-32b',
  QWEN3_14B: 'qwen/qwen3-14b',
  QWEN3_8B: 'qwen/qwen3-8b',
  QWEN3_4B: 'qwen/qwen3-4b',
};

// Model capabilities
// Based on OpenRouter documentation, JSON mode is primarily supported by:
// - OpenAI models (o3, o4, gpt-4 variants)
// - Some Nitro models
// - Limited support from other providers (often silently ignored if unsupported)
const JSON_CAPABLE_MODELS = new Set([
  // OpenAI models - confirmed JSON support
  OPENROUTER_MODELS.O3_PRO,
  OPENROUTER_MODELS.O3,
  OPENROUTER_MODELS.O3_DEEP_RESEARCH,
  OPENROUTER_MODELS.O3_PRO_2025_06_10,
  OPENROUTER_MODELS.O4_MINI,
  OPENROUTER_MODELS.O4_MINI_DEEP_RESEARCH,
  OPENROUTER_MODELS.O1,
  OPENROUTER_MODELS.O1_PRO,
  OPENROUTER_MODELS.GPT_4_1,
  OPENROUTER_MODELS.GPT_4_1_NANO,
  OPENROUTER_MODELS.GPT_4O,
  OPENROUTER_MODELS.GPT_4O_MINI,
  OPENROUTER_MODELS.CODEX_MINI,
  
  // Claude models - use tool calling for JSON, not native JSON mode
  // Keeping these as they work with JSON responses, though not native JSON mode
  OPENROUTER_MODELS.CLAUDE_OPUS_4,
  OPENROUTER_MODELS.CLAUDE_SONNET_4,
  OPENROUTER_MODELS.CLAUDE_HAIKU_4,
  
  // Google models - limited JSON support, requires specific schema setup
  OPENROUTER_MODELS.GEMINI_2_5_PRO,
  OPENROUTER_MODELS.GEMINI_2_5_PRO_PREVIEW,
  OPENROUTER_MODELS.GEMINI_2_5_FLASH,
  
  // These models may support JSON but documentation is unclear
  // Including based on their advanced capabilities
  OPENROUTER_MODELS.MISTRAL_MEDIUM_3,
  OPENROUTER_MODELS.MAGISTRAL_MEDIUM_2506,
  OPENROUTER_MODELS.DEEPSEEK_R1_0528,
  OPENROUTER_MODELS.GROK_4,
  OPENROUTER_MODELS.GROK_3,
]);

export class LLMOrchestrator {
  private providers: LLMProvider[] = [];
  private defaultModel: string;
  private initialized = false;
  private geminiService: GeminiService | null = null;
  private loggingService: LLMLoggingService | null = null;
  
  constructor() {
    this.defaultModel = OPENROUTER_MODELS.GEMINI_2_5_FLASH;
  }

  private ensureInitialized() {
    if (!this.initialized) {
      this.setupProviders();
      this.initialized = true;
    }
  }

  private setupProviders() {
    // Google AI Direct (for Gemini models with native grounding)
    if (process.env.GEMINI_API_KEY) {
      this.geminiService = new GeminiService({
        apiKey: process.env.GEMINI_API_KEY,
        enableGrounding: process.env.GEMINI_SEARCH_GROUNDING === 'true',
        timeout: 30000,
        maxRetries: 3
      });
    }

    // OpenRouter (supports all models)
    if (process.env.OPENROUTER_API_KEY) {
      this.providers.push({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        models: Object.values(OPENROUTER_MODELS),
        supportsJSON: true,
        maxRetries: 3,
        timeout: 30000,
      });
    }

    // Direct Claude API (if available)
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.push({
        name: 'anthropic',
        baseURL: 'https://api.anthropic.com/v1',
        apiKey: process.env.ANTHROPIC_API_KEY,
        models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
        supportsJSON: false, // Claude doesn't have native JSON mode
        maxRetries: 2,
        timeout: 60000,
      });
    }

    // Direct OpenAI API (if available)
    if (process.env.OPENAI_API_KEY) {
      this.providers.push({
        name: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
        supportsJSON: true,
        maxRetries: 2,
        timeout: 30000,
      });
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    this.ensureInitialized();
    const model = request.model || this.defaultModel;

    // Try the specified model only - no fallbacks
    try {
      const response = await this.callModel(model, request);
      return response;
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      console.error(`Model ${model} failed:`, error);
      
      // Create a descriptive error message for the frontend
      throw new Error(`${model} failed: ${errorMessage}`);
    }
  }

  private async callModel(model: string, request: LLMRequest): Promise<LLMResponse> {
    // Check if this is a Gemini model that should use direct API
    if (this.isGeminiModel(model) && this.geminiService) {
      console.log(`🔄 Routing ${model} to Google AI Direct API (Native Structured Output)`);
      try {
        // Store the full request for logging
        const fullRequest = {
          ...request,
          model,
          provider: 'google-direct'
        };
        
        const response = await this.geminiService.complete(request);
        
        // Store raw response and processing steps
        const processingSteps: Array<{ step: string; before: any; after: any }> = [];
        
        // Step 1: Record that we received a response from Gemini
        processingSteps.push({
          step: 'geminiDirectResponse',
          before: { model, provider: 'google-direct' },
          after: { 
            contentType: typeof response.content,
            hasContent: !!response.content,
            contentLength: response.content?.length || 0,
            model: response.model 
          }
        });
        
        // Check if we got an empty response
        if (!response.content || response.content.trim() === '') {
          console.error(`❌ Gemini returned empty content for ${model}`);
          throw new Error('Gemini API returned empty response - triggering fallback');
        }
        
        // Step 2: Gemini provides native structured output
        if (request.response_format?.type === 'json_object') {
          processingSteps.push({
            step: 'nativeStructuredOutput',
            before: 'Gemini native JSON mode',
            after: response.content
          });
          
          // Try to parse JSON to ensure it's valid
          try {
            const parsed = JSON.parse(response.content);
            if (!parsed || Object.keys(parsed).length === 0) {
              throw new Error('Gemini returned empty JSON object');
            }
          } catch (parseError) {
            console.error(`❌ Gemini JSON parsing failed:`, parseError);
            throw new Error(`Gemini returned invalid JSON: ${parseError}`);
          }
          
          // Validate structured output (unless skipValidation is set)
          if (!request.skipValidation) {
            this.validateAndLogResponse(response, 'gemini-direct', model);
            processingSteps.push({
              step: 'validateStructuredOutput',
              before: response.content,
              after: { status: 'validated', flow: 'gemini-direct' }
            });
          } else {
            processingSteps.push({
              step: 'skipValidation',
              before: response.content,
              after: { status: 'skipped', reason: 'skipValidation flag set' }
            });
          }
        } else {
          processingSteps.push({
            step: 'plainTextResponse',
            before: 'No JSON processing required',
            after: response.content
          });
        }
        
        // Log the actual model response
        console.log(`📤 ${model} response:`, response.content?.substring(0, 200) || 'EMPTY');
        
        // Add flow information and enhanced logging data
        return {
          ...response,
          flow: 'gemini-direct',
          rawResponse: response,
          fullRequest,
          processingSteps
        };
      } catch (error) {
        console.error(`Google AI Direct failed for ${model}:`, error);
        // Don't fall back to OpenRouter - throw the error immediately
        throw new Error(`Gemini API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Find provider that supports this model
    const provider = this.providers.find(p => 
      p.models.some(m => m === model || model.includes(m))
    );

    if (!provider) {
      throw new Error(`No provider found for model: ${model}`);
    }

    console.log(`🔄 Routing ${model} to ${provider.name}`);

    // Prepare request based on provider
    const requestBody = this.prepareRequest(provider, model, request);
    
    // Store the full request for logging
    const fullRequest = {
      ...request,
      model,
      provider: provider.name,
      requestBody
    };
    
    try {
      const response = await axios.post(
        `${provider.baseURL}/chat/completions`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://djforge.app', // Required for OpenRouter
            'X-Title': 'DJForge Music Controller', // Optional for OpenRouter
          },
          timeout: provider.timeout || 30000,
        }
      );

      // Store raw response and processing steps
      const rawResponse = response.data;
      const processingSteps: Array<{ step: string; before: any; after: any }> = [];
      
      // Extract and validate response
      let content = response.data.choices[0].message.content;
      const originalContent = content;
      
      // Step 1: Extract content from API response
      processingSteps.push({
        step: 'extractContent',
        before: { choices: response.data.choices?.length || 0, model: response.data.model },
        after: originalContent
      });
      
      // If schema provided, validate JSON response
      if (request.schema && request.response_format?.type === 'json_object') {
        try {
          // Step 2: Clean common JSON formatting issues
          const beforeCleaning = content;
          content = this.cleanJSONResponse(content);
          processingSteps.push({
            step: 'cleanJSONResponse',
            before: beforeCleaning,
            after: content
          });
          
          // Step 3: Parse JSON
          let parsed;
          try {
            parsed = JSON.parse(content);
            processingSteps.push({
              step: 'parseJSON',
              before: content,
              after: parsed
            });
          } catch (parseError: any) {
            processingSteps.push({
              step: 'parseJSON',
              before: content,
              after: { error: parseError.message || 'Failed to parse JSON' }
            });
            throw parseError;
          }
          
          // Step 4: Normalize the response
          const beforeNormalization = JSON.parse(JSON.stringify(parsed)); // Deep copy
          parsed = normalizeLLMResponse(parsed);
          processingSteps.push({
            step: 'normalizeLLMResponse',
            before: beforeNormalization,
            after: parsed
          });
          
          // Step 5: Validate against schema
          try {
            request.schema.parse(parsed);
            processingSteps.push({
              step: 'schemaValidation',
              before: parsed,
              after: { status: 'valid', schema: 'Zod' }
            });
          } catch (validationError: any) {
            processingSteps.push({
              step: 'schemaValidation',
              before: parsed,
              after: { status: 'invalid', error: validationError.message || 'Schema validation failed' }
            });
            throw validationError;
          }
          
          // Return the normalized content
          content = JSON.stringify(parsed);
        } catch (error) {
          throw new Error(`Invalid JSON response format: ${error}`);
        }
      } else {
        // For non-JSON responses, record that no processing was needed
        processingSteps.push({
          step: 'noProcessingRequired',
          before: 'Plain text response',
          after: content
        });
      }

      const llmResponse = {
        content,
        usage: response.data.usage,
        model: response.data.model || model,
        provider: provider.name,
        flow: 'openrouter' as const,
        rawResponse,
        fullRequest,
        processingSteps
      };

      // Validate structured output if JSON format was requested (unless skipValidation is set)
      if (request.response_format?.type === 'json_object' && !request.skipValidation) {
        this.validateAndLogResponse(llmResponse, 'openrouter', model);
      }

      // Log the actual model response
      console.log(`📤 ${model} response:`, llmResponse.content);

      return llmResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 429) {
          throw new Error('Rate limit exceeded');
        } else if (axiosError.response?.status === 401) {
          throw new Error('Invalid API key');
        } else if (axiosError.response?.status === 400) {
          throw new Error(`Bad request: ${JSON.stringify(axiosError.response.data)}`);
        }
      }
      throw error;
    }
  }

  private prepareRequest(provider: LLMProvider, model: string, request: LLMRequest) {
    let messages = [...request.messages];
    
    // Add conversation context to system message if provided
    if (request.conversationContext) {
      const systemMessageIndex = messages.findIndex(m => m.role === 'system');
      if (systemMessageIndex >= 0) {
        messages[systemMessageIndex] = {
          ...messages[systemMessageIndex],
          content: messages[systemMessageIndex].content + request.conversationContext
        };
      } else {
        // No system message exists, add one with context
        messages.unshift({
          role: 'system',
          content: 'You are a helpful assistant.' + request.conversationContext
        });
      }
    }
    
    const baseRequest: any = {
      model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 2000,
    };

    // Add JSON mode if supported and requested
    if (request.response_format?.type === 'json_object' && provider.supportsJSON) {
      if (JSON_CAPABLE_MODELS.has(model)) {
        baseRequest.response_format = { type: 'json_object' };
        
        // Ensure system message mentions JSON
        if (!baseRequest.messages.some((m: any) => m.role === 'system' && m.content.includes('JSON'))) {
          baseRequest.messages = [
            { role: 'system', content: 'You must respond with valid JSON.' },
            ...baseRequest.messages
          ];
        }
      }
    }

    // Provider-specific adjustments
    if (provider.name === 'anthropic') {
      // Claude API has different format
      return {
        model: model.replace('anthropic/', ''),
        messages: baseRequest.messages.filter((m: any) => m.role !== 'system'),
        system: baseRequest.messages.find((m: any) => m.role === 'system')?.content,
        max_tokens: baseRequest.max_tokens,
        temperature: baseRequest.temperature,
      };
    }

    return baseRequest;
  }

  private extractErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.data) {
        const data = axiosError.response.data as any;
        return data.error?.message || data.message || JSON.stringify(data);
      }
      return axiosError.message;
    }
    return error.message || 'Unknown error';
  }

  private cleanJSONResponse(content: string): string {
    // Remove markdown code blocks
    if (content.includes('```json')) {
      content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (content.includes('```')) {
      content = content.replace(/```\s*/g, '');
    }
    
    // Remove any leading/trailing text outside JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    // Trim whitespace
    return content.trim();
  }

  // Helper method to check if a model supports JSON mode
  isJSONCapable(model: string): boolean {
    return JSON_CAPABLE_MODELS.has(model);
  }

  // Get available models
  getAvailableModels(): string[] {
    this.ensureInitialized();
    const models = new Set<string>();
    
    // Add models from registered providers
    this.providers.forEach(provider => {
      provider.models.forEach(model => models.add(model));
    });
    
    // Add Gemini models if direct API is available
    if (this.geminiService) {
      // Add the Gemini models that we support via direct API
      models.add(OPENROUTER_MODELS.GEMINI_2_5_PRO);
      models.add(OPENROUTER_MODELS.GEMINI_2_5_PRO_PREVIEW);
      models.add(OPENROUTER_MODELS.GEMINI_2_5_FLASH);
      models.add(OPENROUTER_MODELS.GEMINI_2_5_FLASH_LITE);
    }
    
    return Array.from(models);
  }


  // Set default model
  setDefaultModel(model: string) {
    this.defaultModel = model;
  }

  // Set logging service
  setLoggingService(loggingService: LLMLoggingService) {
    this.loggingService = loggingService;
  }

  // Get all model IDs as a list
  getAllModelIds(): string[] {
    return Object.values(OPENROUTER_MODELS);
  }

  // Check if a model ID is valid
  isValidModel(modelId: string): boolean {
    return Object.values(OPENROUTER_MODELS).includes(modelId);
  }

  // Check if a model is a Gemini model
  private isGeminiModel(model: string): boolean {
    return model.includes('gemini') || model.includes('google/gemini');
  }

  /**
   * Validate and log structured output from both paths
   */
  private validateAndLogResponse(
    response: LLMResponse, 
    source: 'openrouter' | 'gemini-direct',
    model: string
  ): void {
    try {
      const parsed = JSON.parse(response.content);
      
      const validationOptions: ValidationOptions = {
        strict: false,
        normalize: false,
        logErrors: true,
        context: {
          source,
          model,
          timestamp: Date.now(),
          rawResponse: response.content
        }
      };

      const result = validateIntent(parsed, validationOptions);
      
      if (result.isValid) {
        console.log(`✅ ${source} validation passed for ${model} (${result.intentType})`);
      } else {
        console.warn(`❌ ${source} validation failed for ${model}:`, result.errors);
      }
      
      if (result.warnings.length > 0) {
        console.warn(`⚠️  ${source} validation warnings for ${model}:`, result.warnings);
      }
    } catch (error) {
      console.error(`🔥 JSON parsing failed for ${source} ${model}:`, error);
    }
  }

  // Check if a model supports grounding
  supportsGrounding(model: string): boolean {
    this.ensureInitialized();
    return this.isGeminiModel(model) && this.geminiService !== null;
  }

  // Get provider info for a model
  getProviderInfo(model: string): { provider: string; isDirect: boolean; supportsGrounding: boolean } {
    this.ensureInitialized();
    
    if (this.isGeminiModel(model) && this.geminiService) {
      return {
        provider: 'google-direct',
        isDirect: true,
        supportsGrounding: true
      };
    }

    const provider = this.providers.find(p => 
      p.models.some(m => m === model || model.includes(m))
    );

    return {
      provider: provider?.name || 'unknown',
      isDirect: false,
      supportsGrounding: false
    };
  }
}

// Singleton instance
export const llmOrchestrator = new LLMOrchestrator();