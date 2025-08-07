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
    alternatives?: (string | {
      intent?: string;
      query?: string;
      theme?: string;
      enhancedQuery?: string;
      isAIDiscovery?: boolean;
      aiReasoning?: string;
    })[];
    searchQuery?: string;
  };
  timestamp: number;
  response?: any; // Allow full response object to preserve UI data
}

export interface DialogState {
  last_action: {
    type: 'play' | 'queue';
    intent: string;
    artist?: string;
    track?: string;
    album?: string;
    query?: string;
    timestamp: number;
    alternatives?: (string | {
      intent?: string;
      query?: string;
      theme?: string;
      enhancedQuery?: string;
      isAIDiscovery?: boolean;
      aiReasoning?: string;
    })[];
  } | null;
  last_candidates: (string | {
    intent?: string;
    query?: string;
    theme?: string;
    enhancedQuery?: string;
    isAIDiscovery?: boolean;
    aiReasoning?: string;
  })[]; // alternatives from last response
  interaction_mode: 'music' | 'chat';
  updated_at: number;
}

export class RedisConversation {
  private client: any;
  private readonly prefix = 'djforge:conv:';
  private readonly statePrefix = 'djforge:state:';
  private readonly maxEntries = 8; // Keep last 8 interactions
  private readonly ttl = 2592000; // 30 days in seconds (matches session TTL)
  
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
   * Get or create dialog state for a session
   * @param sessionId - The session ID
   * @returns Dialog state object
   */
  async getDialogState(sessionId: string): Promise<DialogState> {
    if (!sessionId || !this.client) {
      return this.createDefaultDialogState();
    }
    
    try {
      const key = `${this.statePrefix}${sessionId}`;
      const stateData = await this.client.get(key);
      
      if (!stateData) {
        return this.createDefaultDialogState();
      }
      
      return JSON.parse(stateData);
    } catch (error) {
      console.error('Error getting dialog state:', error);
      return this.createDefaultDialogState();
    }
  }
  
  /**
   * Update dialog state for a session
   * @param sessionId - The session ID
   * @param state - The updated dialog state
   */
  async updateDialogState(sessionId: string, state: DialogState): Promise<void> {
    if (!sessionId || !this.client) {
      return;
    }
    
    try {
      const key = `${this.statePrefix}${sessionId}`;
      state.updated_at = Date.now();
      
      await this.client.setEx(key, this.ttl, JSON.stringify(state));
    } catch (error) {
      console.error('Error updating dialog state:', error);
    }
  }
  
  /**
   * Create default dialog state
   * @returns Default dialog state
   */
  private createDefaultDialogState(): DialogState {
    return {
      last_action: null,
      last_candidates: [],
      interaction_mode: 'music',
      updated_at: Date.now()
    };
  }
  
  /**
   * Check if a command is a similarity request
   * @param command - The user command
   * @returns True if requesting similar content
   */
  isSimilarityRequest(command: string): boolean {
    const lowerCommand = command.toLowerCase();
    
    const similarityPatterns = [
      /similar/,
      /like (that|this|it)/,
      /more of (that|this|the same)/,
      /same (style|genre|vibe)/,
      /playlist.*similar/,
      /queue.*similar/,
      /play.*similar/
    ];
    
    return similarityPatterns.some(pattern => pattern.test(lowerCommand));
  }
  
  /**
   * Check if an intent is destructive (plays/queues music)
   * @param intent - The intent string
   * @returns True if intent causes music to play
   */
  isDestructiveAction(intent: string): boolean {
    const destructiveIntents = [
      'play_specific_song',
      'queue_specific_song',
      'play_playlist',
      'queue_playlist',
    ];
    
    return destructiveIntents.includes(intent) || intent.includes('play') || intent.includes('queue');
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
        alternatives: entry.interpretation.alternatives?.map(alt => {
          // Handle both string and object alternatives
          if (typeof alt === 'string') {
            return sanitizeString(alt);
          } else if (typeof alt === 'object' && alt !== null) {
            // For object alternatives (GPT-5 format), sanitize string fields
            return {
              ...alt,
              query: alt.query ? sanitizeString(alt.query) : undefined,
              enhancedQuery: alt.enhancedQuery ? sanitizeString(alt.enhancedQuery) : undefined,
              aiReasoning: alt.aiReasoning ? sanitizeString(alt.aiReasoning) : undefined,
              theme: alt.theme ? sanitizeString(alt.theme) : undefined
            };
          }
          return alt;
        })
      }
    };
  }
  
  /**
   * Get relevant context for a command based on dialog state and history
   * @param command - The user command
   * @param history - Full conversation history
   * @param dialogState - Current dialog state
   * @returns Relevant context entries
   */
  getRelevantContext(
    command: string,
    history: ConversationEntry[],
    dialogState: DialogState
  ): ConversationEntry[] {
    // For similarity requests, only return the last music action from dialog state
    if (this.isSimilarityRequest(command)) {
      if (dialogState.last_action) {
        // Convert dialog state to conversation entry format
        const lastActionEntry: ConversationEntry = {
          command: `Previous: ${dialogState.last_action.type} ${dialogState.last_action.artist || dialogState.last_action.query || ''}`,
          interpretation: {
            intent: dialogState.last_action.intent,
            artist: dialogState.last_action.artist,
            track: dialogState.last_action.track,
            album: dialogState.last_action.album,
            query: dialogState.last_action.query,
            confidence: 0.9,
            alternatives: dialogState.last_action.alternatives || dialogState.last_candidates
          },
          timestamp: dialogState.last_action.timestamp
        };
        return [lastActionEntry];
      }
      return [];
    }
    
    // For contextual references, return recent entries with alternatives
    if (this.isContextualReference(command)) {
      return history.filter(entry => 
        entry.interpretation.alternatives && entry.interpretation.alternatives.length > 0
      ).slice(0, 2);
    }
    
    // For general commands, return time-boxed context (last 2-3 actions only)
    // Filter out pure chat/info requests to prevent contamination
    // Also filter by time - only include actions from last 10 minutes
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    const musicActions = history.filter(entry => {
      const intent = entry.interpretation.intent;
      const isRecentEnough = entry.timestamp > tenMinutesAgo;
      const isMusicAction = ['play_specific_song', 'queue_specific_song', 'play_playlist', 'queue_playlist'].includes(intent);
      return isMusicAction && isRecentEnough;
    });
    
    // If the command contains "this" or "that", only return the most recent action
    // as the user is referring to the immediate context
    const lowerCommand = command.toLowerCase();
    if (lowerCommand.includes(' this') || lowerCommand.includes(' that') || 
        lowerCommand === 'this' || lowerCommand === 'that') {
      return musicActions.slice(0, 1);
    }
    
    // Otherwise return last 2 music actions for general context
    return musicActions.slice(0, 2);
  }
  
  /**
   * Update dialog state based on a successful action
   * @param dialogState - Current dialog state
   * @param interpretation - The command interpretation
   * @param alternatives - Any alternatives provided
   * @returns Updated dialog state
   */
  updateDialogStateFromAction(
    dialogState: DialogState,
    interpretation: any,
    alternatives: (string | {
      intent?: string;
      query?: string;
      theme?: string;
      enhancedQuery?: string;
      isAIDiscovery?: boolean;
      aiReasoning?: string;
    })[] = []
  ): DialogState {
    const intent = interpretation.intent;
    
    // Only update for music actions, not chat/info requests
    if (this.isDestructiveAction(intent)) {
      const actionType = intent.includes('queue') ? 'queue' : 'play';
      
      return {
        ...dialogState,
        last_action: {
          type: actionType,
          intent: intent,
          artist: interpretation.artist,
          track: interpretation.track,
          album: interpretation.album,
          query: interpretation.query,
          timestamp: Date.now(),
          alternatives: alternatives
        },
        last_candidates: alternatives,
        interaction_mode: 'music',
        updated_at: Date.now()
      };
    } else if (['chat', 'ask_question'].includes(intent)) {
      // For conversational intents, just update interaction mode
      return {
        ...dialogState,
        interaction_mode: 'chat',
        updated_at: Date.now()
      };
    }
    
    return dialogState;
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
          // Handle both string and object alternatives
          const altText = typeof alternative === 'string' ? alternative : alternative.query || '';
          const lowerAlt = altText.toLowerCase();
          
          // Extract key terms from the command
          const searchTerms = lowerCommand
            .replace(/^(no|not|yes|play|queue|actually|try)\s+/g, '')
            .replace(/\s*(the)\s+/g, ' ')
            .replace(/\s+(one|version)$/g, '')
            .trim()
            .split(/\s+/)
            .filter(term => term.length > 0);
          
          // Check if all search terms appear in the alternative
          const matches = searchTerms.every(term => 
            lowerAlt.includes(term) || 
            // Special handling for common artist references
            (term === 'taylor' && lowerAlt.includes('taylor swift')) ||
            (term === 'swift' && lowerAlt.includes('taylor swift'))
          );
          
          if (matches) {
            // Parse the alternative format "Artist - Song"
            const parts = altText.split(' - ');
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