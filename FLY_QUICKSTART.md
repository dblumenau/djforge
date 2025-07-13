# 🚀 DJForge Fly.io Quick Start Guide

## Prerequisites
- Fly.io account (free at [fly.io](https://fly.io))
- Your Spotify API credentials
- Your OpenRouter API key

## 1. Install Fly CLI
```bash
# macOS
brew install flyctl

# Or direct install
curl -L https://fly.io/install.sh | sh
```

## 2. Login
```bash
flyctl auth login
```

## 3. Initialize Apps
```bash
./deploy-to-fly.sh init
```

## 4. Configure Secrets
```bash
./deploy-to-fly.sh secrets
```

You'll be prompted for:
- `SPOTIFY_CLIENT_ID` - From your Spotify app
- `SPOTIFY_CLIENT_SECRET` - From your Spotify app  
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `SESSION_SECRET` - Press Enter to auto-generate
- `REDIS_HOST` - Use Upstash Redis (see below) or press Enter
- `REDIS_PASSWORD` - From Upstash or leave blank

## 5. Deploy!
```bash
./deploy-to-fly.sh deploy
```

## 6. Update Spotify Redirect URI
Add this to your Spotify app settings:
```
https://djforge-server.fly.dev/callback
```

## Your Apps
- Frontend: https://djforge-client.fly.dev
- API: https://djforge-server.fly.dev

## Free Redis Setup (Optional)
1. Sign up at [Upstash](https://upstash.com)
2. Create a Redis database (free tier)
3. Copy the endpoint and password
4. Update secrets: `flyctl secrets set REDIS_HOST=xxx REDIS_PASSWORD=xxx -a djforge-server`

## Common Commands
```bash
# View logs
./deploy-to-fly.sh logs server
./deploy-to-fly.sh logs client

# Check status
./deploy-to-fly.sh status

# Redeploy after changes
./deploy-to-fly.sh deploy

# Scale up
./deploy-to-fly.sh scale server 2
```

## That's it! 🎉
Your DJForge is now live on Fly.io!