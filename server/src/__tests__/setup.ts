import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '4002'; // Different port for tests

// Increase timeout for WebSocket tests
jest.setTimeout(10000);

// Mock winston to reduce test output noise
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn()
  },
  transports: {
    Console: jest.fn()
  }
}));