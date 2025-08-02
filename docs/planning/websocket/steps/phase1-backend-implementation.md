# Phase 1: Backend WebSocket Service Implementation

## Developer Assignment: Backend Developer

## Overview
This phase implements the server-side WebSocket infrastructure using Socket.IO v4 with TypeScript. The backend developer will create a fully functional WebSocket service that emits random strings at intervals and handles client connections, completely independent of frontend implementation.

## Prerequisites
- Node.js and npm installed
- Access to `server/` directory
- Understanding of TypeScript and Express.js
- Familiarity with Socket.IO concepts

## Deliverables
1. Type definitions for WebSocket events
2. WebSocket service with connection management
3. Integration with existing Express server
4. Health check endpoint
5. Proper logging and error handling

## Step-by-Step Implementation

### Step 1: Install Dependencies
```bash
cd server
npm install socket.io @socket.io/redis-adapter
npm install --save-dev @types/node
```

### Step 2: Create Type Definitions
**File:** `server/src/types/websocket.types.ts`

```typescript
// Define the events that server can send to client
export interface ServerToClientEvents {
  // Random string event with payload structure
  randomString: (data: { 
    value: string;      // The random alphanumeric string
    timestamp: number;  // Unix timestamp when generated
  }) => void;
  
  // Connection status updates
  connectionStatus: (status: 'connected' | 'disconnected') => void;
  
  // Error events
  error: (data: { 
    message: string;    // Human-readable error message
    code?: string;      // Optional error code
  }) => void;
}

// Define the events that client can send to server
export interface ClientToServerEvents {
  // Ping event with acknowledgment callback
  ping: (callback: (response: { 
    status: 'ok'; 
    timestamp: number;
    serverTime: number;
  }) => void) => void;
}

// Socket-specific data stored per connection
export interface SocketData {
  connectionTime: number;  // When socket connected
  pingCount: number;       // Number of pings from this client
  ipAddress?: string;      // Client IP for rate limiting
}

// WebSocket service configuration
export interface WebSocketConfig {
  namespace: string;       // Socket.IO namespace (e.g., '/demo')
  corsOrigins: string[];   // Allowed CORS origins
  maxPingsPerClient: number; // Max pings before disconnect
  maxConnectionsPerIP: number; // Rate limiting per IP
  randomStringInterval: {
    min: number;  // Minimum seconds between emissions
    max: number;  // Maximum seconds between emissions
  };
}
```

### Step 3: Create WebSocket Service
**File:** `server/src/services/websocket.service.ts`

```typescript
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
```

### Step 4: Integrate with Express Server
**Modify:** `server/src/server.ts`

Add the following after creating the HTTP server and before starting to listen:

```typescript
import { initializeWebSocket, getWebSocketService } from './services/websocket.service';

// ... existing code ...

// After creating httpServer but before app.listen()
const httpServer = createServer(app);

// Initialize WebSocket service with your allowed origins
const webSocketService = initializeWebSocket(httpServer, allowedOrigins);

// Add health check endpoint
app.get('/api/websocket/health', (req, res) => {
  const wsService = getWebSocketService();
  if (!wsService) {
    return res.status(503).json({ 
      status: 'unhealthy', 
      message: 'WebSocket service not initialized' 
    });
  }

  res.json({
    status: 'healthy',
    connections: wsService.getConnectionCount(),
    connectionsByIP: Object.fromEntries(wsService.getConnectionsByIP()),
    timestamp: Date.now()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  const wsService = getWebSocketService();
  if (wsService) {
    wsService.shutdown();
  }
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Now use httpServer.listen() instead of app.listen()
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket service available at ws://localhost:${PORT}/demo`);
});
```

## Testing the Backend Implementation

### Manual Testing with Socket.IO Client CLI
```bash
# Install socket.io-client CLI tool
npm install -g socket.io-client-tool

# Connect to the WebSocket server
socket-cli http://localhost:4001/demo

# The server should start sending random strings every 5-15 seconds
```

### Testing with curl (Health Check)
```bash
# Check WebSocket service health
curl http://localhost:4001/api/websocket/health
```

### Expected Console Output
When running the server, you should see:
```
Server running on port 4001
WebSocket service available at ws://localhost:4001/demo
{"level":"info","message":"WebSocket service initialized","namespace":"/demo","corsOrigins":["http://localhost:5173","http://127.0.0.1:5173"],"timestamp":"2024-..."}
```

When a client connects:
```
{"level":"info","message":"Client connected","socketId":"...","ip":"127.0.0.1","namespace":"/demo","timestamp":"2024-..."}
{"level":"info","message":"Random string broadcasted","value":"a1B2c3D4e5","clientCount":1,"timestamp":"2024-..."}
```

## Validation Checklist

✅ **Dependencies Installed**
- [ ] socket.io package installed
- [ ] @socket.io/redis-adapter package installed

✅ **Type Safety**
- [ ] All TypeScript types defined in websocket.types.ts
- [ ] No `any` types used
- [ ] Proper type exports for client consumption

✅ **Core Functionality**
- [ ] WebSocket service initializes without errors
- [ ] Random strings generated (10 chars, alphanumeric)
- [ ] Strings emitted every 5-15 seconds (random interval)
- [ ] Single shared timer for all clients (not per-client)

✅ **Connection Management**
- [ ] Clients can connect to /demo namespace
- [ ] Connection tracking by IP address
- [ ] Rate limiting (max 10 connections per IP)
- [ ] Proper cleanup on disconnect

✅ **Error Handling**
- [ ] Graceful handling of connection errors
- [ ] Rate limit enforcement with clear error messages
- [ ] Ping limit enforcement (100 pings max)
- [ ] All errors logged with context

✅ **Logging**
- [ ] Winston logger configured
- [ ] All events logged (connect, disconnect, ping, broadcast)
- [ ] Structured JSON logging format

✅ **Health Monitoring**
- [ ] Health check endpoint returns connection count
- [ ] Health check shows connections by IP
- [ ] Endpoint accessible at /api/websocket/health

✅ **Integration**
- [ ] Integrated with existing Express server
- [ ] CORS configured to match allowed origins
- [ ] Graceful shutdown handling

## Common Issues and Solutions

### Issue: "Cannot find module 'socket.io'"
**Solution:** Ensure you're in the server directory and run `npm install socket.io`

### Issue: CORS errors in browser console
**Solution:** Verify that corsOrigins in the WebSocketService constructor matches your frontend URL

### Issue: "Too many connections from this IP"
**Solution:** This is rate limiting working correctly. Wait a minute or adjust maxConnectionsPerIP

### Issue: Server crashes on startup
**Solution:** Ensure you're passing the HTTP server instance (not the Express app) to initializeWebSocket()

## Notes for Frontend Developer

The backend WebSocket service is now ready and provides:

1. **Endpoint:** `ws://localhost:4001/demo` (or your configured port)
2. **Events Emitted:**
   - `randomString`: `{ value: string, timestamp: number }`
   - `connectionStatus`: `'connected' | 'disconnected'`
   - `error`: `{ message: string, code?: string }`
3. **Events Accepted:**
   - `ping`: Expects callback with `{ status: 'ok', timestamp: number, serverTime: number }`
4. **Type Definitions:** Available in `server/src/types/websocket.types.ts`

The service runs independently and will emit random strings even with no frontend connected. Use the health check endpoint to verify it's running correctly.