# Redis Setup for DJForge

## Overview

DJForge now supports Redis for session management, providing better scalability and performance compared to file-based sessions.

## Features

✅ **Automatic Fallback**: If Redis is unavailable, the application automatically falls back to file-based sessions  
✅ **Session Management API**: Monitor and manage sessions through REST endpoints  
✅ **Health Monitoring**: Built-in Redis health checks and connection monitoring  
✅ **Graceful Shutdown**: Proper cleanup of Redis connections on server shutdown  

## Installation

### Local Development (macOS)

```bash
# Install Redis using Homebrew
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### Local Development (Ubuntu/Debian)

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis
sudo systemctl start redis
sudo systemctl enable redis

# Verify
redis-cli ping
```

### Docker Development

```bash
# Run Redis in Docker
docker run -d --name redis-djforge -p 6379:6379 redis:7-alpine

# Verify
docker exec redis-djforge redis-cli ping
```

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Redis Configuration (for session management)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_redis_password_here  # Optional
# REDIS_DB=0                               # Optional, default is 0
```

### Production Configuration

For production, consider:

- **Password protection**: Set `REDIS_PASSWORD`
- **Separate database**: Use `REDIS_DB=1` (or higher) for isolation
- **Remote Redis**: Use managed Redis service (AWS ElastiCache, Redis Cloud, etc.)

```env
# Production example
REDIS_HOST=your-redis-instance.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=1
```

## Session Management API

### Check Session Statistics

```bash
curl http://localhost:3001/api/sessions/stats
```

Response:
```json
{
  "sessionStore": "redis",
  "sessionCount": 5,
  "memoryUsage": {
    "used_memory": "1024000",
    "used_memory_human": "1.00M"
  },
  "timestamp": "2025-07-12T22:45:00.000Z"
}
```

### Get All Sessions (Admin)

```bash
curl http://localhost:3001/api/sessions/sessions
```

### Clean Expired Sessions

```bash
curl -X POST http://localhost:3001/api/sessions/cleanup
```

### Get Redis Information

```bash
curl http://localhost:3001/api/sessions/redis-info
```

## Health Monitoring

Check application health including Redis status:

```bash
curl http://localhost:3001/api/health
```

Response with Redis:
```json
{
  "status": "ok",
  "timestamp": "2025-07-12T22:45:00.000Z",
  "sessionStore": "redis",
  "redis": "healthy"
}
```

Response without Redis (fallback):
```json
{
  "status": "ok",
  "timestamp": "2025-07-12T22:45:00.000Z",
  "sessionStore": "file"
}
```

## Benefits

### Redis vs File-based Sessions

| Feature | Redis | File-based |
|---------|-------|------------|
| **Performance** | High | Medium |
| **Scalability** | Excellent | Limited |
| **Multi-instance** | ✅ Yes | ❌ No |
| **Memory Usage** | Efficient | Higher |
| **Persistence** | Configurable | Always |
| **Setup Complexity** | Medium | Low |

### Production Benefits

1. **Session Sharing**: Multiple server instances can share sessions
2. **Performance**: Faster session lookup and storage
3. **Memory Efficiency**: Redis handles memory management automatically
4. **Monitoring**: Built-in session statistics and management
5. **Scalability**: Handles thousands of concurrent sessions

## Troubleshooting

### Redis Connection Issues

If you see warnings like:
```
⚠️  Redis unavailable, falling back to file-based sessions: Connection refused
```

**Solutions:**

1. **Start Redis service**:
   ```bash
   # macOS
   brew services start redis
   
   # Ubuntu
   sudo systemctl start redis
   ```

2. **Check Redis is running**:
   ```bash
   redis-cli ping
   ```

3. **Verify environment variables**:
   ```bash
   echo $REDIS_HOST $REDIS_PORT
   ```

### Memory Issues

If Redis uses too much memory:

1. **Set memory limit**:
   ```bash
   redis-cli CONFIG SET maxmemory 100mb
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

2. **Monitor memory usage**:
   ```bash
   curl http://localhost:3001/api/sessions/stats
   ```

### Session Cleanup

Clean up expired sessions manually:
```bash
curl -X POST http://localhost:3001/api/sessions/cleanup
```

## Development Tips

1. **Local Testing**: Use Docker for consistent Redis environment
2. **Session Inspection**: Use Redis CLI to inspect sessions directly
3. **Monitoring**: Check `/api/sessions/stats` regularly during development
4. **Fallback Testing**: Stop Redis to test file-based fallback behavior

```bash
# Inspect sessions directly
redis-cli
> KEYS djforge:sess:*
> GET djforge:sess:your-session-id
```

This Redis implementation ensures DJForge is production-ready with robust session management!