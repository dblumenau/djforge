import { Response } from 'express';

interface ConnectionInfo {
  res: Response;
  userId: string;
  connectedAt: number;
  lastActivity: number;
}

class SSEConnectionManager {
  private connections = new Map<string, ConnectionInfo>();
  private userConnectionCount = new Map<string, number>();
  private readonly MAX_CONNECTIONS_PER_USER = 2; // Allow max 2 connections per user
  private readonly CONNECTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Periodic cleanup of stale connections
    setInterval(() => this.cleanupStaleConnections(), 60000); // Every minute
  }

  canAddConnection(userId: string): boolean {
    const currentCount = this.userConnectionCount.get(userId) || 0;
    return currentCount < this.MAX_CONNECTIONS_PER_USER;
  }

  addConnection(connectionId: string, userId: string, res: Response): boolean {
    // Check if user has too many connections
    if (!this.canAddConnection(userId)) {
      console.log(`[SSE] User ${userId} has reached connection limit`);
      // Close oldest connection for this user
      this.closeOldestUserConnection(userId);
    }

    // Add the new connection
    this.connections.set(connectionId, {
      res,
      userId,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    });

    // Update user connection count
    const currentCount = this.userConnectionCount.get(userId) || 0;
    this.userConnectionCount.set(userId, currentCount + 1);

    console.log(`[SSE] Added connection ${connectionId} for user ${userId}. Total connections: ${this.connections.size}, User connections: ${currentCount + 1}`);
    return true;
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Update user connection count
      const currentCount = this.userConnectionCount.get(connection.userId) || 0;
      if (currentCount > 0) {
        this.userConnectionCount.set(connection.userId, currentCount - 1);
      }
      
      // Remove connection
      this.connections.delete(connectionId);
      
      console.log(`[SSE] Removed connection ${connectionId} for user ${connection.userId}. Total connections: ${this.connections.size}, User connections: ${currentCount - 1}`);
    }
  }

  updateActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  private closeOldestUserConnection(userId: string): void {
    let oldestConnection: { id: string; info: ConnectionInfo } | null = null;

    // Find oldest connection for this user
    for (const [id, info] of this.connections.entries()) {
      if (info.userId === userId) {
        if (!oldestConnection || info.connectedAt < oldestConnection.info.connectedAt) {
          oldestConnection = { id, info };
        }
      }
    }

    if (oldestConnection) {
      console.log(`[SSE] Closing oldest connection ${oldestConnection.id} for user ${userId}`);
      try {
        // Send close event
        oldestConnection.info.res.write(`event: close\ndata: ${JSON.stringify({ 
          reason: 'Connection limit reached', 
          code: 'CONNECTION_LIMIT' 
        })}\n\n`);
        oldestConnection.info.res.end();
      } catch (error) {
        console.error('[SSE] Error closing connection:', error);
      }
      this.removeConnection(oldestConnection.id);
    }
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [id, info] of this.connections.entries()) {
      if (now - info.lastActivity > this.CONNECTION_TIMEOUT) {
        staleConnections.push(id);
      }
    }

    for (const id of staleConnections) {
      console.log(`[SSE] Cleaning up stale connection ${id}`);
      const connection = this.connections.get(id);
      if (connection) {
        try {
          connection.res.write(`event: close\ndata: ${JSON.stringify({ 
            reason: 'Connection timeout', 
            code: 'TIMEOUT' 
          })}\n\n`);
          connection.res.end();
        } catch (error) {
          console.error('[SSE] Error closing stale connection:', error);
        }
      }
      this.removeConnection(id);
    }

    if (staleConnections.length > 0) {
      console.log(`[SSE] Cleaned up ${staleConnections.length} stale connections. Total active: ${this.connections.size}`);
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getUserConnectionCount(userId: string): number {
    return this.userConnectionCount.get(userId) || 0;
  }
}

export const sseConnectionManager = new SSEConnectionManager();