// Jest setup file for global test configuration
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '../.env' });

// FORCE CONSOLE OUTPUT FOR ALL TESTS - DON'T MOCK ANYTHING
console.log('🧪 TEST SETUP: Console output ALWAYS enabled - no mocking');

// Store original console
const originalConsole = console;

// Override global console to ensure it's never mocked
global.console = {
  ...originalConsole,
  log: originalConsole.log.bind(originalConsole),
  info: originalConsole.info.bind(originalConsole),
  warn: originalConsole.warn.bind(originalConsole),
  error: originalConsole.error.bind(originalConsole),
};

// Setup global test environment
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SESSION_SECRET = 'test-secret';