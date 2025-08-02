import { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import { WebSocketAuth } from '../auth/websocket-auth';
import winston from 'winston';
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  SocketData 
} from '../types/websocket.types';

export class MusicWebSocketService {
  private namespace: Namespace<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
  private wsAuth: WebSocketAuth | null;
  private logger: winston.Logger;
  private userSubscriptions: Map<string, Set<string>>; // userId -> socketIds
  private connectionsByIP: Map<string, Set<string>>;
  private maxConnectionsPerUser: number = 5;
  private maxConnectionsPerIP: number = 10;
  
  constructor(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>, redisClient?: any) {
    this.namespace = io.of('/music');
    this.userSubscriptions = new Map();
    this.connectionsByIP = new Map();
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()],
      defaultMeta: { service: 'MusicWebSocket' }
    });
    
    // Initialize auth if Redis client is provided
    if (redisClient) {
      this.wsAuth = new WebSocketAuth(redisClient);
      this.logger.info('Music WebSocket authentication enabled');
    } else {
      this.wsAuth = null;
      this.logger.warn('Music WebSocket running without authentication');
    }
    
    this.setupNamespace();
    
    this.logger.info('Music WebSocket service initialized', {
      namespace: '/music',
      authEnabled: !!this.wsAuth
    });
  }
  
  private setupNamespace(): void {
    // Middleware for authentication and rate limiting
    this.namespace.use(async (socket, next) => {
      const clientIP = this.getClientIP(socket);
      
      // Check IP rate limit
      const existingConnections = this.connectionsByIP.get(clientIP) || new Set();
      if (existingConnections.size >= this.maxConnectionsPerIP) {
        this.logger.warn('Music WebSocket: Rate limit exceeded', { ip: clientIP });
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
          this.logger.warn('Music WebSocket connection rejected - no session ID', { ip: clientIP });
          return next(new Error('Authentication required'));
        }
        
        const sessionData = await this.wsAuth.validateSession(sessionId);
        
        if (!sessionData) {
          this.logger.warn('Music WebSocket connection rejected - invalid session', { 
            ip: clientIP, 
            sessionId 
          });
          return next(new Error('Invalid session'));
        }
        
        // Check user connection limit
        const userConnections = this.userSubscriptions.get(sessionData.userId) || new Set();
        if (userConnections.size >= this.maxConnectionsPerUser) {
          this.logger.warn('Music WebSocket: User connection limit exceeded', { 
            userId: sessionData.userId,
            connectionCount: userConnections.size
          });
          return next(new Error('Too many connections for this user'));
        }
        
        // Store authenticated user data
        socket.data.userId = sessionData.userId;
        socket.data.sessionId = sessionData.sessionId;
        socket.data.authenticated = true;
        
        this.logger.info('Music WebSocket authenticated connection', {
          userId: sessionData.userId,
          sessionId: sessionData.sessionId,
          ip: clientIP
        });
      }

      next();
    });

    // Handle connections
    this.namespace.on('connection', (socket) => {
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
      if (!this.userSubscriptions.has(userId)) {
        this.userSubscriptions.set(userId, new Set());
      }
      this.userSubscriptions.get(userId)!.add(socketId);
    }

    this.logger.info('Music WebSocket client connected', {
      socketId,
      ip: clientIP,
      userId: userId || 'unauthenticated',
      authenticated: socket.data.authenticated,
      namespace: '/music'
    });

    // Send initial connection status
    socket.emit('connectionStatus', 'connected');

    // Handle subscription events
    socket.on('subscribeToPlayback', (callback) => {
      this.logger.debug('Playback subscription request', { socketId, userId });
      callback({ status: 'subscribed' });
    });
    
    socket.on('unsubscribeFromPlayback', (callback) => {
      this.logger.debug('Playback unsubscription request', { socketId, userId });
      callback({ status: 'unsubscribed' });
    });
    
    socket.on('requestPlaybackSync', (callback) => {
      this.logger.debug('Playback sync request', { socketId, userId });
      // This would typically fetch current playback state
      // For now, return empty state
      callback({ playbackState: null });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      this.logger.error('Music WebSocket error', {
        socketId,
        userId,
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
      const userConnections = this.userSubscriptions.get(userId);
      if (userConnections) {
        userConnections.delete(socketId);
        if (userConnections.size === 0) {
          this.userSubscriptions.delete(userId);
        }
      }
    }

    this.logger.info('Music WebSocket client disconnected', {
      socketId,
      ip: clientIP,
      userId: userId || 'unauthenticated',
      reason,
      connectionDuration: Date.now() - socket.data.connectionTime
    });
  }
  
  private getClientIP(socket: Socket): string {
    return socket.handshake.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
           socket.handshake.address ||
           '127.0.0.1';
  }
  
  // Public methods for emitting events to specific users
  public emitPlaybackStateChange(userId: string, data: any): void {
    const sockets = this.userSubscriptions.get(userId);
    if (sockets && sockets.size > 0) {
      sockets.forEach(socketId => {
        this.namespace.to(socketId).emit('playbackStateChanged', {
          ...data,
          timestamp: Date.now()
        });
      });
      
      this.logger.debug('Emitted playbackStateChanged', {
        userId,
        socketCount: sockets.size,
        data: { isPlaying: data.isPlaying, track: data.track?.name }
      });
    }
  }
  
  public emitTrackChange(userId: string, data: any): void {
    const sockets = this.userSubscriptions.get(userId);
    if (sockets && sockets.size > 0) {
      sockets.forEach(socketId => {
        this.namespace.to(socketId).emit('trackChanged', {
          ...data,
          timestamp: Date.now()
        });
      });
      
      this.logger.debug('Emitted trackChanged', {
        userId,
        socketCount: sockets.size,
        data: { 
          current: data.current?.name, 
          source: data.source,
          isAIDiscovery: data.isAIDiscovery 
        }
      });
    }
  }
  
  public emitQueueUpdate(userId: string, data: any): void {
    const sockets = this.userSubscriptions.get(userId);
    if (sockets && sockets.size > 0) {
      sockets.forEach(socketId => {
        this.namespace.to(socketId).emit('queueUpdated', {
          ...data,
          timestamp: Date.now()
        });
      });
      
      this.logger.debug('Emitted queueUpdated', {
        userId,
        socketCount: sockets.size,
        data: { action: data.action, totalItems: data.totalItems, source: data.source }
      });
    }
  }
  
  public emitVolumeChanged(userId: string, data: any): void {
    const sockets = this.userSubscriptions.get(userId);
    if (sockets && sockets.size > 0) {
      sockets.forEach(socketId => {
        this.namespace.to(socketId).emit('volumeChanged', {
          ...data,
          timestamp: Date.now()
        });
      });
      
      this.logger.debug('Emitted volumeChanged', {
        userId,
        socketCount: sockets.size,
        data: { volume: data.volume, device: data.device }
      });
    }
  }
  
  public emitCommandExecuted(userId: string, data: any): void {
    const sockets = this.userSubscriptions.get(userId);
    if (sockets && sockets.size > 0) {
      sockets.forEach(socketId => {
        this.namespace.to(socketId).emit('commandExecuted', {
          ...data,
          timestamp: Date.now()
        });
      });
      
      this.logger.debug('Emitted commandExecuted', {
        userId,
        socketCount: sockets.size,
        data: { 
          command: data.command, 
          intent: data.intent, 
          success: data.success,
          confidence: data.confidence 
        }
      });
    }
  }
  
  public emitDeviceChanged(userId: string, data: any): void {
    const sockets = this.userSubscriptions.get(userId);
    if (sockets && sockets.size > 0) {
      sockets.forEach(socketId => {
        this.namespace.to(socketId).emit('deviceChanged', {
          ...data,
          timestamp: Date.now()
        });
      });
      
      this.logger.debug('Emitted deviceChanged', {
        userId,
        socketCount: sockets.size,
        data: { previousDevice: data.previousDevice, currentDevice: data.currentDevice }
      });
    }
  }
  
  // Public methods for service management
  public getConnectionCount(): number {
    return this.namespace.sockets.size;
  }
  
  public getSubscriptionCount(): number {
    return this.userSubscriptions.size;
  }
  
  public getConnectionsByUser(): Map<string, number> {
    const result = new Map<string, number>();
    this.userSubscriptions.forEach((sockets, userId) => {
      result.set(userId, sockets.size);
    });
    return result;
  }
  
  public isUserConnected(userId: string): boolean {
    return this.userSubscriptions.has(userId) && 
           this.userSubscriptions.get(userId)!.size > 0;
  }
  
  public shutdown(): void {
    this.namespace.disconnectSockets();
    this.userSubscriptions.clear();
    this.connectionsByIP.clear();
    this.logger.info('Music WebSocket service shut down');
  }
}