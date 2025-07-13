import { RedisConversation, ConversationEntry, DialogState } from './redisConversation';

describe('RedisConversation - Integration Scenarios', () => {
  let conversation: RedisConversation;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      lRange: jest.fn(),
      get: jest.fn(),
      setEx: jest.fn(),
      eval: jest.fn(),
      del: jest.fn()
    };
    conversation = new RedisConversation(mockClient);
  });

  describe('End-to-End Context Pollution Prevention', () => {
    it('should prevent the original bug: cross-topic contamination in similarity requests', async () => {
      // Simulate the exact conversation that caused the bug
      const conversationHistory: ConversationEntry[] = [
        {
          command: 'play the weeknd',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'The Weeknd',
            track: 'Blinding Lights',
            confidence: 0.9,
            alternatives: ['The Weeknd - Save Your Tears', 'The Weeknd - Can\'t Feel My Face']
          },
          timestamp: Date.now() - 500000, // 8+ minutes ago
          response: { success: true, message: 'Playing Blinding Lights' }
        },
        {
          command: 'did he ever collaborate with taylor swift or haim',
          interpretation: {
            intent: 'ask_question',
            confidence: 0.8,
            reasoning: 'User asking about collaboration history between The Weeknd and Taylor Swift/Haim'
          },
          timestamp: Date.now() - 400000, // 6+ minutes ago
          response: { success: true, message: 'No major collaborations found on official releases' }
        },
        {
          command: 'play something for assassins creed',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'Jesper Kyd',
            track: 'Ezio\'s Family',
            confidence: 0.9,
            query: 'assassins creed soundtrack',
            alternatives: ['Nobuo Uematsu - One-Winged Angel', 'Koji Kondo - Zelda Theme']
          },
          timestamp: Date.now() - 100000, // 1+ minute ago
          response: { success: true, message: 'Playing Ezio\'s Family' }
        }
      ];

      const dialogState: DialogState = {
        last_action: {
          type: 'play',
          intent: 'play_specific_song',
          artist: 'Jesper Kyd',
          track: 'Ezio\'s Family',
          query: 'assassins creed soundtrack',
          timestamp: Date.now() - 100000,
          alternatives: ['Nobuo Uematsu - One-Winged Angel', 'Koji Kondo - Zelda Theme']
        },
        last_candidates: ['Nobuo Uematsu - One-Winged Angel', 'Koji Kondo - Zelda Theme'],
        interaction_mode: 'music',
        updated_at: Date.now() - 100000
      };

      // The problematic command that caused Gracie Abrams to play
      const problematicCommand = 'queue a playlist with similar stuff';
      
      // Get relevant context using our smart filtering
      const relevantContext = conversation.getRelevantContext(
        problematicCommand,
        conversationHistory,
        dialogState
      );

      // CRITICAL: Should only return the last music action (J-pop/gaming)
      expect(relevantContext).toHaveLength(1);
      expect(relevantContext[0].interpretation.artist).toBe('Jesper Kyd');
      expect(relevantContext[0].interpretation.track).toBe('Ezio\'s Family');
      
      // CRITICAL: Should NOT include The Weeknd context
      expect(relevantContext.some(entry => 
        entry.interpretation.artist === 'The Weeknd'
      )).toBe(false);
      
      // CRITICAL: Should NOT include Taylor Swift collaboration question
      expect(relevantContext.some(entry => 
        entry.interpretation.intent === 'ask_question'
      )).toBe(false);
      
      // CRITICAL: Should NOT include any Taylor Swift references
      expect(relevantContext.some(entry => 
        JSON.stringify(entry).toLowerCase().includes('taylor swift')
      )).toBe(false);

      // This should result in anime/gaming music context only
      const contextString = JSON.stringify(relevantContext);
      expect(contextString).toContain('assassins creed');
      expect(contextString).toContain('Jesper Kyd');
      expect(contextString).not.toContain('Weeknd');
      expect(contextString).not.toContain('taylor');
      expect(contextString).not.toContain('collaborate');
    });

    it('should correctly identify and handle similarity requests', () => {
      // All these should be identified as similarity requests
      const similarityRequests = [
        'queue a playlist with similar stuff',
        'play something similar',
        'more like that',
        'queue similar music',
        'play playlist with similar vibe',
        'same style please',
        'more of the same genre'
      ];

      similarityRequests.forEach(request => {
        expect(conversation.isSimilarityRequest(request)).toBe(true);
      });

      // These should NOT be similarity requests
      const nonSimilarityRequests = [
        'play taylor swift',
        'queue bohemian rhapsody',
        'play the next song',
        'did he collaborate with anyone'
      ];

      nonSimilarityRequests.forEach(request => {
        expect(conversation.isSimilarityRequest(request)).toBe(false);
      });
    });
  });

  describe('Conversational Intent Prevention', () => {
    it('should prevent questions from being treated as music actions', () => {
      // These should all be non-destructive (conversational)
      const conversationalCommands = [
        'did he ever collaborate with taylor swift or haim',
        'tell me about this song',
        'what do you think of the weeknd',
        'has taylor swift released any new albums',
        'who wrote this song',
        'what genre is this'
      ];

      conversationalCommands.forEach(command => {
        // These would get 'ask_question', 'get_info', or 'chat' intents
        expect(conversation.isDestructiveAction('ask_question')).toBe(false);
        expect(conversation.isDestructiveAction('get_info')).toBe(false);
        expect(conversation.isDestructiveAction('chat')).toBe(false);
      });

      // These should be destructive (music actions)  
      const musicCommands = [
        'play taylor swift',
        'queue bohemian rhapsody',
        'play similar music',
        'queue a playlist'
      ];

      musicCommands.forEach(command => {
        // These would get 'play_specific_song' or 'queue_specific_song' intents
        expect(conversation.isDestructiveAction('play_specific_song')).toBe(true);
        expect(conversation.isDestructiveAction('queue_specific_song')).toBe(true);
        expect(conversation.isDestructiveAction('play_playlist')).toBe(true);
        expect(conversation.isDestructiveAction('queue_playlist')).toBe(true);
      });
    });
  });

  describe('Dialog State Workflow', () => {
    it('should handle complete workflow: music action → conversation → music action', () => {
      let dialogState: DialogState = {
        last_action: null,
        last_candidates: [],
        interaction_mode: 'music',
        updated_at: Date.now()
      };

      // Step 1: Play music action
      const playInterpretation = {
        intent: 'play_specific_song',
        artist: 'The Beatles',
        track: 'Hey Jude',
        confidence: 0.9
      };
      const playAlternatives = ['The Beatles - Let It Be', 'The Beatles - Yesterday'];

      dialogState = conversation.updateDialogStateFromAction(
        dialogState,
        playInterpretation,
        playAlternatives
      );

      expect(dialogState.last_action?.type).toBe('play');
      expect(dialogState.last_action?.artist).toBe('The Beatles');
      expect(dialogState.interaction_mode).toBe('music');

      // Step 2: Conversational action (should not overwrite last_action)
      const chatInterpretation = {
        intent: 'ask_question',
        confidence: 0.8,
        reasoning: 'User asking about the band'
      };

      dialogState = conversation.updateDialogStateFromAction(
        dialogState,
        chatInterpretation,
        []
      );

      expect(dialogState.last_action?.artist).toBe('The Beatles'); // Should still be there
      expect(dialogState.interaction_mode).toBe('chat'); // Mode changed

      // Step 3: Another music action (should update last_action)
      const queueInterpretation = {
        intent: 'queue_specific_song',
        artist: 'Queen',
        track: 'Bohemian Rhapsody',
        confidence: 0.9
      };

      dialogState = conversation.updateDialogStateFromAction(
        dialogState,
        queueInterpretation,
        []
      );

      expect(dialogState.last_action?.type).toBe('queue');
      expect(dialogState.last_action?.artist).toBe('Queen');
      expect(dialogState.interaction_mode).toBe('music');
    });

    it('should provide time-boxed context for general music requests', () => {
      const longHistory: ConversationEntry[] = [
        // Very old entry - should be filtered out
        {
          command: 'play classical music',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'Mozart',
            track: 'Symphony No. 40',
            confidence: 0.9
          },
          timestamp: Date.now() - 900000 // 15 minutes ago
        },
        // Recent chat - should be filtered out
        {
          command: 'tell me about mozart',
          interpretation: {
            intent: 'get_info',
            confidence: 0.8
          },
          timestamp: Date.now() - 200000 // 3 minutes ago
        },
        // Recent music - should be included
        {
          command: 'play rock music',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'Queen',
            track: 'Bohemian Rhapsody',
            confidence: 0.9
          },
          timestamp: Date.now() - 100000 // 1 minute ago
        }
      ];

      const dialogState: DialogState = {
        last_action: {
          type: 'play',
          intent: 'play_specific_song',
          artist: 'Queen',
          track: 'Bohemian Rhapsody',
          timestamp: Date.now() - 100000
        },
        last_candidates: [],
        interaction_mode: 'music',
        updated_at: Date.now() - 100000
      };

      const relevantContext = conversation.getRelevantContext(
        'play something else',
        longHistory,
        dialogState
      );

      // Should only include recent music actions, not chat or very old entries
      expect(relevantContext.length).toBeLessThanOrEqual(2);
      expect(relevantContext.every(entry => 
        ['play_specific_song', 'queue_specific_song', 'play_playlist', 'queue_playlist'].includes(entry.interpretation.intent)
      )).toBe(true);
      
      // Should include Queen but not Mozart (too old) or chat entries
      expect(relevantContext.some(entry => entry.interpretation.artist === 'Queen')).toBe(true);
      expect(relevantContext.some(entry => entry.interpretation.artist === 'Mozart')).toBe(false);
      expect(relevantContext.some(entry => entry.interpretation.intent === 'get_info')).toBe(false);
    });
  });

  describe('Contextual Reference Resolution', () => {
    it('should resolve "the taylor swift one" correctly from gasoline alternatives', () => {
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
            'Seether - Gasoline',
            'Audioslave - Gasoline'
          ]
        },
        timestamp: Date.now() - 100000
      }];

      const result = conversation.resolveContextualReference(
        'no the taylor swift one',
        gaslineHistory
      );

      expect(result).not.toBeNull();
      expect(result?.artist).toBe('Haim');
      expect(result?.track).toBe('Gasoline (ft. Taylor Swift)');
      expect(result?.confidence).toBe(0.9);
    });

    it('should handle contextual references in filtered context', () => {
      const mixedHistory: ConversationEntry[] = [
        {
          command: 'play gasoline',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'The Weeknd',
            track: 'Gasoline',
            confidence: 0.9,
            alternatives: [
              'Halsey - Gasoline',
              'Haim - Gasoline (ft. Taylor Swift)'
            ]
          },
          timestamp: Date.now() - 200000
        },
        {
          command: 'did taylor swift collaborate with anyone',
          interpretation: {
            intent: 'ask_question',
            confidence: 0.8
          },
          timestamp: Date.now() - 100000
        }
      ];

      const dialogState: DialogState = {
        last_action: {
          type: 'play',
          intent: 'play_specific_song',
          artist: 'The Weeknd',
          track: 'Gasoline',
          timestamp: Date.now() - 200000
        },
        last_candidates: [],
        interaction_mode: 'music',
        updated_at: Date.now() - 200000
      };

      // Contextual reference should find alternatives
      const relevantContext = conversation.getRelevantContext(
        'no the taylor swift one',
        mixedHistory,
        dialogState
      );

      expect(relevantContext).toHaveLength(1);
      expect(relevantContext[0].interpretation.alternatives).toContain('Haim - Gasoline (ft. Taylor Swift)');
    });
  });

  describe('Redis Operations Mock Integration', () => {
    it('should handle Redis storage and retrieval simulation', async () => {
      const sessionId = 'test_session_123';
      const testEntry: ConversationEntry = {
        command: 'play test song',
        interpretation: {
          intent: 'play_specific_song',
          artist: 'Test Artist',
          track: 'Test Song',
          confidence: 0.9
        },
        timestamp: Date.now()
      };

      // Simulate appending entry
      mockClient.eval.mockResolvedValue(1);
      await conversation.append(sessionId, testEntry);

      expect(mockClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('LPUSH'),
        expect.objectContaining({
          keys: ['djforge:conv:test_session_123'],
          arguments: [
            expect.stringContaining('Test Artist'),
            '7', // maxEntries - 1
            '1800' // TTL
          ]
        })
      );

      // Simulate retrieving history
      mockClient.lRange.mockResolvedValue([JSON.stringify(testEntry)]);
      const history = await conversation.getHistory(sessionId, 3);

      expect(history).toHaveLength(1);
      expect(history[0].interpretation.artist).toBe('Test Artist');
      expect(mockClient.lRange).toHaveBeenCalledWith('djforge:conv:test_session_123', 0, 2);

      // Simulate dialog state operations
      const testState: DialogState = {
        last_action: {
          type: 'play',
          intent: 'play_specific_song',
          artist: 'Test Artist',
          track: 'Test Song',
          timestamp: Date.now()
        },
        last_candidates: [],
        interaction_mode: 'music',
        updated_at: Date.now()
      };

      mockClient.setEx.mockResolvedValue('OK');
      await conversation.updateDialogState(sessionId, testState);

      expect(mockClient.setEx).toHaveBeenCalledWith(
        'djforge:state:test_session_123',
        1800,
        expect.stringContaining('Test Artist')
      );

      mockClient.get.mockResolvedValue(JSON.stringify(testState));
      const retrievedState = await conversation.getDialogState(sessionId);

      expect(retrievedState.last_action?.artist).toBe('Test Artist');
      expect(retrievedState.interaction_mode).toBe('music');
    });
  });
});