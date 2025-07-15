import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { simpleLLMInterpreterRouter, setRedisClient } from './routes/simple-llm-interpreter';

// Create test app without Redis initialization
const testApp = express();

// Basic middleware
testApp.use(cors({
  origin: 'http://127.0.0.1:5173',
  credentials: true
}));

testApp.use(express.json());

// Mock session middleware for tests
testApp.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Set up routes
testApp.use('/api/claude', simpleLLMInterpreterRouter);

// Mock Redis client for tests
const mockRedisClient = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve('OK'),
  del: () => Promise.resolve(1),
  keys: () => Promise.resolve([]),
  quit: () => Promise.resolve(),
  lRange: () => Promise.resolve([]),
  setEx: () => Promise.resolve('OK'),
  eval: () => Promise.resolve(1)
};

// Initialize with mock Redis
setRedisClient(mockRedisClient);

export { testApp as app };