import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import axios from 'axios';
import { authRouter } from './spotify/auth';
import { controlRouter } from './spotify/control';
import { claudeRouter } from './claude/interpreter';
import { enhancedClaudeRouter } from './claude/enhanced-interpreter';
import { simpleLLMInterpreterRouter } from './routes/simple-llm-interpreter';
import { llmInterpreterRouter } from './routes/llm-interpreter';
import { sessionManagementRouter, setRedisUtils } from './routes/session-management';
import { createRedisClient, checkRedisHealth } from './config/redis';
import { RedisUtils } from './utils/redis-utils';
import RedisStore from 'connect-redis';

// Fallback to file store if Redis is unavailable
const FileStore = require('session-file-store')(session);

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Redis client
let redisClient: any = null;
let sessionStore: any = null;
let redisUtils: RedisUtils | null = null;

async function initializeSessionStore() {
  try {
    // Try to connect to Redis
    redisClient = await createRedisClient();
    await redisClient.connect();
    
    // Check if Redis is healthy
    const isHealthy = await checkRedisHealth(redisClient);
    if (isHealthy) {
      console.log('✅ Using Redis for session storage');
      sessionStore = new (RedisStore as any)({
        client: redisClient,
        prefix: 'djforge:sess:',
        ttl: 86400 * 30, // 30 days in seconds
      });
      
      // Create Redis utils for session management
      redisUtils = new RedisUtils(redisClient);
      setRedisUtils(redisUtils);
    } else {
      throw new Error('Redis health check failed');
    }
  } catch (error) {
    console.warn('⚠️  Redis unavailable, falling back to file-based sessions:', error instanceof Error ? error.message : 'Unknown error');
    
    // Fallback to file-based sessions
    sessionStore = new FileStore({
      path: '../sessions',
      ttl: 86400 * 30, // 30 days
      retries: 5,
      reapInterval: 3600 // Clean up expired sessions every hour
    });
    
    // Clean up Redis client if it was created
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch {
        // Ignore cleanup errors
      }
      redisClient = null;
    }
  }
}

// CORS must be configured before session middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/control', controlRouter);

// Use flexible LLM interpreter by default (production-ready)
app.use('/api/claude', simpleLLMInterpreterRouter);
// Keep schema-based interpreter available at /api/claude-schema
app.use('/api/claude-schema', llmInterpreterRouter);
// Keep enhanced interpreter available at /api/claude-enhanced
app.use('/api/claude-enhanced', enhancedClaudeRouter);
// Keep original interpreter available at /api/claude-basic
app.use('/api/claude-basic', claudeRouter);

// Session management endpoints
app.use('/api/sessions', sessionManagementRouter);

// Handle callback at root level (Spotify redirects here)
app.get('/callback', async (req, res) => {
  // Import the callback handler logic
  const { code, error } = req.query;
  
  if (error) {
    return res.redirect('http://127.0.0.1:5173?error=' + error);
  }
  
  if (!code || typeof code !== 'string') {
    return res.redirect('http://127.0.0.1:5173?error=no_code');
  }
  
  const codeVerifier = req.session.codeVerifier;
  if (!codeVerifier) {
    return res.redirect('http://127.0.0.1:5173?error=no_verifier');
  }
  
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        code_verifier: codeVerifier
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    req.session.spotifyTokens = response.data;
    req.session.tokenTimestamp = Date.now();
    delete req.session.codeVerifier;
    
    console.log('Auth successful, tokens saved:', !!req.session.spotifyTokens);
    console.log('Session ID:', req.sessionID);
    
    // Force session save before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('http://127.0.0.1:5173?error=session_save_failed');
      }
      res.redirect('http://127.0.0.1:5173?success=true');
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    res.redirect('http://127.0.0.1:5173?error=token_exchange_failed');
  }
});

// Health check with Redis status
app.get('/api/health', async (req, res) => {
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    sessionStore: redisClient ? 'redis' : 'file',
  };
  
  // Check Redis health if available
  if (redisClient) {
    try {
      health.redis = await checkRedisHealth(redisClient) ? 'healthy' : 'unhealthy';
    } catch {
      health.redis = 'error';
    }
  }
  
  res.json(health);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📡 Received SIGTERM, shutting down gracefully');
  
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error);
    }
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📡 Received SIGINT, shutting down gracefully');
  
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error);
    }
  }
  
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize session store first
    await initializeSessionStore();
    
    // Configure session middleware
    app.use(session({
      secret: process.env.SESSION_SECRET || 'spotify-claude-secret',
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 86400000 * 30, // 30 days
        sameSite: 'lax',
        path: '/'
      },
      name: 'spotify_session'
    }));
    
    app.listen(PORT, () => {
      console.log(`🎵 Spotify Controller server running on http://localhost:${PORT}`);
      console.log(`🤖 Ready to receive commands!`);
      console.log(`📦 Session storage: ${redisClient ? 'Redis' : 'File-based'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();