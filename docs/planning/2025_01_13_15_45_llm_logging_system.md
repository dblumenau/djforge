# Comprehensive LLM Logging System Implementation Plan

## Executive Summary
Implement a comprehensive logging system to capture all LLM queries and responses in DJ Forge, with Redis persistence and admin-only access. The system will fix the model tracking bug and provide valuable insights for debugging and optimization.

## Consensus Analysis Summary
- **Gemini Pro (9/10)**: Strong endorsement - technically sound, aligns with best practices
- **Claude Opus (6/10)**: Cautious - concerns about complexity for alpha stage
- **Key Agreement**: Service Layer Pattern at orchestrator level is correct approach

## Architecture Overview
```
User Request → simple-llm-interpreter → llmOrchestrator
                                              ↓
                                    LLMLoggingService (async)
                                              ↓
                                           Redis
```

## Implementation Phases

### Phase 1: Core Infrastructure (Priority 1)
**1.1 Create LLMLoggingService**
- File: `server/src/services/llm-logging.service.ts`
- Key methods:
  - `async logInteraction(entry: LLMLogEntry): Promise<void>`
  - `async getLogs(options: QueryOptions): Promise<LogResult>`
  - `async getLogsByUser(userId: string): Promise<LogEntry[]>`
  - `async searchLogs(query: string): Promise<LogEntry[]>`

**1.2 Redis Data Structure**
```typescript
// Daily sorted set for time-based queries
Key: llm:logs:YYYY-MM-DD (score = timestamp)

// Individual log entries
Key: llm:log:{uuid} (hash with all fields)

// User index for filtering
Key: llm:user:{userId}:logs (sorted set)

// Daily stats
Key: llm:stats:daily:YYYY-MM-DD (hash)
```

### Phase 2: Fix Model Tracking Bug (Priority 1)
**2.1 Modify llmOrchestrator**
- Update `complete()` method to include model in response
- Change return type to include `{ content, model, provider }`

**2.2 Update simple-llm-interpreter**
- Receive model info from orchestrator response
- Pass model through to interpretation object
- Remove hardcoded "unknown" value

### Phase 3: User Authentication (Priority 2)
**3.1 Add Spotify Profile Fetching**
- Add to `server/src/spotify/control.ts`:
```typescript
async getUserProfile(): Promise<SpotifyUser> {
  const response = await this.api.get('/me');
  // Cache in Redis with 1-hour TTL
  const cacheKey = `user:profile:${response.data.id}`;
  await this.redis.setex(cacheKey, 3600, JSON.stringify(response.data));
  return response.data;
}
```

**3.2 Admin Check Using Spotify ID**
```typescript
// Use Spotify user ID from environment variable
const ADMIN_SPOTIFY_ID = process.env.ADMIN_SPOTIFY_ID || '';

const isAdmin = (spotifyUserId: string): boolean => {
  return spotifyUserId === ADMIN_SPOTIFY_ID;
};
```

**3.3 Update .env.example**
```bash
# Existing variables...

# Admin access for LLM logs (Spotify user ID)
ADMIN_SPOTIFY_ID=your_spotify_user_id_here
```

### Phase 4: API Endpoints (Priority 2)
**4.1 Create Routes** (`server/src/routes/llm-logs.ts`)
```typescript
// Admin middleware
const requireAdmin = async (req, res, next) => {
  try {
    const spotifyControl = new SpotifyControl(req.spotifyTokens);
    const profile = await spotifyControl.getUserProfile();
    
    if (!isAdmin(profile.id)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.userProfile = profile;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Routes
router.get('/api/llm-logs/recent', ensureValidToken, requireAdmin, async (req, res) => {
  // Return last 100 logs
});

router.get('/api/llm-logs/search', ensureValidToken, requireAdmin, async (req, res) => {
  // Search logs by query
});

router.get('/api/llm-logs/stats', ensureValidToken, requireAdmin, async (req, res) => {
  // Return usage statistics
});

router.get('/api/llm-logs/by-date', ensureValidToken, requireAdmin, async (req, res) => {
  // Return logs for specific date
});
```

**4.2 Response Format**
```json
{
  "logs": [...],
  "pagination": { "page": 1, "limit": 50, "total": 1234 },
  "stats": {
    "totalQueries": 1234,
    "modelDistribution": { "claude-sonnet-4": 800, "o3-pro": 434 },
    "avgLatency": 523
  }
}
```

### Phase 5: Integration & Testing (Priority 3)
**5.1 Wire Up Logging**
- Integrate LLMLoggingService in llmOrchestrator
- Ensure async/non-blocking operation
- Add comprehensive error handling

**5.2 Testing Strategy**
- Unit tests for LLMLoggingService
- Integration tests for full flow
- Performance benchmarking
- Redis failure simulation

## Critical Implementation Details

### Graceful Failure Handling
```typescript
try {
  await this.loggingService.logInteraction(entry);
} catch (error) {
  console.error('Logging failed:', error);
  // DO NOT throw - continue normal operation
}
```

### Log Entry Schema
```typescript
interface LLMLogEntry {
  id: string;
  timestamp: number;
  userId: string;          // Hashed Spotify user ID
  sessionId: string;
  command: string;
  interpretation: object;
  llmRequest: {
    model: string;         // Fixed: actual model used
    messages: any[];
    temperature: number;
  };
  llmResponse: {
    content: string;
    usage?: TokenUsage;
    latency: number;
  };
  result: {
    success: boolean;
    message: string;
  };
}
```

## Configuration Changes
**Add to .env.example:**
```bash
# LLM Logging Configuration
ADMIN_SPOTIFY_ID=your_spotify_user_id_here
LOG_RETENTION_DAYS=90
```

## Risk Mitigation
1. **Performance**: Async logging with circuit breaker pattern
2. **Storage**: 90-day TTL on all Redis keys
3. **Privacy**: Hashed user IDs, admin-only access via Spotify ID
4. **Reliability**: Graceful degradation if Redis unavailable

## Success Metrics
- ✓ All LLM interactions logged with correct model
- ✓ Zero performance degradation (<5ms added latency)
- ✓ Admin can search/filter logs effectively
- ✓ System continues working if Redis fails
- ✓ Admin access controlled by Spotify user ID from env

## Next Steps
Ready to implement this system incrementally, starting with the core logging infrastructure and model tracking fix. The admin Spotify ID approach is more secure than unverified email.