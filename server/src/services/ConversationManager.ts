import { RedisConversation, ConversationEntry, DialogState, createConversationManager } from '../utils/redisConversation';

/**
 * Shared conversation management service for all LLM paths
 * Provides consistent Redis-based conversation history and context resolution
 */
export class ConversationManager {
  private redisConversation: RedisConversation | null = null;
  private redisClient: any = null;

  constructor(redisClient: any) {
    this.redisClient = redisClient;
    if (redisClient) {
      this.redisConversation = createConversationManager(redisClient);
      console.log('✅ Shared ConversationManager initialized with Redis support');
    } else {
      console.warn('⚠️ ConversationManager initialized without Redis - conversation history disabled');
    }
  }

  /**
   * Initialize or update the Redis client
   */
  setRedisClient(client: any) {
    this.redisClient = client;
    if (client) {
      this.redisConversation = createConversationManager(client);
      console.log('✅ ConversationManager Redis client updated');
    }
  }

  /**
   * Extract user ID from session (provided by session-auth middleware)
   */
  getUserIdFromRequest(req: any): string | null {
    return req.userId || null;
  }

  /**
   * Get user's model preference from Redis
   */
  async getUserModelPreference(userId: string): Promise<string | null> {
    if (!this.redisClient) return null;
    
    try {
      const key = `user:${userId}:model_preference`;
      const preference = await this.redisClient.get(key);
      return preference;
    } catch (error) {
      console.error('Error getting model preference from Redis:', error);
      return null;
    }
  }

  /**
   * Set user's model preference in Redis
   */
  async setUserModelPreference(userId: string, model: string): Promise<void> {
    if (!this.redisClient) return;
    
    try {
      const key = `user:${userId}:model_preference`;
      await this.redisClient.setEx(key, 2592000, model); // 30 days TTL
    } catch (error) {
      console.error('Error setting model preference in Redis:', error);
    }
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: string, limit: number = 3): Promise<ConversationEntry[]> {
    if (!this.redisConversation) return [];
    return await this.redisConversation.getHistory(sessionId, limit);
  }

  /**
   * Add new conversation entry
   */
  async addConversationEntry(sessionId: string, entry: ConversationEntry): Promise<void> {
    if (!this.redisConversation) return;
    await this.redisConversation.append(sessionId, entry);
  }

  /**
   * Clear conversation history for a session
   */
  async clearConversationHistory(sessionId: string): Promise<void> {
    if (!this.redisConversation) return;
    await this.redisConversation.clear(sessionId);
  }

  /**
   * Get dialog state for a session
   */
  async getDialogState(sessionId: string): Promise<DialogState> {
    if (!this.redisConversation) {
      return this.createDefaultDialogState();
    }
    return await this.redisConversation.getDialogState(sessionId);
  }

  /**
   * Update dialog state for a session
   */
  async updateDialogState(sessionId: string, state: DialogState): Promise<void> {
    if (!this.redisConversation) return;
    await this.redisConversation.updateDialogState(sessionId, state);
  }

  /**
   * Get relevant context for a command
   */
  getRelevantContext(
    command: string,
    history: ConversationEntry[],
    dialogState: DialogState
  ): ConversationEntry[] {
    if (!this.redisConversation) return [];
    return this.redisConversation.getRelevantContext(command, history, dialogState);
  }

  /**
   * Check if a command is a contextual reference
   */
  isContextualReference(command: string): boolean {
    if (!this.redisConversation) return false;
    return this.redisConversation.isContextualReference(command);
  }

  /**
   * Check if a command is a similarity request
   */
  isSimilarityRequest(command: string): boolean {
    if (!this.redisConversation) return false;
    return this.redisConversation.isSimilarityRequest(command);
  }

  /**
   * Resolve contextual reference from history
   */
  resolveContextualReference(
    command: string,
    history: ConversationEntry[]
  ): { artist: string; track: string; confidence: number } | null {
    if (!this.redisConversation) return null;
    return this.redisConversation.resolveContextualReference(command, history);
  }

  /**
   * Update dialog state from a successful action
   */
  updateDialogStateFromAction(
    dialogState: DialogState,
    interpretation: any,
    alternatives: string[] = []
  ): DialogState {
    if (!this.redisConversation) return dialogState;
    return this.redisConversation.updateDialogStateFromAction(dialogState, interpretation, alternatives);
  }

  /**
   * Format conversation history for LLM context
   * Returns a formatted string suitable for including in LLM prompts
   */
  formatContextForLLM(
    command: string,
    history: ConversationEntry[],
    dialogState: DialogState
  ): string {
    if (!this.redisConversation) return '';

    const relevantContext = this.getRelevantContext(command, history, dialogState);
    
    if (relevantContext.length === 0) {
      return '';
    }

    // Format context as a concise summary
    const contextLines = relevantContext.map(entry => {
      const interpretation = entry.interpretation;
      let contextStr = `Previous: "${entry.command}" → ${interpretation.intent}`;
      
      if (interpretation.artist) {
        contextStr += ` (${interpretation.artist}`;
        if (interpretation.track) {
          contextStr += ` - ${interpretation.track}`;
        }
        contextStr += ')';
      } else if (interpretation.query) {
        contextStr += ` (${interpretation.query})`;
      }
      
      if (interpretation.alternatives && interpretation.alternatives.length > 0) {
        contextStr += ` [alternatives: ${interpretation.alternatives.join(', ')}]`;
      }
      
      return contextStr;
    });

    return `\n\nRecent conversation context:\n${contextLines.join('\n')}`;
  }

  /**
   * Create default dialog state
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
   * Check if Redis conversation features are available
   */
  isAvailable(): boolean {
    return this.redisConversation !== null;
  }
}

// Singleton instance for shared use across the application
let sharedConversationManager: ConversationManager | null = null;

/**
 * Get or create the shared conversation manager instance
 */
export function getConversationManager(redisClient?: any): ConversationManager {
  if (!sharedConversationManager) {
    sharedConversationManager = new ConversationManager(redisClient);
  } else if (redisClient && !sharedConversationManager.isAvailable()) {
    sharedConversationManager.setRedisClient(redisClient);
  }
  
  return sharedConversationManager;
}

/**
 * Initialize the shared conversation manager with Redis client
 */
export function initializeConversationManager(redisClient: any): ConversationManager {
  sharedConversationManager = new ConversationManager(redisClient);
  return sharedConversationManager;
}