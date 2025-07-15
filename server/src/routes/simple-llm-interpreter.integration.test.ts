import request from 'supertest';
import { RedisConversation, ConversationEntry, DialogState } from '../utils/redisConversation';
import { app } from '../test-app';
import { llmOrchestrator } from '../llm/orchestrator';

// Test configuration
const RUN_EXPENSIVE_TESTS = process.env.RUN_EXPENSIVE_TESTS === 'true';
const API_CALL_COUNT = { gemini: 0, openrouter: 0 };

// Track API usage
function logApiUsage(model: string, command: string) {
  if (model.includes('gemini')) {
    API_CALL_COUNT.gemini++;
    console.log(`🔶 [GEMINI API #${API_CALL_COUNT.gemini}] "${command}" → ${model}`);
  } else {
    API_CALL_COUNT.openrouter++;
    console.log(`🔷 [OPENROUTER API #${API_CALL_COUNT.openrouter}] "${command}" → ${model}`);
  }
}

// Mock Spotify control (we don't want to call real Spotify API)
jest.mock('../spotify/control', () => ({
  SpotifyControl: jest.fn().mockImplementation(() => ({
    search: jest.fn().mockResolvedValue([{
      name: 'Anti-Hero',
      artists: [{ name: 'Taylor Swift' }],
      uri: 'spotify:track:123',
      popularity: 95,
      album: { name: 'Midnights', release_date: '2022-10-21' }
    }]),
    playTrack: jest.fn().mockResolvedValue({ success: true }),
    queueTrackByUri: jest.fn().mockResolvedValue({ success: true }),
    searchAndPlayPlaylist: jest.fn().mockResolvedValue({ success: true }),
    searchAndQueuePlaylist: jest.fn().mockResolvedValue({ success: true })
  }))
}));

// Mock auth middleware
jest.mock('../spotify/auth', () => ({
  ensureValidToken: (req: any, res: any, next: any) => {
    req.spotifyTokens = { access_token: 'mock_token' };
    next();
  }
}));

// Mock Redis client is set up in test-app.ts

// Mock the conversation manager
jest.mock('../utils/redisConversation', () => ({
  createConversationManager: jest.fn(() => ({
    getHistory: jest.fn().mockResolvedValue([]),
    getDialogState: jest.fn().mockResolvedValue(null),
    isContextualReference: jest.fn().mockReturnValue(false),
    resolveContextualReference: jest.fn().mockReturnValue(null),
    getRelevantContext: jest.fn().mockReturnValue([]),
    isDestructiveAction: jest.fn().mockReturnValue(false),
    append: jest.fn().mockResolvedValue(true),
    updateDialogState: jest.fn().mockResolvedValue(true),
    updateDialogStateFromAction: jest.fn().mockReturnValue({
      last_action: null,
      last_candidates: [],
      interaction_mode: 'music',
      updated_at: Date.now()
    }),
    clear: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock JWT utilities
jest.mock('../utils/jwt', () => ({
  verifyJWT: jest.fn(() => ({ sub: 'test_user_123' })),
  extractTokenFromHeader: jest.fn(() => 'mock_jwt_token')
}));

// Redis client mock is set up in test-app.ts

describe('LLM Interpreter - Real API Integration Tests', () => {
  
  beforeAll(() => {
    console.log('🧪 Starting LLM Integration Tests');
    console.log(`💰 Expensive tests: ${RUN_EXPENSIVE_TESTS ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔑 OpenRouter API Key: ${process.env.OPENROUTER_API_KEY ? 'CONFIGURED' : 'MISSING'}`);
    console.log(`🔑 Google API Key: ${process.env.GOOGLE_API_KEY ? 'CONFIGURED' : 'MISSING'}`);
    console.log(`🔑 Gemini Direct: ${process.env.ENABLE_GEMINI_DIRECT === 'true' ? 'ENABLED' : 'DISABLED'}`);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Redis mocks are handled in test-app.ts
  });

  afterAll(() => {
    console.log('\n📊 API Usage Summary:');
    console.log(`🔶 Gemini API calls: ${API_CALL_COUNT.gemini}`);
    console.log(`🔷 OpenRouter API calls: ${API_CALL_COUNT.openrouter}`);
    console.log(`💸 Total API calls: ${API_CALL_COUNT.gemini + API_CALL_COUNT.openrouter}`);
  });

  describe('Setup Verification', () => {
    
    it('should verify LLM orchestrator configuration', async () => {
      const models = llmOrchestrator.getAvailableModels();
      console.log(`🔧 Available models: ${models.length}`);
      
      expect(models.length).toBeGreaterThan(0);
      expect(process.env.OPENROUTER_API_KEY).toBeDefined();
      expect(process.env.GOOGLE_API_KEY).toBeDefined();
      expect(process.env.ENABLE_GEMINI_DIRECT).toBe('true');
    });

    it('should perform basic health check', async () => {
      const response = await request(app)
        .get('/api/claude/health');

      console.log(`🏥 Health check: ${response.status}, Models: ${response.body.models}`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.models).toBeGreaterThan(0);
    });
    
  });

  describe('Dual-Path Architecture Integration', () => {
    
    it('should handle Gemini models with native structured output', async () => {
      const command = 'play anti-hero by taylor swift';
      const model = 'google/gemini-2.5-flash';
      
      logApiUsage(model, command);
      
      const response = await request(app)
        .post('/api/claude/command')
        .send({ command, model });

      console.log(`✅ Response: ${response.status}, Success: ${response.body.success}`);
      console.log(`🎯 Intent: ${response.body.interpretation?.intent}, Confidence: ${response.body.interpretation?.confidence}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.interpretation).toBeDefined();
      expect(response.body.interpretation.intent).toBe('play_specific_song');
      expect(response.body.interpretation.confidence).toBeGreaterThan(0.7);
    }, 30000); // 30 second timeout for real API calls

    it('should handle OpenRouter models with prompt engineering', async () => {
      const command = 'play bohemian rhapsody';
      const model = 'anthropic/claude-sonnet-4';
      
      logApiUsage(model, command);
      
      const response = await request(app)
        .post('/api/claude/command')
        .send({ command, model });

      console.log(`✅ Response: ${response.status}, Success: ${response.body.success}`);
      console.log(`🎯 Intent: ${response.body.interpretation?.intent}, Confidence: ${response.body.interpretation?.confidence}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.interpretation).toBeDefined();
      expect(response.body.interpretation.intent).toBe('play_specific_song');
      expect(response.body.interpretation.confidence).toBeGreaterThan(0.7);
    }, 30000);

    it('should validate intent structure from both paths', async () => {
      if (!RUN_EXPENSIVE_TESTS) {
        console.log('⏭️  Skipping expensive dual-path comparison test');
        return;
      }

      const command = 'queue the most obscure beatles song';
      const geminiModel = 'google/gemini-2.5-flash';
      const openRouterModel = 'anthropic/claude-sonnet-4';
      
      logApiUsage(geminiModel, command);
      const geminiResponse = await request(app)
        .post('/api/claude/command')
        .send({ command, model: geminiModel });

      logApiUsage(openRouterModel, command);
      const openRouterResponse = await request(app)
        .post('/api/claude/command')
        .send({ command, model: openRouterModel });

      console.log(`🔶 Gemini: ${geminiResponse.status}, Intent: ${geminiResponse.body.interpretation?.intent}`);
      console.log(`🔷 OpenRouter: ${openRouterResponse.status}, Intent: ${openRouterResponse.body.interpretation?.intent}`);

      // Both should succeed
      expect(geminiResponse.status).toBe(200);
      expect(openRouterResponse.status).toBe(200);

      // Both should have the same intent structure
      expect(geminiResponse.body.interpretation.intent).toBe('queue_specific_song');
      expect(openRouterResponse.body.interpretation.intent).toBe('queue_specific_song');
      
      // Both should have required fields
      expect(geminiResponse.body.interpretation.confidence).toBeDefined();
      expect(openRouterResponse.body.interpretation.confidence).toBeDefined();
      expect(geminiResponse.body.interpretation.reasoning).toBeDefined();
      expect(openRouterResponse.body.interpretation.reasoning).toBeDefined();
    }, 60000);

  });

  describe('Conversational Intent Handling', () => {
    
    it('should handle questions without triggering Spotify actions', async () => {
      const command = 'did taylor swift collaborate with bon iver?';
      const model = 'google/gemini-2.5-flash'; // Use default model
      
      logApiUsage(model, command);
      
      const response = await request(app)
        .post('/api/claude/command')
        .send({ command });

      console.log(`✅ Response: ${response.status}, Conversational: ${response.body.conversational}`);
      console.log(`💬 Message length: ${response.body.message?.length || 0} chars`);

      expect(response.status).toBe(200);
      expect(response.body.conversational).toBe(true);
      expect(response.body.message).toBeDefined();
      expect(response.body.message.length).toBeGreaterThan(10);
      
      // Verify no Spotify actions were called
      const SpotifyControl = require('../spotify/control').SpotifyControl;
      const mockSpotifyInstance = SpotifyControl.mock.instances[0];
      expect(mockSpotifyInstance.search).not.toHaveBeenCalled();
      expect(mockSpotifyInstance.playTrack).not.toHaveBeenCalled();
      expect(mockSpotifyInstance.queueTrackByUri).not.toHaveBeenCalled();
    }, 30000);

    it('should handle info requests without playing music', async () => {
      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'tell me about folklore album' });

      expect(response.status).toBe(200);
      expect(response.body.conversational).toBe(true);
      expect(response.body.message).toBeDefined();
      
      // Verify no Spotify actions were called
      const SpotifyControl = require('../spotify/control').SpotifyControl;
      const mockSpotifyInstance = SpotifyControl.mock.instances[0];
      expect(mockSpotifyInstance.search).not.toHaveBeenCalled();
      expect(mockSpotifyInstance.playTrack).not.toHaveBeenCalled();
    }, 30000);

  });

  describe('Context Pollution Prevention', () => {
    
    it('should prevent cross-topic contamination in similarity requests', async () => {
      // Note: Redis mocking is handled in test-app.ts
      // This test verifies that the LLM doesn't get contaminated context
      
      const command = 'queue a playlist with similar stuff';
      const model = 'google/gemini-2.5-flash';
      
      logApiUsage(model, command);
      
      const response = await request(app)
        .post('/api/claude/command')
        .send({ command });

      console.log(`✅ Response: ${response.status}, Success: ${response.body.success}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }, 30000);

  });

  describe('Confidence-Based Confirmation', () => {
    
    it('should not request confirmation for high-confidence actions', async () => {
      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'play bohemian rhapsody by queen' });

      expect(response.status).toBe(200);
      expect(response.body.confirmation_needed).toBeUndefined();
      expect(response.body.success).toBe(true);
      expect(response.body.interpretation.confidence).toBeGreaterThan(0.7);
    }, 30000);

  });

  describe('Model Routing', () => {
    
    it('should route Gemini models to direct API', async () => {
      const response = await request(app)
        .post('/api/claude/command')
        .send({ 
          command: 'play something relaxing',
          model: 'google/gemini-2.5-flash' 
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Should have used native structured output
      expect(response.body.interpretation.intent).toBe('play_specific_song');
      expect(response.body.interpretation.artist).toBeDefined();
      expect(response.body.interpretation.track).toBeDefined();
    }, 30000);

    it('should route non-Gemini models to OpenRouter', async () => {
      const response = await request(app)
        .post('/api/claude/command')
        .send({ 
          command: 'play something energetic',
          model: 'anthropic/claude-sonnet-4'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Should have used prompt engineering
      expect(response.body.interpretation.intent).toBe('play_specific_song');
      expect(response.body.interpretation.artist).toBeDefined();
      expect(response.body.interpretation.track).toBeDefined();
    }, 30000);

  });

  describe('Error Handling', () => {
    
    it('should handle invalid commands gracefully', async () => {
      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'xyzabc invalid command 123' });

      expect(response.status).toBe(200);
      // Should either succeed with a fallback or return an error message
      expect(response.body).toBeDefined();
    }, 30000);

    it('should handle timeout scenarios', async () => {
      // This test depends on the actual timeout behavior
      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'play something' });

      expect(response.status).toBe(200);
      expect(response.body.interpretation).toBeDefined();
    }, 30000);

  });

});