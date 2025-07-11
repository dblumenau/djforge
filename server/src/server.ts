import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import axios from 'axios';
import { authRouter } from './spotify/auth';
import { controlRouter } from './spotify/control';
import { claudeRouter } from './claude/interpreter';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// CORS must be configured before session middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'spotify-claude-secret',
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 3600000, // 1 hour
    sameSite: 'lax',
    path: '/'
  },
  name: 'spotify_session'
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/control', controlRouter);
app.use('/api/claude', claudeRouter);

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🎵 Spotify Controller server running on http://localhost:${PORT}`);
  console.log(`🤖 Ready to receive commands!`);
});