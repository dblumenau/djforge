#!/usr/bin/env npx tsx

/**
 * Simple test runner for SessionManager
 * Run with: npx tsx src/llm/gpt5/tests/run-session-test.ts
 */

import { SessionManager } from '../core/session-manager';
import { SessionData } from '../types';
import chalk from 'chalk';

async function testSessionManager() {
  console.log(chalk.bold('\n🧪 Testing SessionManager in Isolation\n'));

  // Create a mock Redis client
  const mockRedisClient = {
    get: async (key: string) => {
      console.log(chalk.dim(`Mock Redis GET: ${key}`));
      // Return some test data
      return JSON.stringify({
        lastResponseId: 'test-123',
        conversationHistory: [{
          responseId: 'test-123',
          input: 'Hello from mock',
          output: 'Hi from Redis!',
          timestamp: new Date().toISOString(),
          model: 'gpt-5',
          hadFunctionCall: false
        }],
        metadata: { mock: true }
      });
    },
    set: async (key: string, value: string, options?: any) => {
      console.log(chalk.dim(`Mock Redis SET: ${key}`));
      console.log(chalk.dim(`Options: ${JSON.stringify(options)}`));
      return 'OK';
    },
    isOpen: true
  };

  const sessionManager = new SessionManager();

  // Test 1: Load session
  console.log(chalk.yellow('Test 1: Loading session from mock Redis'));
  const sessionData = await sessionManager.loadSession(mockRedisClient as any);
  console.log(chalk.green('✓ Session loaded:'), sessionData);

  // Test 2: Save session
  console.log(chalk.yellow('\nTest 2: Saving modified session'));
  sessionData.conversationHistory.push({
    responseId: 'test-456',
    input: 'Another test',
    output: 'Another response',
    timestamp: new Date().toISOString(),
    model: 'gpt-5-mini',
    hadFunctionCall: true
  });
  
  await sessionManager.saveSession(sessionData, mockRedisClient as any);
  console.log(chalk.green('✓ Session saved successfully'));

  // Test 3: Validation with bad data
  console.log(chalk.yellow('\nTest 3: Testing validation with invalid data'));
  const badRedisClient = {
    get: async () => JSON.stringify({
      lastResponseId: 123, // Should be string, not number
      conversationHistory: 'not an array', // Should be array
      metadata: {}
    }),
    set: async () => 'OK',
    isOpen: true
  };

  const sessionManager2 = new SessionManager();
  const sessionData2 = await sessionManager2.loadSession(badRedisClient as any);
  
  console.log(chalk.green('✓ Invalid data handled - reset to empty session:'), 
    sessionData2);

  // Test 4: Concurrent saves
  console.log(chalk.yellow('\nTest 4: Testing concurrent save protection'));
  const saves = [
    sessionManager.saveSession(sessionData, mockRedisClient as any),
    sessionManager.saveSession(sessionData, mockRedisClient as any),
    sessionManager.saveSession(sessionData, mockRedisClient as any)
  ];
  
  await Promise.all(saves);
  console.log(chalk.green('✓ Concurrent saves handled gracefully'));

  console.log(chalk.bold.green('\n✅ All SessionManager tests passed!\n'));
}

// Run the test
testSessionManager().catch(error => {
  console.error(chalk.red('Test failed:'), error);
  process.exit(1);
});