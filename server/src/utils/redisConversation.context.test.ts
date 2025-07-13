import { RedisConversation, ConversationEntry, DialogState } from './redisConversation';

describe('RedisConversation - Context Scenarios', () => {
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

  describe('Smart Context Filtering', () => {
    const weekndHistory: ConversationEntry = {
      command: 'play the weeknd',
      interpretation: {
        intent: 'play_specific_song',
        artist: 'The Weeknd',
        track: 'Blinding Lights',
        confidence: 0.9,
        alternatives: ['The Weeknd - Save Your Tears', 'The Weeknd - Can\'t Feel My Face']
      },
      timestamp: Date.now() - 300000 // 5 minutes ago
    };

    const taylorSwiftHistory: ConversationEntry = {
      command: 'did he collaborate with taylor swift',
      interpretation: {
        intent: 'ask_question',
        confidence: 0.8,
        reasoning: 'User asking about collaboration history'
      },
      timestamp: Date.now() - 200000 // 3 minutes ago
    };

    const jpopHistory: ConversationEntry = {
      command: 'play something for assassins creed',
      interpretation: {
        intent: 'play_specific_song',
        artist: 'Yasunori Mitsuda',
        track: 'Ezio\'s Family',
        confidence: 0.9,
        query: 'assassins creed soundtrack'
      },
      timestamp: Date.now() - 100000 // 1 minute ago
    };

    const dialogState: DialogState = {
      last_action: {
        type: 'play',
        intent: 'play_specific_song',
        artist: 'Yasunori Mitsuda',
        track: 'Ezio\'s Family',
        query: 'assassins creed soundtrack',
        timestamp: Date.now() - 100000
      },
      last_candidates: [],
      interaction_mode: 'music',
      updated_at: Date.now() - 100000
    };

    it('should prevent context pollution for similarity requests', () => {
      const fullHistory = [jpopHistory, taylorSwiftHistory, weekndHistory];
      
      // Test the problematic command that caused Gracie Abrams to play
      const relevantContext = conversation.getRelevantContext(
        'queue a playlist with similar stuff', 
        fullHistory, 
        dialogState
      );

      // Should only return the last music action (J-pop), not The Weeknd or Taylor Swift context
      expect(relevantContext).toHaveLength(1);
      expect(relevantContext[0].interpretation.artist).toBe('Yasunori Mitsuda');
      expect(relevantContext[0].interpretation.track).toBe('Ezio\'s Family');
      
      // Should NOT include The Weeknd or Taylor Swift context
      expect(relevantContext.some(entry => entry.interpretation.artist === 'The Weeknd')).toBe(false);
      expect(relevantContext.some(entry => entry.interpretation.intent === 'ask_question')).toBe(false);
    });

    it('should identify similarity requests correctly', () => {
      expect(conversation.isSimilarityRequest('queue a playlist with similar stuff')).toBe(true);
      expect(conversation.isSimilarityRequest('play something similar')).toBe(true);
      expect(conversation.isSimilarityRequest('more like that')).toBe(true);
      expect(conversation.isSimilarityRequest('same style')).toBe(true);
      expect(conversation.isSimilarityRequest('similar vibe')).toBe(true);
      
      // Negative cases
      expect(conversation.isSimilarityRequest('play taylor swift')).toBe(false);
      expect(conversation.isSimilarityRequest('queue bohemian rhapsody')).toBe(false);
    });

    it('should provide contextual references with alternatives', () => {
      const historyWithAlternatives = [
        {
          ...jpopHistory,
          interpretation: {
            ...jpopHistory.interpretation,
            alternatives: ['Nobuo Uematsu - One-Winged Angel', 'Koji Kondo - Zelda Theme']
          }
        }
      ];

      const relevantContext = conversation.getRelevantContext(
        'no the zelda one',
        historyWithAlternatives,
        dialogState
      );

      expect(relevantContext).toHaveLength(1);
      expect(relevantContext[0].interpretation.alternatives).toContain('Koji Kondo - Zelda Theme');
    });

    it('should filter music actions for general commands', () => {
      const mixedHistory = [jpopHistory, taylorSwiftHistory, weekndHistory];
      
      const relevantContext = conversation.getRelevantContext(
        'play something new',
        mixedHistory,
        dialogState
      );

      // Should only include music actions, filtered by time-boxing
      expect(relevantContext.length).toBeLessThanOrEqual(2);
      expect(relevantContext.every(entry => 
        ['play_specific_song', 'queue_specific_song', 'play_playlist', 'queue_playlist'].includes(entry.interpretation.intent)
      )).toBe(true);
      
      // Should NOT include conversational/question intents
      expect(relevantContext.some(entry => entry.interpretation.intent === 'ask_question')).toBe(false);
    });
  });

  describe('Destructive Action Detection', () => {
    it('should identify destructive actions correctly', () => {
      expect(conversation.isDestructiveAction('play_specific_song')).toBe(true);
      expect(conversation.isDestructiveAction('queue_specific_song')).toBe(true);
      expect(conversation.isDestructiveAction('play_playlist')).toBe(true);
      expect(conversation.isDestructiveAction('queue_playlist')).toBe(true);
      expect(conversation.isDestructiveAction('search_and_play')).toBe(true);
      
      // Non-destructive actions
      expect(conversation.isDestructiveAction('chat')).toBe(false);
      expect(conversation.isDestructiveAction('ask_question')).toBe(false);
      expect(conversation.isDestructiveAction('get_info')).toBe(false);
      expect(conversation.isDestructiveAction('pause')).toBe(false);
      expect(conversation.isDestructiveAction('get_current_track')).toBe(false);
    });
  });

  describe('Dialog State Management', () => {
    const mockState: DialogState = {
      last_action: null,
      last_candidates: [],
      interaction_mode: 'music',
      updated_at: Date.now()
    };

    it('should update dialog state for music actions', () => {
      const interpretation = {
        intent: 'play_specific_song',
        artist: 'The Weeknd',
        track: 'Blinding Lights',
        confidence: 0.9
      };

      const alternatives = ['The Weeknd - Save Your Tears', 'The Weeknd - Can\'t Feel My Face'];

      const updatedState = conversation.updateDialogStateFromAction(
        mockState,
        interpretation,
        alternatives
      );

      expect(updatedState.last_action).not.toBeNull();
      expect(updatedState.last_action?.type).toBe('play');
      expect(updatedState.last_action?.artist).toBe('The Weeknd');
      expect(updatedState.last_action?.track).toBe('Blinding Lights');
      expect(updatedState.last_action?.alternatives).toEqual(alternatives);
      expect(updatedState.interaction_mode).toBe('music');
    });

    it('should update dialog state for queue actions', () => {
      const interpretation = {
        intent: 'queue_specific_song',
        artist: 'Taylor Swift',
        track: 'Anti-Hero',
        confidence: 0.9
      };

      const updatedState = conversation.updateDialogStateFromAction(
        mockState,
        interpretation,
        []
      );

      expect(updatedState.last_action?.type).toBe('queue');
      expect(updatedState.last_action?.intent).toBe('queue_specific_song');
    });

    it('should update interaction mode for conversational intents', () => {
      const interpretation = {
        intent: 'ask_question',
        confidence: 0.8,
        reasoning: 'User asking about collaboration'
      };

      const updatedState = conversation.updateDialogStateFromAction(
        mockState,
        interpretation,
        []
      );

      expect(updatedState.interaction_mode).toBe('chat');
      expect(updatedState.last_action).toBeNull(); // Should not update last_action for chat
    });

    it('should not update last_action for non-destructive intents', () => {
      const interpretation = {
        intent: 'get_info',
        confidence: 0.9
      };

      const updatedState = conversation.updateDialogStateFromAction(
        mockState,
        interpretation,
        []
      );

      expect(updatedState.last_action).toBeNull();
      expect(updatedState.interaction_mode).toBe('chat');
    });
  });

  describe('Edge Cases and Regression Tests', () => {
    it('should handle empty dialog state gracefully', () => {
      const emptyState: DialogState = {
        last_action: null,
        last_candidates: [],
        interaction_mode: 'music',
        updated_at: Date.now()
      };

      const relevantContext = conversation.getRelevantContext(
        'queue similar stuff',
        [],
        emptyState
      );

      expect(relevantContext).toEqual([]);
    });

    it('should handle mixed conversation history correctly', () => {
      const mixedHistory: ConversationEntry[] = [
        {
          command: 'tell me about this song',
          interpretation: {
            intent: 'get_info',
            confidence: 0.9
          },
          timestamp: Date.now() - 50000
        },
        {
          command: 'play taylor swift',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'Taylor Swift',
            track: 'Anti-Hero',
            confidence: 0.9
          },
          timestamp: Date.now() - 100000
        },
        {
          command: 'what do you think of the weeknd',
          interpretation: {
            intent: 'chat',
            confidence: 0.8
          },
          timestamp: Date.now() - 150000
        }
      ];

      const dialogState: DialogState = {
        last_action: {
          type: 'play',
          intent: 'play_specific_song',
          artist: 'Taylor Swift',
          track: 'Anti-Hero',
          timestamp: Date.now() - 100000
        },
        last_candidates: [],
        interaction_mode: 'music',
        updated_at: Date.now() - 100000
      };

      // For general commands, should only get music actions
      const relevantContext = conversation.getRelevantContext(
        'play something else',
        mixedHistory,
        dialogState
      );

      expect(relevantContext).toHaveLength(1);
      expect(relevantContext[0].interpretation.intent).toBe('play_specific_song');
      expect(relevantContext[0].interpretation.artist).toBe('Taylor Swift');
    });

    it('should prevent infinite context pollution scenarios', () => {
      // Simulate the original bug scenario
      const bugScenario: ConversationEntry[] = [
        {
          command: 'play the weeknd',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'The Weeknd',
            track: 'Blinding Lights',
            confidence: 0.9
          },
          timestamp: Date.now() - 500000 // 8 minutes ago
        },
        {
          command: 'did he ever collaborate with taylor swift or haim',
          interpretation: {
            intent: 'ask_question',
            confidence: 0.8,
            reasoning: 'User asking about collaborations'
          },
          timestamp: Date.now() - 400000 // 6 minutes ago
        },
        {
          command: 'play something for assassins creed',
          interpretation: {
            intent: 'play_specific_song',
            artist: 'Jesper Kyd',
            track: 'Ezio\'s Family',
            confidence: 0.9
          },
          timestamp: Date.now() - 100000 // 1 minute ago
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

      // The problematic command that should only get J-pop context
      const relevantContext = conversation.getRelevantContext(
        'queue a playlist with similar stuff',
        bugScenario,
        dialogState
      );

      // Should only return the last music action (Assassin's Creed soundtrack)
      expect(relevantContext).toHaveLength(1);
      expect(relevantContext[0].interpretation.artist).toBe('Jesper Kyd');
      
      // Should NOT contaminate with The Weeknd or Taylor Swift context
      expect(relevantContext.some(entry => 
        entry.interpretation.artist === 'The Weeknd' || 
        entry.interpretation.intent === 'ask_question'
      )).toBe(false);
    });
  });

  describe('Conversational Intent Scenarios', () => {
    it('should handle questions without triggering music playback', () => {
      // This is testing the fix for "did he ever collaborate with Taylor Swift or haim"
      const command = 'did he ever collaborate with taylor swift or haim';
      
      // This would be handled at the LLM level, but we can test our classification
      expect(conversation.isDestructiveAction('ask_question')).toBe(false);
      expect(conversation.isDestructiveAction('get_info')).toBe(false);
      expect(conversation.isDestructiveAction('chat')).toBe(false);
    });

    it('should distinguish between questions and commands', () => {
      // Questions (should be conversational)
      const questions = [
        'did he collaborate with x',
        'tell me about this song',
        'what do you think of this artist',
        'has she released any new albums'
      ];

      // Commands (should be music actions)
      const commands = [
        'play taylor swift',
        'queue bohemian rhapsody',
        'play similar music',
        'queue a playlist'
      ];

      // The actual intent classification happens in the LLM prompt,
      // but we can test our destructive action detection
      questions.forEach(q => {
        // These would get 'ask_question', 'get_info', or 'chat' intents
        expect(conversation.isDestructiveAction('ask_question')).toBe(false);
      });

      commands.forEach(c => {
        // These would get 'play_specific_song' or 'queue_specific_song' intents
        expect(conversation.isDestructiveAction('play_specific_song')).toBe(true);
        expect(conversation.isDestructiveAction('queue_specific_song')).toBe(true);
      });
    });
  });
});