# Docker Deployment Guide for DJForge

## Overview

DJForge is fully containerized with Docker, supporting both development and production deployments. The application consists of three main services:
- **Client**: React frontend served by Nginx
- **Server**: Node.js Express API
- **Redis**: Session management and caching

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB+ available RAM
- Configured `.env` file

## Quick Start

### 1. Configure Environment

```bash
# Copy the Docker environment template
cp .env.docker .env

# Edit .env with your configuration
# Required: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, OPENROUTER_API_KEY
```

### 2. Build and Run (Development)

```bash
# Build containers
./build-docker.sh development

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

Access the application:
- Frontend: http://localhost:8080
- API: http://localhost:3001
- Redis: localhost:6379

### 3. Build and Run (Production)

```bash
# Build for production
./build-docker.sh production

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

## Container Architecture

### Development Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Nginx:8080    │────▶│  Express:3001   │────▶│   Redis:6379    │
│   (React App)   │     │   (API Server)  │     │  (Session Store)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Production Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Nginx:8080    │────▶│  Express:3001   │────▶│  External Redis │
│   (Optimized)   │     │  (Production)   │     │   (Managed)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Configuration

### Environment Variables

#### Server Configuration
```env
# Spotify OAuth
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://your-domain.com/callback

# Session Secret
SESSION_SECRET=generate_a_secure_random_string

# Redis (Docker development)
REDIS_HOST=redis
REDIS_PORT=6379

# Redis (Production - external)
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# OpenRouter API
OPENROUTER_API_KEY=your_api_key
```

#### Client Configuration
```env
# API URL for client build
VITE_API_URL=http://localhost:3001
```

### Docker Compose Files

- `docker-compose.yml`: Development configuration with local Redis
- `docker-compose.prod.yml`: Production configuration for external Redis

## Security Considerations

### 1. Non-Root Users
All containers run as non-root users:
- Server: `nodejs` (UID 1001)
- Client: `nginx-user` (UID 1001)

### 2. Health Checks
Each service includes health checks:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:PORT/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### 3. Resource Limits (Production)
Add resource limits to `docker-compose.prod.yml`:
```yaml
services:
  server:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 4. Network Security
- Internal services communicate via Docker network
- Only necessary ports are exposed
- Nginx acts as reverse proxy for API calls

## Deployment Scenarios

### 1. Single Host Deployment
```bash
# On your server
git clone https://github.com/yourusername/djforge.git
cd djforge
cp .env.production .env
./build-docker.sh production
docker-compose -f docker-compose.prod.yml up -d
```

### 2. Docker Swarm Deployment
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml djforge
```

### 3. Kubernetes Deployment
Convert docker-compose to Kubernetes manifests:
```bash
# Install kompose
curl -L https://github.com/kubernetes/kompose/releases/download/v1.28.0/kompose-linux-amd64 -o kompose

# Convert
./kompose convert -f docker-compose.prod.yml
```

## Monitoring

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server
docker-compose logs -f client

# Last 100 lines
docker-compose logs --tail=100 server
```

### Monitor Resources
```bash
# Resource usage
docker stats

# Detailed inspection
docker inspect djforge-server
```

### Health Status
```bash
# Check health endpoints
curl http://localhost:3001/api/health
curl http://localhost:8080/health

# Docker health status
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Maintenance

### Backup
```bash
# Backup Redis data
docker-compose exec redis redis-cli SAVE
docker cp djforge-redis:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb

# Backup sessions (if using file storage)
tar -czf sessions-backup-$(date +%Y%m%d).tar.gz ./sessions
```

### Update Containers
```bash
# Pull latest code
git pull

# Rebuild containers
./build-docker.sh production no-cache

# Rolling update
docker-compose -f docker-compose.prod.yml up -d --no-deps --build server
docker-compose -f docker-compose.prod.yml up -d --no-deps --build client
```

### Clean Up
```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# Clean up images
docker image prune -a

# Full cleanup
docker system prune -a --volumes
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs server

# Verify environment
docker-compose config

# Check port availability
lsof -i :3001
lsof -i :8080
```

### Redis Connection Issues
```bash
# Test Redis connection
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis

# Verify network
docker network ls
docker network inspect djforge_default
```

### Permission Issues
```bash
# Fix session directory permissions
docker-compose exec server chown -R nodejs:nodejs /app/sessions

# Fix nginx permissions
docker-compose exec client chown -R nginx-user:nginx-user /usr/share/nginx/html
```

### Performance Tuning
```bash
# Increase Node.js memory
docker-compose exec server node --max-old-space-size=512 dist/server.js

# Monitor memory usage
docker stats --no-stream
```

## Production Checklist

- [ ] Set strong `SESSION_SECRET`
- [ ] Configure external Redis with password
- [ ] Enable HTTPS (reverse proxy)
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation
- [ ] Set resource limits
- [ ] Enable automatic restarts
- [ ] Configure backup strategy
- [ ] Set up health check alerts
- [ ] Document rollback procedure

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker images
        run: |
          docker-compose -f docker-compose.prod.yml build
      
      - name: Push to registry
        run: |
          docker tag djforge-server:latest ${{ secrets.REGISTRY }}/djforge-server:latest
          docker push ${{ secrets.REGISTRY }}/djforge-server:latest
```

## Support

For issues related to Docker deployment:
1. Check container logs
2. Verify environment configuration
3. Ensure all required ports are available
4. Check Docker daemon status
5. Review security group/firewall rules

Happy containerizing! 🐳