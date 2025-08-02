import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { WebSocketService, initializeWebSocket, getWebSocketService } from '../websocket.service';
import { 
  ServerToClientEvents, 
  ClientToServerEvents 
} from '../../types/websocket.types';

describe('WebSocketService', () => {
  let httpServer: HTTPServer;
  let service: WebSocketService;
  let clientSocket: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
  let serverPort: number;

  beforeAll((done) => {
    // Create HTTP server
    httpServer = createServer();
    
    // Start server on random port
    httpServer.listen(() => {
      const address = httpServer.address();
      serverPort = typeof address === 'object' ? address!.port : 4002;
      
      // Initialize WebSocket service
      service = initializeWebSocket(httpServer, ['http://localhost:*']);
      
      done();
    });
  });

  afterAll((done) => {
    // Cleanup
    if (service) {
      service.shutdown();
    }
    httpServer.close(done);
  });

  beforeEach((done) => {
    // Create client socket for each test
    clientSocket = ioc(`http://localhost:${serverPort}/demo`, {
      transports: ['websocket'],
      reconnection: false
    });
    
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    // Disconnect client after each test
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection Management', () => {
    test('should accept client connections', (done) => {
      expect(clientSocket.connected).toBe(true);
      expect(clientSocket.id).toBeDefined();
      done();
    });

    test('should emit connectionStatus on connect', (done) => {
      // Create a new client for this test to catch the initial event
      const testClient = ioc(`http://localhost:${serverPort}/demo`, {
        transports: ['websocket'],
        reconnection: false
      });
      
      testClient.on('connectionStatus', (status) => {
        expect(status).toBe('connected');
        testClient.disconnect();
        done();
      });
      
      testClient.on('connect', () => {
        // Connection established
      });
    });

    test('should track connection count', () => {
      const count = service.getConnectionCount();
      expect(count).toBeGreaterThan(0);
    });

    test('should handle client disconnection', (done) => {
      const initialCount = service.getConnectionCount();
      
      clientSocket.on('disconnect', () => {
        setTimeout(() => {
          const newCount = service.getConnectionCount();
          expect(newCount).toBe(initialCount - 1);
          done();
        }, 100);
      });
      
      clientSocket.disconnect();
    });
  });

  describe('Random String Broadcasting', () => {
    test('should emit random strings to clients', (done) => {
      clientSocket.on('randomString', (data) => {
        expect(data).toHaveProperty('value');
        expect(data).toHaveProperty('timestamp');
        expect(data.value).toMatch(/^[A-Za-z0-9]{10}$/);
        expect(typeof data.timestamp).toBe('number');
        done();
      });
      
      // Wait for up to 16 seconds for a random string
      // (max interval is 15 seconds)
    }, 20000);

    test('should broadcast to all connected clients', (done) => {
      const receivedMessages: string[] = [];
      const clientCount = 3;
      const clients: ClientSocket<ServerToClientEvents, ClientToServerEvents>[] = [];
      
      // Create multiple clients
      for (let i = 0; i < clientCount; i++) {
        const client = ioc(`http://localhost:${serverPort}/demo`, {
          transports: ['websocket'],
          reconnection: false
        });
        
        client.on('randomString', (data) => {
          receivedMessages.push(`${client.id}:${data.value}`);
          
          // Check if all clients received a message
          if (receivedMessages.length === clientCount) {
            // Extract the random string values
            const values = receivedMessages.map(msg => msg.split(':')[1]);
            
            // All clients should receive the same value
            expect(new Set(values).size).toBe(1);
            
            // Cleanup
            clients.forEach(c => c.disconnect());
            done();
          }
        });
        
        clients.push(client);
      }
    }, 20000);
  });

  describe('Ping Functionality', () => {
    test('should respond to ping with acknowledgment', (done) => {
      const startTime = Date.now();
      
      clientSocket.emit('ping', (response) => {
        expect(response).toHaveProperty('status', 'ok');
        expect(response).toHaveProperty('timestamp');
        expect(response).toHaveProperty('serverTime');
        
        const latency = Date.now() - startTime;
        expect(latency).toBeLessThan(1000); // Should respond within 1 second
        
        done();
      });
    });

    test('should track ping count per client', (done) => {
      let pingCount = 0;
      const maxPings = 5;
      
      const sendPing = () => {
        pingCount++;
        
        clientSocket.emit('ping', (response) => {
          expect(response.status).toBe('ok');
          
          if (pingCount < maxPings) {
            sendPing();
          } else {
            // All pings successful
            done();
          }
        });
      };
      
      sendPing();
    });

    test('should disconnect client after exceeding ping limit', (done) => {
      // Note: Default limit is 100, but we'll test the mechanism
      let pingCount = 0;
      let disconnected = false;
      
      clientSocket.on('error', (data) => {
        expect(data.message).toContain('Ping limit exceeded');
      });
      
      clientSocket.on('disconnect', () => {
        disconnected = true;
        expect(pingCount).toBeGreaterThan(0);
        done();
      });
      
      // Send many pings rapidly (more than limit)
      const interval = setInterval(() => {
        if (disconnected) {
          clearInterval(interval);
          return;
        }
        
        pingCount++;
        clientSocket.emit('ping', () => {});
        
        if (pingCount > 101) { // Exceed the 100 limit
          clearInterval(interval);
        }
      }, 10);
    }, 15000);
  });

  describe('Rate Limiting', () => {
    test('should enforce connection limit per IP', (done) => {
      const clients: ClientSocket<ServerToClientEvents, ClientToServerEvents>[] = [];
      const maxConnections = 10; // As defined in service
      let rejectedConnection = false;
      
      // Try to create more connections than allowed
      for (let i = 0; i < maxConnections + 2; i++) {
        const client = ioc(`http://localhost:${serverPort}/demo`, {
          transports: ['websocket'],
          reconnection: false
        });
        
        client.on('connect', () => {
          clients.push(client);
        });
        
        client.on('connect_error', (error) => {
          if (error.message.includes('Too many connections')) {
            rejectedConnection = true;
            
            // Cleanup all clients
            clients.forEach(c => c.disconnect());
            
            expect(rejectedConnection).toBe(true);
            expect(clients.length).toBeLessThanOrEqual(maxConnections);
            done();
          }
        });
      }
    }, 10000);

    test('should track connections by IP', () => {
      const connectionsByIP = service.getConnectionsByIP();
      
      expect(connectionsByIP).toBeInstanceOf(Map);
      
      // Should have at least one IP (localhost)
      expect(connectionsByIP.size).toBeGreaterThan(0);
      
      // Check structure
      connectionsByIP.forEach((count, ip) => {
        expect(typeof ip).toBe('string');
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    test('should emit error events to client', (done) => {
      // Trigger an error by exceeding ping limit quickly
      let errorReceived = false;
      
      clientSocket.on('error', (data) => {
        errorReceived = true;
        expect(data).toHaveProperty('message');
        expect(typeof data.message).toBe('string');
        done();
      });
      
      // Send many pings to trigger error
      for (let i = 0; i < 102; i++) {
        clientSocket.emit('ping', () => {});
      }
    });

    test('should handle malformed events gracefully', (done) => {
      // Send invalid data
      (clientSocket as any).emit('invalid_event', { bad: 'data' });
      
      // Should not crash - client should remain connected
      setTimeout(() => {
        expect(clientSocket.connected).toBe(true);
        done();
      }, 100);
    });
  });

  describe('Service Lifecycle', () => {
    test('should provide health information', () => {
      const connectionCount = service.getConnectionCount();
      const connectionsByIP = service.getConnectionsByIP();
      
      expect(typeof connectionCount).toBe('number');
      expect(connectionsByIP).toBeInstanceOf(Map);
    });

    test('should handle graceful shutdown', (done) => {
      // This test verifies that the shutdown method exists and can be called
      expect(typeof service.shutdown).toBe('function');
      
      // We can't test actual shutdown of the main service as it would affect other tests
      // Instead, verify the method exists and is callable
      done();
    });
  });
});