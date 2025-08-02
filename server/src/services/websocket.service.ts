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
  
  // Single interval for all clients (performance optimization)
  private broadcastInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private config: WebSocketConfig = {
    namespace: '/demo',
    corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    maxPingsPerClient: 100,
    maxConnectionsPerIP: 10,
    randomStringInterval: { min: 5, max: 15 }
  };

  constructor(httpServer: HTTPServer, corsOrigins?: string[]) {
    // Override CORS origins if provided
    if (corsOrigins) {
      this.config.corsOrigins = corsOrigins;
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
      corsOrigins: this.config.corsOrigins
    });
  }

  private setupNamespace(): void {
    const namespace = this.io.of(this.config.namespace);

    // Middleware for rate limiting
    namespace.use((socket, next) => {
      const clientIP = this.getClientIP(socket);
      
      // Check rate limit
      const existingConnections = this.connectionsByIP.get(clientIP) || new Set();
      if (existingConnections.size >= this.config.maxConnectionsPerIP) {
        this.logger.warn('Rate limit exceeded', { ip: clientIP });
        return next(new Error('Too many connections from this IP'));
      }

      // Initialize socket data
      socket.data.connectionTime = Date.now();
      socket.data.pingCount = 0;
      socket.data.ipAddress = clientIP;

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

    // Track connection for rate limiting
    if (!this.connectionsByIP.has(clientIP)) {
      this.connectionsByIP.set(clientIP, new Set());
    }
    this.connectionsByIP.get(clientIP)!.add(socketId);

    this.logger.info('Client connected', {
      socketId,
      ip: clientIP,
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

    // Clean up rate limiting tracking
    const connections = this.connectionsByIP.get(clientIP);
    if (connections) {
      connections.delete(socketId);
      if (connections.size === 0) {
        this.connectionsByIP.delete(clientIP);
      }
    }

    this.logger.info('Client disconnected', {
      socketId,
      ip: clientIP,
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

export function initializeWebSocket(httpServer: HTTPServer, corsOrigins?: string[]): WebSocketService {
  if (!webSocketService) {
    webSocketService = new WebSocketService(httpServer, corsOrigins);
  }
  return webSocketService;
}

export function getWebSocketService(): WebSocketService | null {
  return webSocketService;
}