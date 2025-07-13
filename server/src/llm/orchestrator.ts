import axios, { AxiosError } from 'axios';
import { z } from 'zod';
import { normalizeLLMResponse } from './normalizer';

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
}

// OpenRouter Models (Updated 2025-07-12)
export const OPENROUTER_MODELS = {
  // Anthropic Claude Models
  CLAUDE_OPUS_4: 'anthropic/claude-opus-4',
  CLAUDE_SONNET_4: 'anthropic/claude-sonnet-4',
  CLAUDE_HAIKU_4: 'anthropic/claude-4-haiku',

  // OpenAI Models
  O3_PRO: 'openai/o3-pro',
  GPT_4O: 'openai/o4-mini',
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
  OPENROUTER_MODELS.GPT_4O,
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
  private fallbackChain: string[] = [];
  private initialized = false;
  
  constructor() {
    this.defaultModel = OPENROUTER_MODELS.CLAUDE_SONNET_4;
    // Optimized fallback chain: fast -> capable -> cost-effective
    this.fallbackChain = [
      OPENROUTER_MODELS.CLAUDE_SONNET_4,  // Primary: excellent balance
      OPENROUTER_MODELS.GEMINI_2_5_FLASH, // Fast and reliable
      OPENROUTER_MODELS.O3_PRO,           // High capability
      OPENROUTER_MODELS.DEEPSEEK_R1_0528, // Cost-effective with good performance
      OPENROUTER_MODELS.GROK_3_MINI,      // Lightweight fallback
    ];
  }

  private ensureInitialized() {
    if (!this.initialized) {
      this.setupProviders();
      this.initialized = true;
    }
  }

  private setupProviders() {
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
    const errors: Array<{ provider: string; error: string }> = [];

    // Try primary model first
    try {
      return await this.callModel(model, request);
    } catch (error) {
      errors.push({ provider: model, error: this.extractErrorMessage(error) });
      console.error(`Primary model ${model} failed:`, error);
    }

    // Try fallback chain
    for (const fallbackModel of this.fallbackChain) {
      if (fallbackModel === model) continue; // Skip if same as primary
      
      try {
        console.log(`Trying fallback model: ${fallbackModel}`);
        return await this.callModel(fallbackModel, request);
      } catch (error) {
        errors.push({ provider: fallbackModel, error: this.extractErrorMessage(error) });
        console.error(`Fallback model ${fallbackModel} failed:`, error);
      }
    }

    // All models failed
    throw new Error(`All LLM providers failed. Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  private async callModel(model: string, request: LLMRequest): Promise<LLMResponse> {
    // Find provider that supports this model
    const provider = this.providers.find(p => 
      p.models.some(m => m === model || model.includes(m))
    );

    if (!provider) {
      throw new Error(`No provider found for model: ${model}`);
    }

    // Prepare request based on provider
    const requestBody = this.prepareRequest(provider, model, request);
    
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

      // Extract and validate response
      let content = response.data.choices[0].message.content;
      
      // If schema provided, validate JSON response
      if (request.schema && request.response_format?.type === 'json_object') {
        try {
          // Clean common JSON formatting issues
          content = this.cleanJSONResponse(content);
          let parsed = JSON.parse(content);
          
          // Normalize the response before validation
          parsed = normalizeLLMResponse(parsed);
          
          // Validate against schema
          request.schema.parse(parsed);
          
          // Return the normalized content
          content = JSON.stringify(parsed);
        } catch (error) {
          throw new Error(`Invalid JSON response format: ${error}`);
        }
      }

      return {
        content,
        usage: response.data.usage,
        model: response.data.model || model,
        provider: provider.name,
      };
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
    const baseRequest: any = {
      model,
      messages: request.messages,
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
    this.providers.forEach(provider => {
      provider.models.forEach(model => models.add(model));
    });
    return Array.from(models);
  }

  // Set custom fallback chain
  setFallbackChain(models: string[]) {
    this.fallbackChain = models;
  }

  // Set default model
  setDefaultModel(model: string) {
    this.defaultModel = model;
  }

  // Get all model IDs as a list
  getAllModelIds(): string[] {
    return Object.values(OPENROUTER_MODELS);
  }

  // Check if a model ID is valid
  isValidModel(modelId: string): boolean {
    return Object.values(OPENROUTER_MODELS).includes(modelId);
  }
}

// Singleton instance
export const llmOrchestrator = new LLMOrchestrator();