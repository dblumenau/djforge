import { Socket } from 'socket.io';
import { SessionManager } from './session-manager';

/**
 * WebSocket authentication helper
 * Validates session tokens for Socket.IO connections
 */
export class WebSocketAuth {
  private sessionManager: SessionManager;
  
  constructor(redisClient: any) {
    this.sessionManager = new SessionManager(redisClient);
  }
  
  /**
   * Validate a session for WebSocket connection
   * @param sessionId - The session ID from the client
   * @returns User information if valid, null otherwise
   */
  async validateSession(sessionId: string): Promise<{
    userId: string;
    sessionId: string;
  } | null> {
    try {
      if (!sessionId) {
        console.error('[WebSocketAuth] No session ID provided');
        return null;
      }
      
      // Get session from Redis
      const session = await this.sessionManager.getSession(sessionId);
      
      if (!session) {
        console.error('[WebSocketAuth] Session not found:', sessionId);
        return null;
      }
      
      // Sessions are permanent now (no expiry check needed)
      // The session is valid as long as it exists in Redis
      
      console.log('[WebSocketAuth] Session validated for user:', session.userId);
      
      return {
        userId: session.userId,
        sessionId: session.id
      };
    } catch (error) {
      console.error('[WebSocketAuth] Error validating session:', error);
      return null;
    }
  }
  
  /**
   * Extract session ID from socket handshake
   * Can be passed via auth object or query params
   */
  extractSessionId(socket: Socket): string | null {
    // Check auth object first (preferred method)
    const authSessionId = socket.handshake.auth?.sessionId;
    if (authSessionId) {
      return authSessionId;
    }
    
    // Fallback to query params
    const querySessionId = socket.handshake.query?.sessionId;
    if (querySessionId) {
      return Array.isArray(querySessionId) ? querySessionId[0] : querySessionId;
    }
    
    return null;
  }
}