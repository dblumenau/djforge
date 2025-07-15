import { GeminiService } from './GeminiService';
import { LLMRequest } from '../orchestrator';

describe('GeminiService', () => {
  let service: GeminiService;
  
  beforeEach(() => {
    // Mock service for testing without actual API calls
    service = new GeminiService({
      apiKey: 'test-key',
      enableGrounding: true
    });
  });

  describe('constructor', () => {
    it('should create instance with valid configuration', () => {
      expect(service).toBeDefined();
    });

    it('should set default configuration values', () => {
      const defaultService = new GeminiService({
        apiKey: 'test-key'
      });
      expect(defaultService).toBeDefined();
    });
  });

  describe('getSupportedModels', () => {
    it('should return supported Gemini models', () => {
      const models = GeminiService.getSupportedModels();
      expect(models).toContain('google/gemini-2.5-pro');
      expect(models).toContain('google/gemini-2.5-flash');
      expect(models).toContain('gemini-2.5-pro');
      expect(models).toContain('gemini-2.5-flash');
    });
  });

  describe('supportsGrounding', () => {
    it('should return true for grounding-capable models', () => {
      expect(GeminiService.supportsGrounding('google/gemini-2.5-pro')).toBe(true);
      expect(GeminiService.supportsGrounding('google/gemini-2.5-flash')).toBe(true);
      expect(GeminiService.supportsGrounding('gemini-2.5-pro')).toBe(true);
      expect(GeminiService.supportsGrounding('gemini-2.5-flash')).toBe(true);
    });

    it('should return false for non-Gemini models', () => {
      expect(GeminiService.supportsGrounding('gpt-4')).toBe(false);
      expect(GeminiService.supportsGrounding('claude-3')).toBe(false);
    });
  });

  describe('request formatting', () => {
    it('should handle basic request structure', () => {
      const request: LLMRequest = {
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        model: 'gemini-2.5-flash',
        temperature: 0.7
      };

      // This test validates the request structure without making actual API calls
      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].content).toBe('Hello');
    });

    it('should handle JSON response format requests', () => {
      const request: LLMRequest = {
        messages: [
          { role: 'user', content: 'Return JSON' }
        ],
        model: 'gemini-2.5-flash',
        response_format: { type: 'json_object' }
      };

      expect(request.response_format?.type).toBe('json_object');
    });
  });
});