# Logging in Fly.io Deployment

## Overview

The logging system is configured to work seamlessly in both development and production (Fly.io) environments.

## Development vs Production

### Development (Local)
- Logs are written to both console (with colors) and files
- Files are stored in `./logs/` directory
- Files are rotated daily and kept for 30 days
- Multiple log files: app, error, warn, exceptions, rejections

### Production (Fly.io)
- Primary logging is to console in JSON format
- Console logs are automatically captured by Fly.io's logging system
- Optional file logging to `/tmp/logs/` (ephemeral)
- Files are smaller (10MB max) and kept for only 3 days

## Fly.io Logging Best Practices

### 1. Use Fly.io Logs Command
```bash
# View live logs
fly logs

# View logs with timestamps
fly logs --timestamps

# Filter logs by level
fly logs | grep ERROR

# Save logs to file
fly logs > production-logs.txt
```

### 2. Understanding Ephemeral Storage
- Fly.io containers have ephemeral filesystems
- Any files written to disk are lost on restart/redeploy
- `/tmp/logs/` is used for temporary file storage if needed
- Primary logging should always be to console/stdout

### 3. Permission Handling
- The app runs as non-root user (`nodejs`)
- `/tmp/logs/` directory is created with proper permissions in Dockerfile
- Logger gracefully falls back to console-only if file writing fails

## Configuration

### Environment Variables
- `NODE_ENV=production` - Enables production logging mode
- `LOG_LEVEL` - Set logging level (default: 'info')
- `LOG_TO_FILE=true` - Enable optional file logging in production

### Log Format
- **Development**: Human-readable with colors and timestamps
- **Production**: JSON format for better parsing and analysis

Example production log entry:
```json
{
  "timestamp": "2025-07-27T13:30:00.123Z",
  "level": "info",
  "message": "User authentication successful",
  "userId": "abc123",
  "duration": 45
}
```

## Monitoring and Analysis

### Using Fly.io Dashboard
1. Go to your app dashboard at https://fly.io/apps/djforge-server
2. Click on "Monitoring" tab
3. View logs, metrics, and health checks

### Setting Up Alerts
You can set up alerts for errors using Fly.io's monitoring:
```bash
fly secrets set SENTRY_DSN=your-sentry-dsn
```

### Log Aggregation Services
For production logging, consider integrating with:
- **Logtail**: `fly logs | logtail`
- **Datadog**: Built-in Fly.io integration
- **Papertrail**: Remote syslog endpoint

## Troubleshooting

### Common Issues

1. **"Failed to create logs directory" warning**
   - This is expected in some Fly.io configurations
   - The app will continue working with console-only logging

2. **No log files in production**
   - Check if `LOG_TO_FILE=true` is set
   - Remember files are ephemeral and deleted on restart

3. **JSON logs hard to read**
   - Use `jq` for pretty printing: `fly logs | jq`
   - Or use Fly.io dashboard for formatted view

### Debug Commands
```bash
# Check if logs directory exists in container
fly ssh console -C "ls -la /tmp/logs"

# Check app environment
fly ssh console -C "printenv | grep -E 'NODE_ENV|LOG_'"

# View recent errors only
fly logs | grep -E '"level":"error"' | jq
```

## Best Practices

1. **Use Structured Logging**
   ```typescript
   logger.info('API request processed', {
     endpoint: '/api/control/play',
     userId: req.user.id,
     duration: responseTime
   });
   ```

2. **Don't Log Sensitive Data**
   - Never log passwords, tokens, or API keys
   - Use hashed user IDs when possible

3. **Use Appropriate Log Levels**
   - `error`: Application errors that need attention
   - `warn`: Warnings that might need investigation
   - `info`: General application flow
   - `debug`: Detailed debugging information

4. **Monitor Log Volume**
   - Excessive logging can impact performance
   - Use LOG_LEVEL to control verbosity

## Migration from File-Based Logging

If you were relying on file-based logs:

1. **Export Historical Logs**
   ```bash
   fly ssh console -C "cat /tmp/logs/*.log" > historical-logs.txt
   ```

2. **Use Log Streaming**
   ```bash
   # Stream to local file
   fly logs --no-tail > logs/production-$(date +%Y-%m-%d).log
   ```

3. **Set Up Log Aggregation**
   - Configure external logging service
   - Use Fly.io's built-in integrations

## Summary

The logging system is designed to:
- Work seamlessly in both environments
- Gracefully handle permission issues
- Provide structured logging for production
- Integrate with Fly.io's logging infrastructure
- Maintain development convenience while ensuring production reliability