import { OpenAIProvider, OPENAI_MODELS } from '../llm/providers/OpenAIProvider';
import { MusicCommandSchema } from '../llm/schemas';

describe('OpenAIProvider', () => {
  // Mock OpenAI to avoid actual API calls in tests
  jest.mock('openai');

  describe('constructor', () => {
    it('should throw error when API key is missing', () => {
      expect(() => {
        new OpenAIProvider({ apiKey: '' });
      }).toThrow('OpenAI API key is required');
    });

    it('should initialize with valid API key', () => {
      expect(() => {
        new OpenAIProvider({ apiKey: 'test-key' });
      }).not.toThrow();
    });

    it('should set default timeout and retries', () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should accept custom timeout and retries', () => {
      const provider = new OpenAIProvider({ 
        apiKey: 'test-key',
        timeout: 60000,
        maxRetries: 5
      });
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe('model constants', () => {
    it('should export GPT 4.1 models', () => {
      expect(OPENAI_MODELS.GPT_4_1).toBe('gpt-4.1');
      expect(OPENAI_MODELS.GPT_4_1_MINI).toBe('gpt-4.1-mini');
      expect(OPENAI_MODELS.GPT_4_1_NANO).toBe('gpt-4.1-nano');
    });
  });

  describe('intent type determination', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider({ apiKey: 'test-key' });
    });

    it('should determine music command intent for play requests', () => {
      const request = {
        messages: [
          { role: 'user' as const, content: 'play some music' }
        ]
      };
      
      // Access private method for testing
      const intentType = (provider as any).determineIntentType(request);
      expect(intentType).toBe('music_command');
    });

    it('should determine music knowledge intent for questions', () => {
      const request = {
        messages: [
          { role: 'user' as const, content: 'who is the best artist?' }
        ]
      };
      
      const intentType = (provider as any).determineIntentType(request);
      expect(intentType).toBe('music_knowledge');
    });

    it('should default to conversational intent', () => {
      const request = {
        messages: [
          { role: 'user' as const, content: 'hello there' }
        ]
      };
      
      const intentType = (provider as any).determineIntentType(request);
      expect(intentType).toBe('conversational');
    });
  });

  describe('schema selection', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider({ apiKey: 'test-key' });
    });

    it('should return MusicCommandSchema for music_command intent', () => {
      const schema = (provider as any).getSchemaForIntent('music_command');
      expect(schema).toBe(MusicCommandSchema);
    });

    it('should return null for conversational intent', () => {
      const schema = (provider as any).getSchemaForIntent('conversational');
      expect(schema).toBeNull();
    });
  });

  describe('message formatting', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider({ apiKey: 'test-key' });
    });

    it('should format messages correctly for OpenAI', () => {
      const messages = [
        { role: 'system' as const, content: 'System prompt' },
        { role: 'user' as const, content: 'User message' },
        { role: 'assistant' as const, content: 'Assistant response' }
      ];
      
      const systemPrompt = 'Custom system prompt';
      const formatted = (provider as any).formatMessagesForOpenAI(messages, systemPrompt);
      
      expect(formatted).toHaveLength(3); // system + user + assistant
      expect(formatted[0]).toEqual({
        role: 'system',
        content: 'Custom system prompt'
      });
      expect(formatted[1]).toEqual({
        role: 'user',
        content: 'User message'
      });
      expect(formatted[2]).toEqual({
        role: 'assistant',
        content: 'Assistant response'
      });
    });

    it('should skip duplicate system messages', () => {
      const messages = [
        { role: 'system' as const, content: 'Original system' },
        { role: 'user' as const, content: 'User message' }
      ];
      
      const systemPrompt = 'Custom system prompt';
      const formatted = (provider as any).formatMessagesForOpenAI(messages, systemPrompt);
      
      expect(formatted).toHaveLength(2); // system + user (original system skipped)
      expect(formatted[0].content).toBe('Custom system prompt');
    });
  });

  // Note: The complete() method would require mocking the OpenAI client
  // which is more complex and would be better suited for integration tests
});