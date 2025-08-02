# Deploying DJForge to Fly.io

## Overview

Fly.io is similar to deploying Laravel apps on services like Forge or Vapor, but it uses Docker containers. Think of it as:
- **Laravel Forge** = Server management + deployment
- **Fly.io** = Container management + global deployment

## Prerequisites

1. **Fly.io account**: Sign up at [fly.io](https://fly.io)
2. **Fly CLI installed**: 
   ```bash
   # macOS
   brew install flyctl
   
   # or use curl
   curl -L https://fly.io/install.sh | sh
   ```
3. **Your .env file configured** with production values

## Step-by-Step Deployment

### 1. Login to Fly.io

```bash
flyctl auth login
```

This opens your browser to authenticate, similar to `php artisan key:generate` but for Fly.

### 2. Create Fly Apps

Unlike Laravel where you deploy one app, DJForge needs TWO apps on Fly:
- One for the Express server (like your Laravel backend)
- One for the React client (like your Laravel frontend assets)

```bash
cd /Users/david/Sites/djforge

# Create the server app
mkdir -p fly-deploy/server
cp -r server/* fly-deploy/server/
cd fly-deploy/server

flyctl launch --name djforge-server --no-deploy
# Choose region closest to you (e.g., sjc for US West)
# Don't deploy yet - we need to configure first

# Create the client app
cd ../..
mkdir -p fly-deploy/client
cp -r client/* fly-deploy/client/
cp client/nginx.conf fly-deploy/client/
cd fly-deploy/client

flyctl launch --name djforge-client --no-deploy
# Choose same region as server
```

### 3. Configure Server (fly-deploy/server/fly.toml)

Edit the generated `fly.toml` file:

```toml
app = "djforge-server"
primary_region = "sjc"  # Your chosen region

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"  # Fly uses 8080 internally
  NODE_ENV = "production"
  # Don't put secrets here!

[[services]]
  internal_port = 8080
  protocol = "tcp"
  
  [services.concurrency]
    hard_limit = 25
    soft_limit = 20
    type = "connections"

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
    
  [[services.ports]]
    port = 80
    handlers = ["http"]
    
  [[services.http_checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "10s"
    method = "get"
    path = "/api/health"
```

### 4. Update Server Dockerfile for Fly

Create `fly-deploy/server/Dockerfile.fly`:

```dockerfile
# Same as original but with PORT change
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN mkdir -p sessions && chown nodejs:nodejs sessions
USER nodejs
EXPOSE 8080
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

### 5. Set Server Secrets (like Laravel .env)

```bash
cd fly-deploy/server

# Set your secrets (similar to Laravel .env but secure)
flyctl secrets set SPOTIFY_CLIENT_ID="your_spotify_client_id"
flyctl secrets set SPOTIFY_CLIENT_SECRET="your_spotify_client_secret"
flyctl secrets set SPOTIFY_REDIRECT_URI="https://djforge-server.fly.dev/callback"
flyctl secrets set SESSION_SECRET="generate_a_random_32_char_string"
flyctl secrets set OPENROUTER_API_KEY="your_openrouter_key"

# For Redis (we'll use Upstash Redis - free tier available)
flyctl secrets set REDIS_HOST="your-upstash-redis-host.upstash.io"
flyctl secrets set REDIS_PORT="6379"
flyctl secrets set REDIS_PASSWORD="your-redis-password"
```

### 6. Configure Client (fly-deploy/client/fly.toml)

```toml
app = "djforge-client"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile.fly"
  [build.args]
    VITE_API_URL = "https://djforge-server.fly.dev"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [services.concurrency]
    hard_limit = 25
    soft_limit = 20

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
    
  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.http_checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "5s"
    method = "get"
    path = "/health"
```

### 7. Update Client Dockerfile for Fly

Create `fly-deploy/client/Dockerfile.fly`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache curl
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -u 1001 -G nginx-user
RUN chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-user /var/run/nginx.pid
USER nginx-user
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

### 8. Update nginx.conf for Fly

Update the API proxy in nginx.conf:

```nginx
# Replace the API proxy section with:
location /api {
    proxy_pass https://djforge-server.fly.dev;
    proxy_http_version 1.1;
    proxy_set_header Host djforge-server.fly.dev;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 9. Deploy!

```bash
# Deploy server first
cd fly-deploy/server
mv Dockerfile Dockerfile.original
mv Dockerfile.fly Dockerfile
flyctl deploy

# Wait for server to be running, then deploy client
cd ../client
mv Dockerfile Dockerfile.original
mv Dockerfile.fly Dockerfile
flyctl deploy
```

### 10. Update Spotify Redirect URI

Go to your Spotify App settings and add:
```
https://djforge-server.fly.dev/callback
```

## Setting up Redis (Upstash)

Unlike Laravel where you might use Redis locally, Fly.io works better with managed Redis:

1. Sign up for free at [Upstash](https://upstash.com)
2. Create a Redis database (free tier = 10,000 commands/day)
3. Copy the Redis URL and password
4. Set them as secrets in your Fly app

## Monitoring Your Apps

```bash
# View logs (like Laravel telescope)
flyctl logs -a djforge-server
flyctl logs -a djforge-client

# SSH into container (like Laravel tinker)
flyctl ssh console -a djforge-server

# View app status
flyctl status -a djforge-server

# Scale your app
flyctl scale count 2 -a djforge-server
```

## Common Issues & Solutions

### CORS Issues
If you get CORS errors, update your server's CORS config:
```javascript
app.use(cors({
  origin: ['https://djforge-client.fly.dev', 'http://localhost:5173'],
  credentials: true
}));
```

### Session Issues
Make sure your SESSION_SECRET is the same across all server instances.

### Database Connection (Redis)
If Redis connection fails:
```bash
flyctl ssh console -a djforge-server
# Test Redis connection
redis-cli -h your-redis-host.upstash.io -p 6379 -a your-password ping
```

## Comparison with Laravel Forge

| Laravel Forge | Fly.io |
|--------------|---------|
| `.env` file | `flyctl secrets` |
| `php artisan` commands | `flyctl` commands |
| Nginx config | Included in container |
| Queue workers | Separate Fly machines |
| Cron jobs | Fly scheduled machines |
| SSL certificates | Automatic |
| Deployments | `flyctl deploy` |

## Cost Comparison

- **Fly.io Free Tier**: 
  - 3 shared-cpu-1x VMs (256MB RAM each)
  - 3GB persistent storage
  - 160GB bandwidth/month

- **For DJForge**:
  - 1 VM for server = Free
  - 1 VM for client = Free
  - Redis from Upstash = Free (10k commands/day)
  - **Total: $0/month** for basic usage

## Next Steps

1. Set up GitHub Actions for automatic deployments
2. Configure monitoring with Fly metrics
3. Set up custom domain
4. Enable autoscaling for traffic spikes

## Rollback

If something goes wrong:
```bash
# List releases
flyctl releases list -a djforge-server

# Rollback to previous version
flyctl deploy --image registry.fly.io/djforge-server:v{number}
```

This is much simpler than Laravel rollbacks!