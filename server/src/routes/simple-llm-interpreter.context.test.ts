import request from 'supertest';
import { RedisConversation, ConversationEntry, DialogState } from '../utils/redisConversation';

// Mock the LLM orchestrator to return predictable responses
jest.mock('../llm/orchestrator', () => ({
  llmOrchestrator: {
    complete: jest.fn(),
    getAvailableModels: jest.fn(() => ['claude-sonnet-4'])
  },
  OPENROUTER_MODELS: {
    CLAUDE_SONNET_4: 'claude-sonnet-4',
    GEMINI_2_5_FLASH: 'gemini-flash',
    O3_PRO: 'o3-pro'
  }
}));

// Mock Spotify control
jest.mock('../spotify/control', () => ({
  SpotifyControl: jest.fn().mockImplementation(() => ({
    search: jest.fn(),
    playTrack: jest.fn(),
    queueTrackByUri: jest.fn(),
    searchAndPlayPlaylist: jest.fn(),
    searchAndQueuePlaylist: jest.fn()
  }))
}));

// Mock auth middleware
jest.mock('../spotify/auth', () => ({
  ensureValidToken: (req: any, res: any, next: any) => next()
}));

import { llmOrchestrator } from '../llm/orchestrator';

describe('LLM Interpreter - Context Integration Tests', () => {
  let app: any;
  let mockRedisClient: any;
  let conversationManager: RedisConversation;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock Redis client
    mockRedisClient = {
      lRange: jest.fn(),
      get: jest.fn(),
      setEx: jest.fn(),
      eval: jest.fn(),
      del: jest.fn()
    };

    // Create conversation manager
    conversationManager = new RedisConversation(mockRedisClient);

    // Mock the session and tokens
    const mockSession = {
      spotifyTokens: { access_token: 'mock_token' },
      sessionID: 'test_session_123'
    };

    // Setup Express app with mocked dependencies
    const express = require('express');
    app = express();
    app.use(express.json());
    app.use((req: any, res: any, next: any) => {
      req.session = mockSession;
      req.sessionID = mockSession.sessionID;
      next();
    });

    // Import and setup router after mocking
    const { simpleLLMInterpreterRouter, setRedisClient } = require('./simple-llm-interpreter');
    setRedisClient(mockRedisClient);
    app.use('/api/claude', simpleLLMInterpreterRouter);
  });

  describe('Context Pollution Prevention', () => {
    it('should prevent cross-topic contamination in similarity requests', async () => {
      // Setup conversation history that caused the original bug
      const conversationHistory: ConversationEntry[] = [
        {
          command: 'play the weeknd',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'The Weeknd',
            track: 'Blinding Lights',
            confidence: 0.9
          },
          timestamp: Date.now() - 500000
        },
        {
          command: 'did he ever collaborate with taylor swift or haim',
          interpretation: {
            intent: 'ask_question',
            confidence: 0.8,
            reasoning: 'User asking about collaborations'
          },
          timestamp: Date.now() - 400000
        },
        {
          command: 'play something for assassins creed',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'Jesper Kyd',
            track: 'Ezio\'s Family',
            confidence: 0.9
          },
          timestamp: Date.now() - 100000
        }
      ];

      const dialogState: DialogState = {
        last_action: {
          type: 'play',
          intent: 'play_specific_song',
          artist: 'Jesper Kyd',
          track: 'Ezio\'s Family',
          timestamp: Date.now() - 100000
        },
        last_candidates: [],
        interaction_mode: 'music',
        updated_at: Date.now() - 100000
      };

      // Mock Redis responses
      mockRedisClient.lRange.mockResolvedValue(
        conversationHistory.map(entry => JSON.stringify(entry))
      );
      mockRedisClient.get.mockResolvedValue(JSON.stringify(dialogState));

      // Mock LLM response for similarity request
      (llmOrchestrator.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'queue_playlist',
          query: 'anime gaming soundtrack instrumental',
          confidence: 0.8,
          reasoning: 'User wants similar music to the Assassin\'s Creed soundtrack'
        })
      });

      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'queue a playlist with similar stuff' });

      expect(response.status).toBe(200);

      // Verify the LLM was called with only the J-pop context, not The Weeknd or Taylor Swift
      const llmCall = (llmOrchestrator.complete as jest.Mock).mock.calls[0];
      const prompt = llmCall[0].messages[1].content;

      // Should include Assassin's Creed context
      expect(prompt).toContain('Jesper Kyd');
      expect(prompt).toContain('Ezio\'s Family');

      // Should NOT include The Weeknd or Taylor Swift contamination
      expect(prompt).not.toContain('The Weeknd');
      expect(prompt).not.toContain('Blinding Lights');
      expect(prompt).not.toContain('taylor swift');
      expect(prompt).not.toContain('collaborate');
    });
  });

  describe('Conversational vs Action Intent Handling', () => {
    it('should handle questions without triggering Spotify actions', async () => {
      // Mock empty conversation history
      mockRedisClient.lRange.mockResolvedValue([]);
      mockRedisClient.get.mockResolvedValue(null);

      // Mock LLM response for conversational intent
      (llmOrchestrator.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'ask_question',
          confidence: 0.9,
          reasoning: 'User is asking about The Weeknd\'s collaboration history with Taylor Swift and Haim. No collaborations found on major releases.'
        })
      });

      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'did he ever collaborate with taylor swift or haim' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.conversational).toBe(true);
      expect(response.body.message).toContain('collaboration');

      // Verify no Spotify methods were called
      const SpotifyControl = require('../spotify/control').SpotifyControl;
      const mockSpotifyInstance = SpotifyControl.mock.instances[0];
      expect(mockSpotifyInstance?.search).not.toHaveBeenCalled();
      expect(mockSpotifyInstance?.playTrack).not.toHaveBeenCalled();
      expect(mockSpotifyInstance?.queueTrackByUri).not.toHaveBeenCalled();
    });

    it('should handle info requests without playing music', async () => {
      mockRedisClient.lRange.mockResolvedValue([]);
      mockRedisClient.get.mockResolvedValue(null);

      (llmOrchestrator.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'ask_question',
          confidence: 0.9,
          reasoning: 'User wants information about the current or a specific song, not to play music.'
        })
      });

      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'tell me about this song' });

      expect(response.status).toBe(200);
      expect(response.body.conversational).toBe(true);
      expect(response.body.success).toBe(true);
    });

    it('should handle chat requests without music actions', async () => {
      mockRedisClient.lRange.mockResolvedValue([]);
      mockRedisClient.get.mockResolvedValue(null);

      (llmOrchestrator.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'chat',
          confidence: 0.8,
          reasoning: 'User wants to discuss music preferences, not play music.'
        })
      });

      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'what do you think of the weeknd' });

      expect(response.status).toBe(200);
      expect(response.body.conversational).toBe(true);
    });
  });

  describe('Confidence-Based Confirmation', () => {
    it('should request confirmation for low-confidence destructive actions', async () => {
      mockRedisClient.lRange.mockResolvedValue([]);
      mockRedisClient.get.mockResolvedValue(null);

      // Mock low-confidence destructive action
      (llmOrchestrator.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'play_specific_song',
          artist: 'Unknown Artist',
          track: 'Ambiguous Song',
          confidence: 0.5, // Below 0.7 threshold
          reasoning: 'Uncertain about this request'
        })
      });

      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'play that weird song' });

      expect(response.status).toBe(200);
      expect(response.body.confirmation_needed).toBe(true);
      expect(response.body.message).toContain('Are you asking me to');
      expect(response.body.message).toContain('50%');
      expect(response.body.pending_action).toBeDefined();
    });

    it('should not request confirmation for high-confidence actions', async () => {
      mockRedisClient.lRange.mockResolvedValue([]);
      mockRedisClient.get.mockResolvedValue(null);

      (llmOrchestrator.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'play_specific_song',
          artist: 'Taylor Swift',
          track: 'Anti-Hero',
          confidence: 0.9, // Above 0.7 threshold
          reasoning: 'Clear request for Taylor Swift song'
        })
      });

      // Mock Spotify search and play
      const SpotifyControl = require('../spotify/control').SpotifyControl;
      const mockSpotifyInstance = {
        search: jest.fn().mockResolvedValue([{
          name: 'Anti-Hero',
          artists: [{ name: 'Taylor Swift' }],
          uri: 'spotify:track:123',
          popularity: 95
        }]),
        playTrack: jest.fn().mockResolvedValue({ success: true })
      };
      SpotifyControl.mockImplementation(() => mockSpotifyInstance);

      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'play anti-hero by taylor swift' });

      expect(response.status).toBe(200);
      expect(response.body.confirmation_needed).toBeUndefined();
      expect(response.body.success).toBe(true);
    });

    it('should not request confirmation for non-destructive actions regardless of confidence', async () => {
      mockRedisClient.lRange.mockResolvedValue([]);
      mockRedisClient.get.mockResolvedValue(null);

      (llmOrchestrator.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'ask_question',
          confidence: 0.3, // Very low confidence
          reasoning: 'Not sure what user is asking'
        })
      });

      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'some unclear question' });

      expect(response.status).toBe(200);
      expect(response.body.confirmation_needed).toBeUndefined();
      expect(response.body.conversational).toBe(true);
    });
  });

  describe('Dialog State Integration', () => {
    it('should update dialog state after successful music actions', async () => {
      mockRedisClient.lRange.mockResolvedValue([]);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.eval.mockResolvedValue(1); // For conversation append

      (llmOrchestrator.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'play_specific_song',
          artist: 'The Beatles',
          track: 'Hey Jude',
          confidence: 0.9,
          alternatives: ['The Beatles - Let It Be', 'The Beatles - Yesterday']
        })
      });

      // Mock Spotify
      const SpotifyControl = require('../spotify/control').SpotifyControl;
      const mockSpotifyInstance = {
        search: jest.fn().mockResolvedValue([{
          name: 'Hey Jude',
          artists: [{ name: 'The Beatles' }],
          uri: 'spotify:track:456',
          popularity: 90
        }]),
        playTrack: jest.fn().mockResolvedValue({ success: true })
      };
      SpotifyControl.mockImplementation(() => mockSpotifyInstance);

      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'play hey jude' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify dialog state was updated
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'djforge:state:test_session_123',
        1800,
        expect.stringContaining('"type":"play"')
      );

      const savedState = JSON.parse(mockRedisClient.setEx.mock.calls[0][2]);
      expect(savedState.last_action.type).toBe('play');
      expect(savedState.last_action.artist).toBe('The Beatles');
      expect(savedState.last_action.track).toBe('Hey Jude');
      expect(savedState.interaction_mode).toBe('music');
    });

    it('should update interaction mode for conversational intents', async () => {
      mockRedisClient.lRange.mockResolvedValue([]);
      mockRedisClient.get.mockResolvedValue(null);

      (llmOrchestrator.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'chat',
          confidence: 0.8,
          reasoning: 'User wants to discuss music'
        })
      });

      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'what do you think about jazz' });

      expect(response.status).toBe(200);

      // Verify dialog state shows chat mode
      const savedState = JSON.parse(mockRedisClient.setEx.mock.calls[0][2]);
      expect(savedState.interaction_mode).toBe('chat');
      expect(savedState.last_action).toBeNull(); // Should not update last_action for chat
    });
  });

  describe('Regression Tests', () => {
    it('should handle the original gasoline → taylor swift scenario correctly', async () => {
      // Setup: User previously asked about gasoline, got alternatives
      const gaslineHistory: ConversationEntry[] = [{
        command: 'play gasoline',
        interpretation: {
          intent: 'play_specific_song',
          artist: 'The Weeknd',
          track: 'Gasoline',
          confidence: 0.9,
          alternatives: [
            'Halsey - Gasoline',
            'Haim - Gasoline (ft. Taylor Swift)',
            'Seether - Gasoline'
          ]
        },
        timestamp: Date.now() - 100000
      }];

      mockRedisClient.lRange.mockResolvedValue(
        gaslineHistory.map(entry => JSON.stringify(entry))
      );
      mockRedisClient.get.mockResolvedValue(null);

      // Mock LLM response for contextual reference resolution
      (llmOrchestrator.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'play_specific_song',
          artist: 'Haim',
          track: 'Gasoline (ft. Taylor Swift)',
          confidence: 0.9,
          reasoning: 'Resolved from previous context: Haim - Gasoline (ft. Taylor Swift)'
        })
      });

      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'no the taylor swift one' });

      expect(response.status).toBe(200);
      expect(response.body.interpretation.artist).toBe('Haim');
      expect(response.body.interpretation.track).toBe('Gasoline (ft. Taylor Swift)');
    });

    it('should prevent the Gracie Abrams bug scenario', async () => {
      // This tests the exact scenario that caused the bug:
      // 1. The Weeknd context
      // 2. Taylor Swift collaboration question
      // 3. J-pop for Assassin's Creed  
      // 4. "queue a playlist with similar stuff" should only get J-pop context

      const bugScenario: ConversationEntry[] = [
        {
          command: 'play the weeknd',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'The Weeknd',
            track: 'Blinding Lights',
            confidence: 0.9
          },
          timestamp: Date.now() - 500000
        },
        {
          command: 'did he ever collaborate with taylor swift or haim',
          interpretation: {
            intent: 'ask_question',
            confidence: 0.8
          },
          timestamp: Date.now() - 400000
        },
        {
          command: 'play something for assassins creed',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'Jesper Kyd',
            track: 'Ezio\'s Family',
            confidence: 0.9
          },
          timestamp: Date.now() - 100000
        }
      ];

      const dialogState: DialogState = {
        last_action: {
          type: 'play',
          intent: 'play_specific_song',
          artist: 'Jesper Kyd',
          track: 'Ezio\'s Family',
          timestamp: Date.now() - 100000
        },
        last_candidates: [],
        interaction_mode: 'music',
        updated_at: Date.now() - 100000
      };

      mockRedisClient.lRange.mockResolvedValue(
        bugScenario.map(entry => JSON.stringify(entry))
      );
      mockRedisClient.get.mockResolvedValue(JSON.stringify(dialogState));

      (llmOrchestrator.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'queue_playlist',
          query: 'video game soundtrack anime instrumental epic',
          confidence: 0.8,
          reasoning: 'User wants similar music to Assassin\'s Creed soundtrack'
        })
      });

      const response = await request(app)
        .post('/api/claude/command')
        .send({ command: 'queue a playlist with similar stuff' });

      expect(response.status).toBe(200);

      // Verify the context sent to LLM only included the J-pop action
      const llmCall = (llmOrchestrator.complete as jest.Mock).mock.calls[0];
      const prompt = llmCall[0].messages[1].content;

      expect(prompt).toContain('Jesper Kyd');
      expect(prompt).not.toContain('The Weeknd');
      expect(prompt).not.toContain('taylor swift');
      
      // Should result in gaming/anime playlist, not Gracie Abrams
      expect(response.body.interpretation.query).toContain('video game');
    });
  });
});