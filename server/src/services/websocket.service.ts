import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import winston from 'winston';
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  SocketData,
  WebSocketConfig 
} from '../types/websocket.types';
import { WebSocketAuth } from '../auth/websocket-auth';

export class WebSocketService {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
  private logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [new winston.transports.Console()]
  });
  
  // Track connections per IP for rate limiting
  private connectionsByIP = new Map<string, Set<string>>();
  
  // Track connections per user
  private connectionsByUser = new Map<string, Set<string>>();
  
  // Single interval for all clients (performance optimization)
  private broadcastInterval: NodeJS.Timeout | null = null;
  
  // WebSocket authentication helper
  private wsAuth: WebSocketAuth | null = null;
  
  // Configuration
  private config: WebSocketConfig = {
    namespace: '/demo',
    corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    maxPingsPerClient: 100,
    maxConnectionsPerIP: 10,
    randomStringInterval: { min: 5, max: 15 }
  };

  constructor(httpServer: HTTPServer, corsOrigins?: string[], redisClient?: any) {
    // Override CORS origins if provided
    if (corsOrigins) {
      this.config.corsOrigins = corsOrigins;
    }
    
    // Initialize WebSocket authentication if Redis client is provided
    if (redisClient) {
      this.wsAuth = new WebSocketAuth(redisClient);
      this.logger.info('WebSocket authentication enabled');
    } else {
      this.logger.warn('WebSocket running without authentication (Redis client not provided)');
    }

    // Initialize Socket.IO with TypeScript types
    this.io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
      cors: {
        origin: this.config.corsOrigins,
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupNamespace();
    this.startBroadcastInterval();
    
    this.logger.info('WebSocket service initialized', {
      namespace: this.config.namespace,
      corsOrigins: this.config.corsOrigins,
      authEnabled: !!this.wsAuth
    });
  }

  private setupNamespace(): void {
    const namespace = this.io.of(this.config.namespace);

    // Middleware for authentication and rate limiting
    namespace.use(async (socket, next) => {
      const clientIP = this.getClientIP(socket);
      
      // Check IP rate limit
      const existingConnections = this.connectionsByIP.get(clientIP) || new Set();
      if (existingConnections.size >= this.config.maxConnectionsPerIP) {
        this.logger.warn('Rate limit exceeded', { ip: clientIP });
        return next(new Error('Too many connections from this IP'));
      }

      // Initialize socket data
      socket.data.connectionTime = Date.now();
      socket.data.pingCount = 0;
      socket.data.ipAddress = clientIP;
      socket.data.authenticated = false;

      // If authentication is enabled, validate session
      if (this.wsAuth) {
        const sessionId = this.wsAuth.extractSessionId(socket);
        
        if (!sessionId) {
          this.logger.warn('WebSocket connection rejected - no session ID', { ip: clientIP });
          return next(new Error('Authentication required'));
        }
        
        const sessionData = await this.wsAuth.validateSession(sessionId);
        
        if (!sessionData) {
          this.logger.warn('WebSocket connection rejected - invalid session', { 
            ip: clientIP, 
            sessionId 
          });
          return next(new Error('Invalid session'));
        }
        
        // Store authenticated user data
        socket.data.userId = sessionData.userId;
        socket.data.sessionId = sessionData.sessionId;
        socket.data.authenticated = true;
        
        this.logger.info('WebSocket authenticated connection', {
          userId: sessionData.userId,
          sessionId: sessionData.sessionId,
          ip: clientIP
        });
      }

      next();
    });

    // Handle connections
    namespace.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>): void {
    const clientIP = socket.data.ipAddress!;
    const socketId = socket.id;
    const userId = socket.data.userId;

    // Track connection for IP rate limiting
    if (!this.connectionsByIP.has(clientIP)) {
      this.connectionsByIP.set(clientIP, new Set());
    }
    this.connectionsByIP.get(clientIP)!.add(socketId);
    
    // Track connection per user if authenticated
    if (userId) {
      if (!this.connectionsByUser.has(userId)) {
        this.connectionsByUser.set(userId, new Set());
      }
      this.connectionsByUser.get(userId)!.add(socketId);
    }

    this.logger.info('Client connected', {
      socketId,
      ip: clientIP,
      userId: userId || 'unauthenticated',
      authenticated: socket.data.authenticated,
      namespace: this.config.namespace
    });

    // Send initial connection status
    socket.emit('connectionStatus', 'connected');

    // Handle ping events
    socket.on('ping', (callback) => {
      socket.data.pingCount++;
      
      // Check ping limit
      if (socket.data.pingCount > this.config.maxPingsPerClient) {
        socket.emit('error', { 
          message: 'Ping limit exceeded',
          code: 'PING_LIMIT' 
        });
        socket.disconnect();
        return;
      }

      this.logger.debug('Ping received', {
        socketId,
        pingCount: socket.data.pingCount
      });

      // Respond with acknowledgment
      callback({
        status: 'ok',
        timestamp: Date.now(),
        serverTime: Date.now()
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      this.logger.error('Socket error', {
        socketId,
        error: error.message
      });
    });
  }

  private handleDisconnection(socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>, reason: string): void {
    const clientIP = socket.data.ipAddress!;
    const socketId = socket.id;
    const userId = socket.data.userId;

    // Clean up IP rate limiting tracking
    const ipConnections = this.connectionsByIP.get(clientIP);
    if (ipConnections) {
      ipConnections.delete(socketId);
      if (ipConnections.size === 0) {
        this.connectionsByIP.delete(clientIP);
      }
    }
    
    // Clean up user connection tracking
    if (userId) {
      const userConnections = this.connectionsByUser.get(userId);
      if (userConnections) {
        userConnections.delete(socketId);
        if (userConnections.size === 0) {
          this.connectionsByUser.delete(userId);
        }
      }
    }

    this.logger.info('Client disconnected', {
      socketId,
      ip: clientIP,
      userId: userId || 'unauthenticated',
      reason,
      connectionDuration: Date.now() - socket.data.connectionTime,
      totalPings: socket.data.pingCount
    });
  }

  private startBroadcastInterval(): void {
    // Single shared interval for all clients (performance optimization)
    const scheduleNext = () => {
      const delay = this.getRandomInterval();
      this.broadcastInterval = setTimeout(() => {
        this.broadcastRandomString();
        scheduleNext(); // Schedule next emission
      }, delay);
    };

    scheduleNext();
  }

  private broadcastRandomString(): void {
    const namespace = this.io.of(this.config.namespace);
    const connectedSockets = namespace.sockets.size;

    if (connectedSockets === 0) {
      this.logger.debug('No clients connected, skipping broadcast');
      return;
    }

    const randomString = this.generateRandomString(10);
    const payload = {
      value: randomString,
      timestamp: Date.now()
    };

    namespace.emit('randomString', payload);

    this.logger.info('Random string broadcasted', {
      value: randomString,
      clientCount: connectedSockets
    });
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private getRandomInterval(): number {
    const { min, max } = this.config.randomStringInterval;
    return (Math.random() * (max - min) + min) * 1000; // Convert to milliseconds
  }

  private getClientIP(socket: Socket): string {
    return socket.handshake.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
           socket.handshake.address ||
           '127.0.0.1';
  }

  // Public methods for external control
  public getConnectionCount(): number {
    return this.io.of(this.config.namespace).sockets.size;
  }

  public getConnectionsByIP(): Map<string, number> {
    const result = new Map<string, number>();
    this.connectionsByIP.forEach((sockets, ip) => {
      result.set(ip, sockets.size);
    });
    return result;
  }

  public shutdown(): void {
    if (this.broadcastInterval) {
      clearTimeout(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    
    this.io.of(this.config.namespace).disconnectSockets();
    this.io.close();
    
    this.logger.info('WebSocket service shut down');
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export function initializeWebSocket(httpServer: HTTPServer, corsOrigins?: string[], redisClient?: any): WebSocketService {
  if (!webSocketService) {
    webSocketService = new WebSocketService(httpServer, corsOrigins, redisClient);
  }
  return webSocketService;
}

export function getWebSocketService(): WebSocketService | null {
  return webSocketService;
}