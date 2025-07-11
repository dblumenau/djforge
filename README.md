# Spotify Claude Controller

A natural language Spotify controller that lets you control your music with text commands interpreted by Claude.

## Features

- Natural language commands: "play that dancey Taylor Swift song"
- Direct control of your desktop Spotify app
- Smart search and queue management
- Volume control and playback management
- Works with your existing Spotify Premium account

## Prerequisites

- macOS (for AppleScript support)
- Node.js 18+ installed
- Spotify Premium account
- Spotify desktop app installed
- Claude API access (or use Claude Code)

## Setup

### 1. Register a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create app"
3. Fill in:
   - App name: `Spotify Claude Controller`
   - App description: `Natural language Spotify control`
   - Redirect URI: `http://localhost:3001/api/callback`
4. Click "Create"
5. Note your **Client ID** and **Client Secret**

### 2. Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Spotify credentials:
   ```
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   SPOTIFY_REDIRECT_URI=http://localhost:3001/api/callback
   SESSION_SECRET=any_random_string_here
   ```

### 3. Install Dependencies

```bash
npm run install:all
```

### 4. Start the Application

```bash
npm run dev
```

This will start:
- Backend server on http://localhost:3001
- Frontend UI on http://localhost:3000

### 5. First Time Setup

1. Open http://localhost:3000
2. Click "Login with Spotify"
3. Authorize the app
4. Start controlling your music!

## Usage Examples

Type natural language commands like:

- "Play Shake It Off"
- "Play that upbeat Beatles song"
- "Queue some relaxing jazz"
- "Skip this song"
- "Volume up"
- "Pause for 2 minutes"
- "What's playing?"

## Architecture

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript + Vite
- **Spotify Control**: AppleScript for direct desktop control
- **Smart Features**: Spotify Web API for search and metadata
- **NLP**: Claude for natural language understanding

## Troubleshooting

### "Spotify is not running"
- Make sure Spotify desktop app is open
- The web player won't work with this controller

### "Command not recognized"
- Try being more specific
- Check the console for interpretation details

### Authentication Issues
- Clear your browser cookies
- Re-authenticate with Spotify
- Check your Client ID and Secret

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
cd server && npm start
```