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

- "Play Shake It Off"
- "Play that upbeat Beatles song"
- "Queue some relaxing jazz"
- "Skip this song"
- "Volume up"
- "Pause for 2 minutes"
- "What's playing?"

## 🏗️ Architecture

```
User → React UI → Express Server → Claude CLI (~10s)
                                 ↓
                    AppleScript + Spotify Web API
                                 ↓
                       Desktop Spotify App
```

- **Frontend**: React + TypeScript + Tailwind CSS v4
- **Backend**: Node.js + Express + TypeScript
- **Auth**: Spotify OAuth 2.0 with PKCE flow
- **Control**: AppleScript for instant control (<50ms)
- **Search**: Spotify Web API for finding tracks
- **AI**: Claude CLI for natural language understanding

## 🔍 Search Tips & Troubleshooting

### Getting Better Search Results

**Finding obscure/rare tracks:**
- Spotify's API tends to return popular tracks first
- Try being explicit: "play the least popular song by [artist]"
- Add modifiers: "play [artist] B-sides/demos/deep cuts"
- Reference specific albums: "play bonus tracks from [album]"

**Specifying versions:**
- Be explicit about versions: "play [song] original version"
- Use exclusions: "play [song] NOT remix"
- Add year: "play [song] 2010 version"
- Specify type: "play [song] acoustic/live/demo version"

**Advanced search tips:**
- Exclude unwanted results: "play [song] -live -remix"
- Include featured artists: "play [song] featuring [artist]"
- Be specific with titles: "play [song] extended version"
- Combine criteria: "play rare [artist] live recordings"

### Common Issues

**"Spotify is not running"**
- Make sure Spotify desktop app is open
- The web player won't work with this controller

**Wrong version playing**
- Spotify search can be tricky with re-recordings
- Try being more specific with exclusions
- Check the year or album in your command

**"Most popular" songs returned for "obscure" requests**
- This is a Spotify API limitation
- Try searching for specific albums or EPs
- Look for "deluxe", "bonus tracks", or "B-sides"

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