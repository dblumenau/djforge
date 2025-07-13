import { RedisClientType } from 'redis';

/**
 * Redis conversation history management for contextual command understanding
 */

export interface ConversationEntry {
  command: string;
  interpretation: {
    intent: string;
    artist?: string;
    track?: string;
    album?: string;
    query?: string;
    confidence: number;
    reasoning?: string;
    alternatives?: string[];
    searchQuery?: string;
  };
  timestamp: number;
  response?: {
    success: boolean;
    message: string;
  };
}

export class RedisConversation {
  private client: any;
  private readonly prefix = 'djforge:conv:';
  private readonly maxEntries = 8; // Keep last 8 interactions
  private readonly ttl = 1800; // 30 minutes in seconds
  
  constructor(client: any) {
    this.client = client;
  }
  
  /**
   * Get conversation history for a session
   * @param sessionId - The session ID
   * @param limit - Number of entries to retrieve (default: 3)
   * @returns Array of conversation entries, newest first
   */
  async getHistory(sessionId: string, limit: number = 3): Promise<ConversationEntry[]> {
    if (!sessionId || !this.client) {
      return [];
    }
    
    try {
      const key = `${this.prefix}${sessionId}`;
      
      // Get the most recent entries (LRANGE 0 to limit-1)
      const entries = await this.client.lRange(key, 0, limit - 1);
      
      // Parse and return entries
      return entries.map((entry: string) => {
        try {
          return JSON.parse(entry);
        } catch {
          return null;
        }
      }).filter((entry: ConversationEntry | null) => entry !== null) as ConversationEntry[];
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }
  
  /**
   * Append a new conversation entry
   * @param sessionId - The session ID
   * @param entry - The conversation entry to add
   */
  async append(sessionId: string, entry: ConversationEntry): Promise<void> {
    if (!sessionId || !this.client) {
      return;
    }
    
    try {
      const key = `${this.prefix}${sessionId}`;
      
      // Sanitize the entry to prevent injection
      const sanitizedEntry = this.sanitizeEntry(entry);
      const serialized = JSON.stringify(sanitizedEntry);
      
      // Use a Lua script for atomic operations
      const luaScript = `
        redis.call('LPUSH', KEYS[1], ARGV[1])
        redis.call('LTRIM', KEYS[1], 0, ARGV[2])
        redis.call('EXPIRE', KEYS[1], ARGV[3])
        return redis.call('LLEN', KEYS[1])
      `;
      
      await this.client.eval(
        luaScript,
        {
          keys: [key],
          arguments: [serialized, String(this.maxEntries - 1), String(this.ttl)]
        }
      );
    } catch (error) {
      console.error('Error appending to conversation history:', error);
    }
  }
  
  /**
   * Clear conversation history for a session
   * @param sessionId - The session ID
   */
  async clear(sessionId: string): Promise<void> {
    if (!sessionId || !this.client) {
      return;
    }
    
    try {
      const key = `${this.prefix}${sessionId}`;
      await this.client.del(key);
    } catch (error) {
      console.error('Error clearing conversation history:', error);
    }
  }
  
  /**
   * Check if a command is a contextual reference
   * @param command - The user command
   * @returns True if the command appears to reference previous context
   */
  isContextualReference(command: string): boolean {
    const lowerCommand = command.toLowerCase();
    
    // Patterns that indicate contextual references
    const contextualPatterns = [
      /^(no|not that one|nope)/,
      /^(yes|yeah|yep|that one)/,
      /^the .* one$/,
      /^actually/,
      /^try the/,
      /^play the .* (one|version)$/,
      /^queue the .* (one|version)$/,
      /instead$/,
      /^(first|second|third|fourth|fifth|last) one$/,
      /^the other/,
      /^that one/
    ];
    
    return contextualPatterns.some(pattern => pattern.test(lowerCommand));
  }
  
  /**
   * Sanitize entry to prevent prompt injection
   * @param entry - The conversation entry
   * @returns Sanitized entry
   */
  private sanitizeEntry(entry: ConversationEntry): ConversationEntry {
    const sanitizeString = (str: string): string => {
      return str.replace(/[{}`]/g, '').substring(0, 500);
    };
    
    return {
      ...entry,
      command: sanitizeString(entry.command),
      interpretation: {
        ...entry.interpretation,
        reasoning: entry.interpretation.reasoning ? 
          sanitizeString(entry.interpretation.reasoning) : undefined,
        alternatives: entry.interpretation.alternatives?.map(alt => sanitizeString(alt))
      }
    };
  }
  
  /**
   * Resolve a contextual reference from history
   * @param command - The contextual command (e.g., "no the taylor swift one")
   * @param history - Recent conversation history
   * @returns Resolved interpretation or null
   */
  resolveContextualReference(
    command: string, 
    history: ConversationEntry[]
  ): { artist: string; track: string; confidence: number } | null {
    if (history.length === 0) {
      return null;
    }
    
    const lowerCommand = command.toLowerCase();
    
    // Look for alternatives in recent history
    for (const entry of history) {
      if (entry.interpretation.alternatives && entry.interpretation.alternatives.length > 0) {
        // Check each alternative for matches
        for (const alternative of entry.interpretation.alternatives) {
          const lowerAlt = alternative.toLowerCase();
          
          // Extract key terms from the command
          const searchTerms = lowerCommand
            .replace(/^(no|not|yes|the|play|queue|actually|try)\s+/g, '')
            .replace(/\s+(one|version)$/g, '')
            .split(/\s+/);
          
          // Check if all search terms appear in the alternative
          const matches = searchTerms.every(term => 
            lowerAlt.includes(term) || 
            // Special handling for common artist references
            (term === 'taylor' && lowerAlt.includes('taylor swift')) ||
            (term === 'swift' && lowerAlt.includes('taylor swift'))
          );
          
          if (matches) {
            // Parse the alternative format "Artist - Song"
            const parts = alternative.split(' - ');
            if (parts.length >= 2) {
              return {
                artist: parts[0].trim(),
                track: parts.slice(1).join(' - ').trim(),
                confidence: 0.9
              };
            }
          }
        }
      }
    }
    
    return null;
  }
}

// Helper to create conversation manager with existing Redis client
export function createConversationManager(redisClient: any): RedisConversation | null {
  if (!redisClient) {
    console.warn('No Redis client available for conversation management');
    return null;
  }
  
  return new RedisConversation(redisClient);
}