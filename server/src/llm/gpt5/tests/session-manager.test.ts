import { SessionManager } from '../core/session-manager';
import { SessionData } from '../types';
import { createClient } from 'redis';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockRedisClient: any;
  
  beforeEach(() => {
    // Create a mock Redis client
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      isOpen: true
    };
    
    sessionManager = new SessionManager(mockRedisClient, '/tmp/test-session.json');
  });

  describe('saveSession', () => {
    it('should save to Redis when client is available', async () => {
      const testData: SessionData = {
        lastResponseId: 'test-123',
        conversationHistory: [{
          responseId: 'test-123',
          input: 'Hello',
          output: 'Hi there!',
          timestamp: '2025-01-01T00:00:00Z',
          model: 'gpt-5',
          hadFunctionCall: false
        }],
        metadata: { test: true }
      };

      sessionManager.sessionData = testData;
      mockRedisClient.set.mockResolvedValue('OK');
      
      await sessionManager.saveSession();
      
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'gpt5-test-session',
        JSON.stringify(testData),
        { EX: 86400 }
      );
    });

    it('should handle concurrent saves gracefully', async () => {
      sessionManager.sessionData.lastResponseId = 'test-456';
      mockRedisClient.set.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('OK'), 100))
      );

      // Trigger multiple saves concurrently
      const save1 = sessionManager.saveSession();
      const save2 = sessionManager.saveSession();
      const save3 = sessionManager.saveSession();

      await Promise.all([save1, save2, save3]);

      // Should batch saves, not call Redis 3 times immediately
      expect(mockRedisClient.set.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('loadSession', () => {
    it('should validate session data with Zod schema', async () => {
      const invalidData = {
        lastResponseId: 123, // Should be string, not number
        conversationHistory: [],
        metadata: {}
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(invalidData));
      
      await sessionManager.loadSession();
      
      // Should reset to valid empty session on validation failure
      expect(sessionManager.sessionData.lastResponseId).toBeNull();
      expect(sessionManager.sessionData.conversationHistory).toEqual([]);
    });

    it('should load valid session from Redis', async () => {
      const validData: SessionData = {
        lastResponseId: 'valid-123',
        conversationHistory: [{
          responseId: 'valid-123',
          input: 'Test input',
          output: 'Test output',
          timestamp: '2025-01-01T00:00:00Z',
          model: 'gpt-5-nano',
          hadFunctionCall: true
        }],
        metadata: { loaded: true }
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(validData));
      
      await sessionManager.loadSession();
      
      expect(sessionManager.sessionData).toEqual(validData);
    });
  });
});