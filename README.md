# 🎵 Spotify Claude Controller

Control your Spotify desktop app with natural language commands powered by Claude!

## ✨ Features

- 🗣️ **Natural language commands**: "play that dancey Taylor Swift song"
- ⚡ **Instant control**: Zero-latency play/pause/skip via AppleScript
- 🔍 **Smart search**: Find any song and play it instantly
- 📋 **Queue management**: Add songs to your queue naturally
- 🎨 **Beautiful UI**: Two-column layout with animated loading states
- 🔐 **Auto-refresh tokens**: Stay logged in without re-authenticating

## 📋 Prerequisites

- macOS (for AppleScript support)
- Node.js 18+ installed
- Spotify account (free or premium)
- Spotify desktop app installed
- Claude CLI installed (`claude` command available)

## Setup

### 1. Register a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create app"
3. Fill in:
   - App name: `Spotify Claude Controller`
   - App description: `Natural language Spotify control`
   - Redirect URI: `http://127.0.0.1:3001/callback` (⚠️ Must be 127.0.0.1, not localhost!)
4. Click "Create"
5. Note your **Client ID** and **Client Secret**

### 2. Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Create `.env` file in the project root and add your Spotify credentials:
   ```
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/callback
   ```

### 3. Install Dependencies

```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 4. Start the Application

```bash
# Terminal 1 - Start server
cd server && npm run dev

# Terminal 2 - Start client
cd client && npm run dev
```

This will start:
- Backend server on http://127.0.0.1:3001
- Frontend UI on http://127.0.0.1:5173

### 5. First Time Setup

1. Open http://127.0.0.1:5173
2. Click "Login with Spotify"
3. Authorize the app
4. Grant Terminal/iTerm permission to control Spotify (macOS will prompt)
5. Start controlling your music!

## Usage Examples

Type natural language commands like:

**Basic Commands:**
- "Play Shake It Off"
- "Skip this song"
- "Volume to 70"
- "What's playing?"

**Smart Search (NEW!):**
- "Play the most obscure Taylor Swift song"
- "Play Long Live original version not Taylor's Version"
- "Queue the least popular Beatles track"
- "Play that song from the desert driving scene"

**Mood & Vibe Queries:**
- "Play something that sounds like rain"
- "Queue some chill Sunday morning music"
- "Play upbeat workout tracks"

## 🏗️ Architecture

```
User → React UI → Express Server → Enhanced Claude Interpreter
                                 ↓
                    Claude's Music Knowledge + Smart Filtering
                                 ↓
                    AppleScript + Spotify Web API
                                 ↓
                       Desktop Spotify App
```

- **Frontend**: React + TypeScript + Tailwind CSS v4
- **Backend**: Node.js + Express + TypeScript
- **Auth**: Spotify OAuth 2.0 with PKCE flow
- **Control**: AppleScript for instant control (<50ms)
- **Search**: Spotify Web API with popularity-based ranking
- **AI**: Enhanced Claude interpreter with:
  - Deep music knowledge for obscure/rare tracks
  - Cultural reference understanding
  - Version disambiguation (original vs remix)
  - Confidence scoring

## 🔍 How It Works

### Enhanced Claude Interpreter

The app now uses Claude's deep music knowledge to understand complex requests:

1. **Obscure Track Detection**: When you ask for "obscure" or "rare" songs, Claude suggests specific deep cuts and B-sides, then uses Spotify's popularity scores to verify and rank them.

2. **Cultural References**: Claude recognizes movie/TV references and suggests the actual songs (e.g., "desert driving scene" → "Riders on the Storm").

3. **Version Intelligence**: Automatically handles version requests like "original not Taylor's Version" by filtering search results.

4. **Mood Understanding**: Claude translates mood descriptions into specific song suggestions.

### Tips for Best Results

- **Be conversational**: "Play that song from the movie where they're dancing in the diner"
- **Use descriptive language**: "Play something melancholy for a rainy afternoon"
- **Specify preferences**: "Play the least mainstream Radiohead song"
- **Combine criteria**: "Play an upbeat Beatles deep cut from the 60s"

### Common Issues

**"Spotify is not running"**
- Make sure Spotify desktop app is open
- The web player won't work with this controller

**Claude takes ~10 seconds to respond**
- This is normal - Claude CLI processes natural language deeply
- Basic commands (play/pause) are instant via AppleScript
- Complex searches require Claude's analysis time

**Authentication Issues**
- Clear your browser cookies
- Re-authenticate with Spotify
- Check your Client ID and Secret

## 🚀 What's Next?

See [docs/TODO.md](docs/TODO.md) for planned features including:
- Current track display with album art
- Timed commands ("pause in 5 minutes")
- Performance caching for common commands
- Mood-based playlists
- And much more!

## 🛠️ Development

```bash
# Run tests
cd server && npm test

# Build for production
cd server && npm run build
cd ../client && npm run build

# Type checking
cd server && npm run type-check
```

## 🤝 Contributing

This is a fun project exploring natural language music control! Feel free to:
- Open issues for bugs or feature requests
- Submit PRs for improvements
- Share cool command examples

## 📄 License

MIT