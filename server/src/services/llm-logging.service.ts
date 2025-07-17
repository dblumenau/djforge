import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LLMLogEntry {
  id: string;
  timestamp: number;
  userId: string;          // Hashed Spotify user ID
  sessionId: string;
  command: string;
  interpretation: object;
  llmRequest: {
    model: string;         // Fixed: actual model used
    provider: string;      // "openrouter", "google", etc.
    flow: string;          // "openrouter" or "gemini-direct"
    messages: any[];
    temperature: number;
    jsonMode?: boolean;    // Whether JSON mode was requested
    grounding?: boolean;   // Whether grounding was enabled (Gemini only)
  };
  llmResponse: {
    content: string;
    usage?: TokenUsage;
    latency: number;
    fallbackUsed?: boolean; // Whether a fallback model was used
    actualModel?: string;   // Actual model if different from requested
  };
  result: {
    success: boolean;
    message: string;
  };
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  flow?: 'openrouter' | 'gemini-direct';
  provider?: string;
  model?: string;
}

export interface LogResult {
  logs: LLMLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  stats?: {
    totalQueries: number;
    modelDistribution: Record<string, number>;
    avgLatency: number;
  };
}

export class LLMLoggingService {
  private redis: any; // node-redis client
  private retentionDays: number;

  constructor(redis: any) {
    this.redis = redis;
    this.retentionDays = parseInt(process.env.LOG_RETENTION_DAYS || '90', 10);
    
    // Check if Redis client is connected
    if (!redis.isOpen) {
      console.warn('⚠️  Redis client is not connected. Logging service may not work properly.');
    }
  }

  /**
   * Hash user ID for privacy
   */
  private hashUserId(userId: string): string {
    return createHash('sha256').update(userId).digest('hex').substring(0, 16);
  }

  /**
   * Get date key for daily sorted sets
   */
  private getDateKey(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Log an LLM interaction
   */
  async logInteraction(entry: Omit<LLMLogEntry, 'id'>): Promise<void> {
    try {
      const id = uuidv4();
      const fullEntry: LLMLogEntry = { ...entry, id };
      const dateKey = this.getDateKey(new Date(entry.timestamp));

      // Store individual log entry
      const logKey = `llm:log:${id}`;
      const flattenedData = this.flattenObject(fullEntry);
      
      // Convert to array of field-value pairs for hSet
      const fieldValues: string[] = [];
      for (const [field, value] of Object.entries(flattenedData)) {
        fieldValues.push(field, value);
      }
      fieldValues.push('_raw', JSON.stringify(fullEntry));
      
      await this.redis.hSet(logKey, fieldValues);
      await this.redis.expire(logKey, this.retentionDays * 24 * 60 * 60);

      // Add to daily sorted set
      const dailyKey = `llm:logs:${dateKey}`;
      await this.redis.zAdd(dailyKey, { score: entry.timestamp, value: id });
      await this.redis.expire(dailyKey, this.retentionDays * 24 * 60 * 60);

      // Add to user index
      const userKey = `llm:user:${entry.userId}:logs`;
      await this.redis.zAdd(userKey, { score: entry.timestamp, value: id });
      await this.redis.expire(userKey, this.retentionDays * 24 * 60 * 60);

      // Update daily stats
      await this.updateDailyStats(dateKey, fullEntry);
    } catch (error) {
      console.error('Failed to log LLM interaction:', error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Get logs with filtering and pagination
   */
  async getLogs(options: QueryOptions = {}): Promise<LogResult> {
    const {
      limit = 50,
      offset = 0,
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default: last 7 days
      endDate = new Date(),
      userId,
      flow,
      provider,
      model
    } = options;

    try {
      // Get all log IDs from date range
      const logIds = await this.getLogIdsFromDateRange(startDate, endDate);

      // Filter logs
      const logs: LLMLogEntry[] = [];
      for (const logId of logIds) {
        const log = await this.getLogById(logId);
        if (log && this.matchesFilters(log, { userId, flow, provider, model })) {
          logs.push(log);
        }
      }

      // Sort by timestamp descending
      logs.sort((a, b) => b.timestamp - a.timestamp);

      // Apply pagination
      const paginatedLogs = logs.slice(offset, offset + limit);

      // Calculate stats
      const stats = await this.calculateStats(logs);

      return {
        logs: paginatedLogs,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          total: logs.length
        },
        stats
      };
    } catch (error) {
      console.error('Failed to get logs:', error);
      return {
        logs: [],
        pagination: { page: 1, limit, total: 0 }
      };
    }
  }

  /**
   * Get logs by user
   */
  async getLogsByUser(userId: string): Promise<LLMLogEntry[]> {
    try {
      const hashedUserId = this.hashUserId(userId);
      const userKey = `llm:user:${hashedUserId}:logs`;
      
      // Get last 100 logs for user
      const logIds = await this.redis.zRange(userKey, 0, 99, { REV: true });
      
      const logs: LLMLogEntry[] = [];
      for (const logId of logIds) {
        const log = await this.getLogById(logId);
        if (log) logs.push(log);
      }
      
      return logs;
    } catch (error) {
      console.error('Failed to get logs by user:', error);
      return [];
    }
  }

  /**
   * Search logs by query
   */
  async searchLogs(query: string): Promise<LLMLogEntry[]> {
    try {
      // Get recent logs (last 7 days)
      const endDate = new Date();
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const logIds = await this.getLogIdsFromDateRange(startDate, endDate);

      const logs: LLMLogEntry[] = [];
      const queryLower = query.toLowerCase();

      for (const logId of logIds) {
        const log = await this.getLogById(logId);
        if (log && this.logMatchesQuery(log, queryLower)) {
          logs.push(log);
        }
      }

      // Sort by timestamp descending
      logs.sort((a, b) => b.timestamp - a.timestamp);

      return logs.slice(0, 100); // Return max 100 results
    } catch (error) {
      console.error('Failed to search logs:', error);
      return [];
    }
  }

  /**
   * Get logs by flow type
   */
  async getLogsByFlow(flow: 'openrouter' | 'gemini-direct'): Promise<LLMLogEntry[]> {
    return this.getLogs({ flow }).then(result => result.logs);
  }

  /**
   * Get logs by provider
   */
  async getLogsByProvider(provider: string): Promise<LLMLogEntry[]> {
    return this.getLogs({ provider }).then(result => result.logs);
  }

  /**
   * Get a single log by ID
   */
  private async getLogById(logId: string): Promise<LLMLogEntry | null> {
    try {
      const logKey = `llm:log:${logId}`;
      const rawData = await this.redis.hGet(logKey, '_raw');
      if (!rawData) return null;
      return JSON.parse(rawData);
    } catch (error) {
      console.error(`Failed to get log ${logId}:`, error);
      return null;
    }
  }

  /**
   * Get log IDs from date range
   */
  private async getLogIdsFromDateRange(startDate: Date, endDate: Date): Promise<string[]> {
    const logIds: string[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = this.getDateKey(currentDate);
      const dailyKey = `llm:logs:${dateKey}`;
      const dayLogs = await this.redis.zRange(dailyKey, 0, -1);
      logIds.push(...dayLogs);
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return logIds;
  }

  /**
   * Check if log matches filters
   */
  private matchesFilters(log: LLMLogEntry, filters: Partial<QueryOptions>): boolean {
    if (filters.userId && log.userId !== this.hashUserId(filters.userId)) return false;
    if (filters.flow && log.llmRequest.flow !== filters.flow) return false;
    if (filters.provider && log.llmRequest.provider !== filters.provider) return false;
    if (filters.model && log.llmRequest.model !== filters.model) return false;
    return true;
  }

  /**
   * Check if log matches search query
   */
  private logMatchesQuery(log: LLMLogEntry, query: string): boolean {
    // Search in command
    if (log.command.toLowerCase().includes(query)) return true;
    
    // Search in interpretation
    const interpretationStr = JSON.stringify(log.interpretation).toLowerCase();
    if (interpretationStr.includes(query)) return true;
    
    // Search in result message
    if (log.result.message.toLowerCase().includes(query)) return true;
    
    return false;
  }

  /**
   * Update daily statistics
   */
  private async updateDailyStats(dateKey: string, entry: LLMLogEntry): Promise<void> {
    const statsKey = `llm:stats:daily:${dateKey}`;
    
    // Increment total queries
    await this.redis.hIncrBy(statsKey, 'totalQueries', 1);
    
    // Update model distribution
    await this.redis.hIncrBy(statsKey, `model:${entry.llmRequest.model}`, 1);
    
    // Update provider distribution
    await this.redis.hIncrBy(statsKey, `provider:${entry.llmRequest.provider}`, 1);
    
    // Update flow distribution
    await this.redis.hIncrBy(statsKey, `flow:${entry.llmRequest.flow}`, 1);
    
    // Update latency stats (stored as sum and count for averaging)
    await this.redis.hIncrByFloat(statsKey, 'latencySum', entry.llmResponse.latency);
    await this.redis.hIncrBy(statsKey, 'latencyCount', 1);
    
    // Set expiration
    await this.redis.expire(statsKey, this.retentionDays * 24 * 60 * 60);
  }

  /**
   * Calculate statistics from logs
   */
  private async calculateStats(logs: LLMLogEntry[]): Promise<LogResult['stats']> {
    const modelDistribution: Record<string, number> = {};
    let totalLatency = 0;

    for (const log of logs) {
      // Model distribution
      const model = log.llmRequest.model;
      modelDistribution[model] = (modelDistribution[model] || 0) + 1;
      
      // Latency
      totalLatency += log.llmResponse.latency;
    }

    return {
      totalQueries: logs.length,
      modelDistribution,
      avgLatency: logs.length > 0 ? Math.round(totalLatency / logs.length) : 0
    };
  }

  /**
   * Flatten nested object for Redis hash storage
   */
  private flattenObject(obj: any, prefix = ''): Record<string, string> {
    const flattened: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value === null || value === undefined) {
        flattened[fullKey] = '';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, fullKey));
      } else {
        flattened[fullKey] = String(value);
      }
    }
    
    return flattened;
  }
}