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
  private readonly HEARTBEAT_TIMEOUT = 60 * 1000; // 60 seconds for heartbeat checks

  constructor() {
    // Periodic cleanup of stale connections
    setInterval(() => this.cleanupStaleConnections(), 60000); // Every minute
    
    // More aggressive connection validation
    setInterval(() => this.validateConnections(), 30000); // Every 30 seconds
  }

  canAddConnection(userId: string): boolean {
    const currentCount = this.userConnectionCount.get(userId) || 0;
    return currentCount < this.MAX_CONNECTIONS_PER_USER;
  }

  addConnection(connectionId: string, userId: string, res: Response): boolean {
    // First, clean up any dead connections for this user
    this.cleanupUserConnections(userId);
    
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

  clearAllConnections(): void {
    console.log(`[SSE] Force-clearing all ${this.connections.size} connections`);
    
    // Send close event to all connections
    for (const [id, info] of this.connections.entries()) {
      try {
        info.res.write(`event: close\ndata: ${JSON.stringify({ 
          reason: 'Server restart', 
          code: 'SERVER_RESTART' 
        })}\n\n`);
        info.res.end();
      } catch (error) {
        console.error('[SSE] Error closing connection during clear:', error);
      }
    }
    
    // Clear all tracking
    this.connections.clear();
    this.userConnectionCount.clear();
    
    console.log('[SSE] All connections cleared');
  }

  private cleanupUserConnections(userId: string): void {
    const deadConnections: string[] = [];
    
    // Find all dead connections for this user
    for (const [id, info] of this.connections.entries()) {
      if (info.userId === userId) {
        // Test if connection is still alive
        if (!this.isConnectionAlive(info.res)) {
          deadConnections.push(id);
        }
      }
    }
    
    // Remove dead connections
    for (const id of deadConnections) {
      console.log(`[SSE] Removing dead connection ${id} for user ${userId}`);
      this.removeConnection(id);
    }
  }

  private isConnectionAlive(res: Response): boolean {
    try {
      // Check if the response is still writable
      // @ts-ignore - accessing internal properties
      return res.socket && !res.socket.destroyed && res.writable;
    } catch (error) {
      return false;
    }
  }

  private validateConnections(): void {
    const deadConnections: string[] = [];
    const now = Date.now();
    
    for (const [id, info] of this.connections.entries()) {
      // Check if connection is dead
      if (!this.isConnectionAlive(info.res)) {
        deadConnections.push(id);
      }
      // Also check for connections that haven't sent heartbeats
      else if (now - info.lastActivity > this.HEARTBEAT_TIMEOUT) {
        console.log(`[SSE] Connection ${id} hasn't sent heartbeat in ${Math.round((now - info.lastActivity) / 1000)}s`);
        // Try to ping the connection
        try {
          info.res.write(': ping\n\n');
        } catch (error) {
          console.log(`[SSE] Connection ${id} failed ping test, marking as dead`);
          deadConnections.push(id);
        }
      }
    }
    
    // Remove all dead connections
    for (const id of deadConnections) {
      console.log(`[SSE] Removing dead connection ${id} during validation`);
      const connection = this.connections.get(id);
      if (connection) {
        try {
          connection.res.end();
        } catch (error) {
          // Ignore errors when closing dead connections
        }
      }
      this.removeConnection(id);
    }
    
    if (deadConnections.length > 0) {
      console.log(`[SSE] Validation removed ${deadConnections.length} dead connections. Active: ${this.connections.size}`);
    }
  }
}

export const sseConnectionManager = new SSEConnectionManager();