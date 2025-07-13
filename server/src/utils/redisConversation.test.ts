import { RedisConversation, ConversationEntry } from './redisConversation';

describe('RedisConversation', () => {
  describe('isContextualReference', () => {
    let conversation: RedisConversation;
    
    beforeEach(() => {
      // Mock Redis client
      const mockClient = {};
      conversation = new RedisConversation(mockClient);
    });
    
    it('should identify contextual references correctly', () => {
      // Positive cases
      expect(conversation.isContextualReference('no the taylor swift one')).toBe(true);
      expect(conversation.isContextualReference('not that one')).toBe(true);
      expect(conversation.isContextualReference('yes that one')).toBe(true);
      expect(conversation.isContextualReference('the second one')).toBe(true);
      expect(conversation.isContextualReference('actually play the other version')).toBe(true);
      expect(conversation.isContextualReference('try the acoustic version')).toBe(true);
      expect(conversation.isContextualReference('play the original one')).toBe(true);
      expect(conversation.isContextualReference('queue the remix version')).toBe(true);
      expect(conversation.isContextualReference('the other one instead')).toBe(true);
      
      // Negative cases
      expect(conversation.isContextualReference('play taylor swift')).toBe(false);
      expect(conversation.isContextualReference('play gasoline')).toBe(false);
      expect(conversation.isContextualReference('pause')).toBe(false);
      expect(conversation.isContextualReference('volume up')).toBe(false);
    });
  });
  
  describe('resolveContextualReference', () => {
    let conversation: RedisConversation;
    
    beforeEach(() => {
      const mockClient = {};
      conversation = new RedisConversation(mockClient);
    });
    
    it('should resolve "the taylor swift one" from alternatives', () => {
      const history: ConversationEntry[] = [{
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
        timestamp: Date.now()
      }];
      
      const result = conversation.resolveContextualReference('no the taylor swift one', history);
      
      expect(result).toEqual({
        artist: 'Haim',
        track: 'Gasoline (ft. Taylor Swift)',
        confidence: 0.9
      });
    });
    
    it('should resolve "the halsey one" from alternatives', () => {
      const history: ConversationEntry[] = [{
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
        timestamp: Date.now()
      }];
      
      const result = conversation.resolveContextualReference('actually the halsey one', history);
      
      expect(result).toEqual({
        artist: 'Halsey',
        track: 'Gasoline',
        confidence: 0.9
      });
    });
    
    it('should return null when no match found', () => {
      const history: ConversationEntry[] = [{
        command: 'play gasoline',
        interpretation: {
          intent: 'play_specific_song',
          artist: 'The Weeknd',
          track: 'Gasoline',
          confidence: 0.9,
          alternatives: [
            'Halsey - Gasoline',
            'Seether - Gasoline'
          ]
        },
        timestamp: Date.now()
      }];
      
      const result = conversation.resolveContextualReference('the beyonce one', history);
      
      expect(result).toBeNull();
    });
    
    it('should return null when no history', () => {
      const result = conversation.resolveContextualReference('the taylor swift one', []);
      
      expect(result).toBeNull();
    });
  });
});