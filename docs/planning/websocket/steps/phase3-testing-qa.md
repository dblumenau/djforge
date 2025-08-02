# Phase 3: Testing & Quality Assurance

## Developer Assignment: QA Engineer / Test Developer

## Overview
This phase implements comprehensive testing for both backend and frontend WebSocket implementations, ensuring reliability, performance, and proper error handling. The QA engineer will create automated tests, performance benchmarks, and validation procedures working with the completed Phase 1 and Phase 2 implementations.

## Prerequisites
- Node.js and npm installed
- Access to both `server/` and `client/` directories
- Understanding of Jest, React Testing Library
- Familiarity with Socket.IO testing patterns
- Both backend and frontend implementations complete

## Deliverables
1. Backend integration tests
2. Frontend component tests
3. End-to-end WebSocket tests
4. Performance benchmarks
5. Load testing scenarios
6. Test coverage reports

## Part A: Backend Testing

### Step 1: Install Testing Dependencies
```bash
cd server
npm install --save-dev jest @types/jest ts-jest socket.io-client supertest
npm install --save-dev @jest/globals
```

### Step 2: Configure Jest for Backend
**File:** `server/jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/server.ts' // Exclude main server file
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts']
};
```

### Step 3: Create Test Setup
**File:** `server/src/__tests__/setup.ts`

```typescript
import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '4002'; // Different port for tests

// Increase timeout for WebSocket tests
jest.setTimeout(10000);

// Mock winston to reduce test output noise
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn()
  },
  transports: {
    Console: jest.fn()
  }
}));
```

### Step 4: Backend WebSocket Service Tests
**File:** `server/src/services/__tests__/websocket.service.test.ts`

```typescript
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
      clientSocket.on('connectionStatus', (status) => {
        expect(status).toBe('connected');
        done();
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
      // Create a new service instance for this test
      const testServer = createServer();
      
      testServer.listen(() => {
        const testService = new WebSocketService(testServer);
        
        // Connect a client
        const port = (testServer.address() as any).port;
        const testClient = ioc(`http://localhost:${port}/demo`, {
          transports: ['websocket']
        });
        
        testClient.on('connect', () => {
          // Now shutdown the service
          testService.shutdown();
          
          // Client should be disconnected
          testClient.on('disconnect', () => {
            testServer.close(done);
          });
        });
      });
    });
  });
});
```

## Part B: Frontend Testing

### Step 5: Install Frontend Testing Dependencies
```bash
cd client
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev @testing-library/user-event @testing-library/react-hooks
npm install --save-dev jest-environment-jsdom
```

### Step 6: Frontend Hook Tests
**File:** `client/src/hooks/__tests__/useWebSocket.test.tsx`

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebSocket } from '../useWebSocket';
import { socket } from '../../services/socket';

// Mock the socket service
jest.mock('../../services/socket', () => ({
  socket: {
    connected: false,
    id: undefined,
    io: {
      engine: {
        transport: { name: 'websocket' }
      },
      on: jest.fn(),
      off: jest.fn()
    },
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  },
  isSocketConnected: jest.fn(() => false),
  getSocketId: jest.fn(() => 'test-socket-id'),
  getTransport: jest.fn(() => 'websocket')
}));

describe('useWebSocket Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    test('should initialize with disconnected state', () => {
      const { result } = renderHook(() => useWebSocket());
      
      expect(result.current.connectionInfo.connected).toBe(false);
      expect(result.current.messages).toHaveLength(0);
    });

    test('should connect on mount', () => {
      renderHook(() => useWebSocket());
      
      expect(socket.connect).toHaveBeenCalled();
    });

    test('should disconnect on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket());
      
      // Simulate connected state
      (socket as any).connected = true;
      
      unmount();
      
      expect(socket.disconnect).toHaveBeenCalled();
    });

    test('should update connection info when connected', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Simulate connection event
      const connectHandler = (socket.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connect')?.[1];
      
      act(() => {
        if (connectHandler) {
          (socket as any).connected = true;
          (socket as any).id = 'test-socket-id';
          connectHandler();
        }
      });
      
      await waitFor(() => {
        expect(result.current.connectionInfo.connected).toBe(true);
        expect(result.current.connectionInfo.socketId).toBe('test-socket-id');
        expect(result.current.connectionInfo.transport).toBe('websocket');
      });
    });

    test('should handle disconnection', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // First connect
      const connectHandler = (socket.on as jest.Mock).mock.calls
        .find(call => call[0] === 'connect')?.[1];
      
      act(() => {
        if (connectHandler) {
          (socket as any).connected = true;
          connectHandler();
        }
      });
      
      // Then disconnect
      const disconnectHandler = (socket.on as jest.Mock).mock.calls
        .find(call => call[0] === 'disconnect')?.[1];
      
      act(() => {
        if (disconnectHandler) {
          (socket as any).connected = false;
          disconnectHandler('transport close');
        }
      });
      
      await waitFor(() => {
        expect(result.current.connectionInfo.connected).toBe(false);
        expect(result.current.connectionInfo.lastError).toBe('transport close');
      });
    });
  });

  describe('Message Handling', () => {
    test('should handle random string messages', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      const randomStringHandler = (socket.on as jest.Mock).mock.calls
        .find(call => call[0] === 'randomString')?.[1];
      
      const testData = {
        value: 'abc123XYZ0',
        timestamp: Date.now()
      };
      
      act(() => {
        if (randomStringHandler) {
          randomStringHandler(testData);
        }
      });
      
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].type).toBe('randomString');
        expect(result.current.messages[0].value).toBe(testData.value);
        expect(result.current.messages[0].timestamp).toBe(testData.timestamp);
      });
    });

    test('should handle error messages', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      const errorHandler = (socket.on as jest.Mock).mock.calls
        .find(call => call[0] === 'error')?.[1];
      
      const errorData = {
        message: 'Test error',
        code: 'TEST_ERROR'
      };
      
      act(() => {
        if (errorHandler) {
          errorHandler(errorData);
        }
      });
      
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].type).toBe('error');
        expect(result.current.messages[0].value).toBe(errorData.message);
      });
    });

    test('should limit message history to 50 messages', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      const randomStringHandler = (socket.on as jest.Mock).mock.calls
        .find(call => call[0] === 'randomString')?.[1];
      
      // Add 60 messages
      act(() => {
        for (let i = 0; i < 60; i++) {
          if (randomStringHandler) {
            randomStringHandler({
              value: `message${i}`,
              timestamp: Date.now() + i
            });
          }
        }
      });
      
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(50);
        // Should have kept the last 50 messages
        expect(result.current.messages[0].value).toBe('message10');
        expect(result.current.messages[49].value).toBe('message59');
      });
    });
  });

  describe('Ping Functionality', () => {
    test('should send ping when connected', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Simulate connected state
      (socket as any).connected = true;
      
      // Mock emit with callback
      (socket.emit as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'ping' && typeof callback === 'function') {
          // Simulate server response
          setTimeout(() => {
            callback({
              status: 'ok',
              timestamp: Date.now(),
              serverTime: Date.now()
            });
          }, 50);
        }
      });
      
      act(() => {
        result.current.sendPing();
      });
      
      expect(socket.emit).toHaveBeenCalledWith('ping', expect.any(Function));
      
      // Wait for ping response
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0].type).toBe('ping');
        expect(result.current.messages[0].value).toContain('Pong! Latency:');
      });
    });

    test('should not send ping when disconnected', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Ensure disconnected state
      (socket as any).connected = false;
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      act(() => {
        result.current.sendPing();
      });
      
      expect(socket.emit).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useWebSocket] Cannot send ping - not connected'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Message Management', () => {
    test('should clear messages', async () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Add some messages
      const randomStringHandler = (socket.on as jest.Mock).mock.calls
        .find(call => call[0] === 'randomString')?.[1];
      
      act(() => {
        if (randomStringHandler) {
          randomStringHandler({ value: 'test1', timestamp: Date.now() });
          randomStringHandler({ value: 'test2', timestamp: Date.now() });
        }
      });
      
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });
      
      // Clear messages
      act(() => {
        result.current.clearMessages();
      });
      
      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('Manual Connection Control', () => {
    test('should handle manual connect', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Reset mock to clear auto-connect
      (socket.connect as jest.Mock).mockClear();
      (socket as any).connected = false;
      
      act(() => {
        result.current.connect();
      });
      
      expect(socket.connect).toHaveBeenCalled();
    });

    test('should handle manual disconnect', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Simulate connected state
      (socket as any).connected = true;
      
      act(() => {
        result.current.disconnect();
      });
      
      expect(socket.disconnect).toHaveBeenCalled();
    });

    test('should prevent multiple connections', () => {
      const { result } = renderHook(() => useWebSocket());
      
      // Simulate already connected
      (socket as any).connected = true;
      (socket.connect as jest.Mock).mockClear();
      
      act(() => {
        result.current.connect();
      });
      
      expect(socket.connect).not.toHaveBeenCalled();
    });
  });
});
```

### Step 7: Component Tests
**File:** `client/src/pages/__tests__/WebSocketDemo.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebSocketDemo from '../WebSocketDemo';
import { useWebSocket } from '../../hooks/useWebSocket';

// Mock the useWebSocket hook
jest.mock('../../hooks/useWebSocket');

const mockUseWebSocket = useWebSocket as jest.MockedFunction<typeof useWebSocket>;

describe('WebSocketDemo Component', () => {
  const defaultMockReturn = {
    connectionInfo: {
      connected: false,
      socketId: undefined,
      transport: undefined
    },
    messages: [],
    sendPing: jest.fn(),
    clearMessages: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  };

  beforeEach(() => {
    mockUseWebSocket.mockReturnValue(defaultMockReturn);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should render component with title', () => {
      render(<WebSocketDemo />);
      
      expect(screen.getByText('WebSocket Demo')).toBeInTheDocument();
      expect(screen.getByText(/Real-time bidirectional communication/)).toBeInTheDocument();
    });

    test('should show disconnected status initially', () => {
      render(<WebSocketDemo />);
      
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    test('should show connected status when connected', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockReturn,
        connectionInfo: {
          connected: true,
          socketId: 'test-socket-123',
          transport: 'websocket'
        }
      });
      
      render(<WebSocketDemo />);
      
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('test-socket-123')).toBeInTheDocument();
      expect(screen.getByText('websocket')).toBeInTheDocument();
    });
  });

  describe('Control Buttons', () => {
    test('should call sendPing when ping button clicked', async () => {
      const sendPing = jest.fn();
      mockUseWebSocket.mockReturnValue({
        ...defaultMockReturn,
        connectionInfo: { connected: true },
        sendPing
      });
      
      render(<WebSocketDemo />);
      
      const pingButton = screen.getByText('Send Ping');
      await userEvent.click(pingButton);
      
      expect(sendPing).toHaveBeenCalled();
    });

    test('should disable ping button when disconnected', () => {
      render(<WebSocketDemo />);
      
      const pingButton = screen.getByText('Send Ping');
      expect(pingButton).toBeDisabled();
    });

    test('should call clearMessages when clear button clicked', async () => {
      const clearMessages = jest.fn();
      mockUseWebSocket.mockReturnValue({
        ...defaultMockReturn,
        messages: [
          { id: '1', type: 'randomString', value: 'test', timestamp: Date.now() }
        ],
        clearMessages
      });
      
      render(<WebSocketDemo />);
      
      const clearButton = screen.getByText('Clear Messages');
      await userEvent.click(clearButton);
      
      expect(clearMessages).toHaveBeenCalled();
    });

    test('should toggle between connect and disconnect', async () => {
      const connect = jest.fn();
      const disconnect = jest.fn();
      
      const { rerender } = render(<WebSocketDemo />);
      
      // Initially disconnected
      mockUseWebSocket.mockReturnValue({
        ...defaultMockReturn,
        connect,
        disconnect
      });
      
      rerender(<WebSocketDemo />);
      
      const connectButton = screen.getByText('Connect');
      await userEvent.click(connectButton);
      
      expect(connect).toHaveBeenCalled();
      
      // Now connected
      mockUseWebSocket.mockReturnValue({
        ...defaultMockReturn,
        connectionInfo: { connected: true },
        connect,
        disconnect
      });
      
      rerender(<WebSocketDemo />);
      
      const disconnectButton = screen.getByText('Disconnect');
      await userEvent.click(disconnectButton);
      
      expect(disconnect).toHaveBeenCalled();
    });
  });

  describe('Message Display', () => {
    test('should show empty state when no messages', () => {
      render(<WebSocketDemo />);
      
      expect(screen.getByText('No messages yet. Waiting for data...')).toBeInTheDocument();
    });

    test('should display messages', () => {
      const messages = [
        {
          id: '1',
          type: 'randomString' as const,
          value: 'abc123',
          timestamp: Date.now()
        },
        {
          id: '2',
          type: 'ping' as const,
          value: 'Pong! Latency: 45ms',
          timestamp: Date.now()
        },
        {
          id: '3',
          type: 'error' as const,
          value: 'Connection error',
          timestamp: Date.now()
        }
      ];
      
      mockUseWebSocket.mockReturnValue({
        ...defaultMockReturn,
        messages
      });
      
      render(<WebSocketDemo />);
      
      expect(screen.getByText(/abc123/)).toBeInTheDocument();
      expect(screen.getByText(/Pong! Latency: 45ms/)).toBeInTheDocument();
      expect(screen.getByText(/Connection error/)).toBeInTheDocument();
    });

    test('should show message count', () => {
      const messages = Array.from({ length: 25 }, (_, i) => ({
        id: `${i}`,
        type: 'randomString' as const,
        value: `message${i}`,
        timestamp: Date.now() + i
      }));
      
      mockUseWebSocket.mockReturnValue({
        ...defaultMockReturn,
        messages
      });
      
      render(<WebSocketDemo />);
      
      expect(screen.getByText('25')).toBeInTheDocument();
    });
  });

  describe('Auto-scroll', () => {
    test('should toggle auto-scroll checkbox', async () => {
      render(<WebSocketDemo />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
      
      await userEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
      
      await userEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe('Error Display', () => {
    test('should show last error when present', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockReturn,
        connectionInfo: {
          connected: false,
          lastError: 'WebSocket connection failed'
        }
      });
      
      render(<WebSocketDemo />);
      
      expect(screen.getByText(/Error: WebSocket connection failed/)).toBeInTheDocument();
    });
  });

  describe('Reconnection Display', () => {
    test('should show reconnection attempts', () => {
      mockUseWebSocket.mockReturnValue({
        ...defaultMockReturn,
        connectionInfo: {
          connected: false,
          reconnectAttempt: 3
        }
      });
      
      render(<WebSocketDemo />);
      
      expect(screen.getByText('Attempt 3')).toBeInTheDocument();
    });
  });
});
```

## Part C: End-to-End Testing

### Step 8: E2E Test Setup
**File:** `e2e/websocket.e2e.test.ts`

```typescript
import { chromium, Browser, Page, BrowserContext } from 'playwright';

describe('WebSocket E2E Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page1: Page;
  let page2: Page;
  
  const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4001';
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false'
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    context = await browser.newContext();
    page1 = await context.newPage();
    page2 = await context.newPage();
  });

  afterEach(async () => {
    await context.close();
  });

  test('should establish WebSocket connection', async () => {
    await page1.goto(`${CLIENT_URL}/websocket-demo`);
    
    // Wait for connection
    await page1.waitForSelector('text=Connected', { timeout: 5000 });
    
    // Verify connection indicators
    const statusText = await page1.textContent('.text-green-400');
    expect(statusText).toBe('Connected');
    
    // Check for socket ID
    const socketId = await page1.textContent('text=/^[a-zA-Z0-9_-]+$/');
    expect(socketId).toBeTruthy();
  });

  test('should receive random strings', async () => {
    await page1.goto(`${CLIENT_URL}/websocket-demo`);
    await page1.waitForSelector('text=Connected');
    
    // Wait for at least one random string (max 16 seconds)
    await page1.waitForSelector('text=/^[A-Za-z0-9]{10}$/', { timeout: 16000 });
    
    // Verify message appears in history
    const messages = await page1.$$('.animate-fadeIn');
    expect(messages.length).toBeGreaterThan(0);
  });

  test('should synchronize messages across multiple clients', async () => {
    // Connect both pages
    await page1.goto(`${CLIENT_URL}/websocket-demo`);
    await page2.goto(`${CLIENT_URL}/websocket-demo`);
    
    // Wait for both to connect
    await page1.waitForSelector('text=Connected');
    await page2.waitForSelector('text=Connected');
    
    // Wait for a random string on page1
    await page1.waitForSelector('text=/^[A-Za-z0-9]{10}$/', { timeout: 16000 });
    
    // Get the random string value from page1
    const message1 = await page1.textContent('.text-blue-400');
    
    // Check that page2 has the same message
    const message2 = await page2.textContent('.text-blue-400');
    
    expect(message1).toBe(message2);
  });

  test('should handle ping functionality', async () => {
    await page1.goto(`${CLIENT_URL}/websocket-demo`);
    await page1.waitForSelector('text=Connected');
    
    // Click ping button
    await page1.click('text=Send Ping');
    
    // Wait for pong response
    await page1.waitForSelector('text=/Pong! Latency: \\d+ms/');
    
    // Verify latency is reasonable
    const latencyText = await page1.textContent('text=/Pong! Latency: \\d+ms/');
    const latency = parseInt(latencyText!.match(/\\d+/)![0]);
    expect(latency).toBeLessThan(1000); // Should be less than 1 second
  });

  test('should handle disconnection and reconnection', async () => {
    await page1.goto(`${CLIENT_URL}/websocket-demo`);
    await page1.waitForSelector('text=Connected');
    
    // Click disconnect
    await page1.click('text=Disconnect');
    await page1.waitForSelector('text=Disconnected');
    
    // Verify status changed
    const disconnectedStatus = await page1.textContent('.text-red-400');
    expect(disconnectedStatus).toBe('Disconnected');
    
    // Reconnect
    await page1.click('text=Connect');
    await page1.waitForSelector('text=Connected');
    
    // Verify reconnected
    const connectedStatus = await page1.textContent('.text-green-400');
    expect(connectedStatus).toBe('Connected');
  });

  test('should clear message history', async () => {
    await page1.goto(`${CLIENT_URL}/websocket-demo`);
    await page1.waitForSelector('text=Connected');
    
    // Wait for some messages
    await page1.waitForSelector('text=/^[A-Za-z0-9]{10}$/', { timeout: 16000 });
    
    // Clear messages
    await page1.click('text=Clear Messages');
    
    // Verify messages cleared
    await page1.waitForSelector('text=No messages yet. Waiting for data...');
  });

  test('should show reconnection attempts on server restart', async () => {
    await page1.goto(`${CLIENT_URL}/websocket-demo`);
    await page1.waitForSelector('text=Connected');
    
    // Simulate server disconnect by evaluating in browser context
    await page1.evaluate(() => {
      (window as any).socket?.disconnect();
    });
    
    // Should show disconnected
    await page1.waitForSelector('text=Disconnected');
    
    // Should show reconnection attempts
    await page1.waitForSelector('text=/Attempt \\d+/', { timeout: 10000 });
  });
});
```

## Part D: Performance & Load Testing

### Step 9: Performance Benchmarks
**File:** `performance/websocket-benchmark.js`

```javascript
const io = require('socket.io-client');
const { performance } = require('perf_hooks');

class WebSocketBenchmark {
  constructor(serverUrl = 'http://localhost:4001', namespace = '/demo') {
    this.serverUrl = serverUrl;
    this.namespace = namespace;
    this.results = {
      connectionTimes: [],
      pingLatencies: [],
      messageReceiveTimes: [],
      errors: []
    };
  }

  async runConnectionTest(clientCount = 100) {
    console.log(`Starting connection test with ${clientCount} clients...`);
    const clients = [];
    const startTime = performance.now();

    const connectionPromises = Array.from({ length: clientCount }, (_, i) => {
      return new Promise((resolve, reject) => {
        const clientStartTime = performance.now();
        const client = io(`${this.serverUrl}${this.namespace}`, {
          transports: ['websocket'],
          reconnection: false
        });

        client.on('connect', () => {
          const connectionTime = performance.now() - clientStartTime;
          this.results.connectionTimes.push(connectionTime);
          clients.push(client);
          resolve(client);
        });

        client.on('connect_error', (error) => {
          this.results.errors.push(error.message);
          reject(error);
        });

        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });
    });

    try {
      await Promise.all(connectionPromises);
      const totalTime = performance.now() - startTime;

      console.log(`All ${clientCount} clients connected in ${totalTime.toFixed(2)}ms`);
      console.log(`Average connection time: ${this.calculateAverage(this.results.connectionTimes).toFixed(2)}ms`);
      console.log(`Max connection time: ${Math.max(...this.results.connectionTimes).toFixed(2)}ms`);
      console.log(`Min connection time: ${Math.min(...this.results.connectionTimes).toFixed(2)}ms`);

      return clients;
    } catch (error) {
      console.error('Connection test failed:', error);
      throw error;
    }
  }

  async runPingTest(clients, pingsPerClient = 10) {
    console.log(`\\nStarting ping test with ${clients.length} clients...`);
    const pingPromises = [];

    for (const client of clients) {
      for (let i = 0; i < pingsPerClient; i++) {
        pingPromises.push(
          new Promise((resolve) => {
            const startTime = performance.now();
            client.emit('ping', (response) => {
              const latency = performance.now() - startTime;
              this.results.pingLatencies.push(latency);
              resolve(latency);
            });
          })
        );
      }
    }

    await Promise.all(pingPromises);

    console.log(`Total pings sent: ${pingPromises.length}`);
    console.log(`Average ping latency: ${this.calculateAverage(this.results.pingLatencies).toFixed(2)}ms`);
    console.log(`Max ping latency: ${Math.max(...this.results.pingLatencies).toFixed(2)}ms`);
    console.log(`Min ping latency: ${Math.min(...this.results.pingLatencies).toFixed(2)}ms`);
    console.log(`95th percentile: ${this.calculatePercentile(this.results.pingLatencies, 95).toFixed(2)}ms`);
  }

  async runMessageReceiveTest(clients, duration = 30000) {
    console.log(`\\nStarting message receive test for ${duration / 1000} seconds...`);
    let messageCount = 0;
    const startTime = performance.now();

    // Set up message listeners
    clients.forEach(client => {
      client.on('randomString', (data) => {
        const receiveTime = performance.now() - startTime;
        this.results.messageReceiveTimes.push(receiveTime);
        messageCount++;
      });
    });

    // Wait for duration
    await new Promise(resolve => setTimeout(resolve, duration));

    const totalTime = performance.now() - startTime;
    const messagesPerSecond = (messageCount / (totalTime / 1000));

    console.log(`Total messages received: ${messageCount}`);
    console.log(`Messages per second: ${messagesPerSecond.toFixed(2)}`);
    console.log(`Messages per client: ${(messageCount / clients.length).toFixed(2)}`);
  }

  async runLoadTest(config = {}) {
    const {
      clientCount = 100,
      pingsPerClient = 10,
      testDuration = 30000
    } = config;

    console.log('=== WebSocket Load Test Starting ===');
    console.log(`Configuration:`);
    console.log(`  - Clients: ${clientCount}`);
    console.log(`  - Pings per client: ${pingsPerClient}`);
    console.log(`  - Test duration: ${testDuration / 1000}s\\n`);

    try {
      // Connection test
      const clients = await this.runConnectionTest(clientCount);

      // Ping test
      await this.runPingTest(clients, pingsPerClient);

      // Message receive test
      await this.runMessageReceiveTest(clients, testDuration);

      // Cleanup
      console.log('\\nCleaning up connections...');
      clients.forEach(client => client.disconnect());

      // Summary
      this.printSummary();

    } catch (error) {
      console.error('Load test failed:', error);
      console.log(`Errors encountered: ${this.results.errors.length}`);
      this.results.errors.forEach(err => console.log(`  - ${err}`));
    }
  }

  calculateAverage(numbers) {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  calculatePercentile(numbers, percentile) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  printSummary() {
    console.log('\\n=== Test Summary ===');
    console.log(`Total successful connections: ${this.results.connectionTimes.length}`);
    console.log(`Total pings completed: ${this.results.pingLatencies.length}`);
    console.log(`Total messages received: ${this.results.messageReceiveTimes.length}`);
    console.log(`Total errors: ${this.results.errors.length}`);

    if (this.results.errors.length > 0) {
      console.log('\\nErrors:');
      const errorCounts = {};
      this.results.errors.forEach(error => {
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      });
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`  - ${error}: ${count} times`);
      });
    }
  }
}

// Run the benchmark
if (require.main === module) {
  const benchmark = new WebSocketBenchmark();
  
  // Configure test parameters
  const config = {
    clientCount: parseInt(process.env.CLIENT_COUNT) || 100,
    pingsPerClient: parseInt(process.env.PINGS_PER_CLIENT) || 10,
    testDuration: parseInt(process.env.TEST_DURATION) || 30000
  };

  benchmark.runLoadTest(config).then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Benchmark failed:', error);
    process.exit(1);
  });
}

module.exports = WebSocketBenchmark;
```

## Part E: Test Scripts and CI Integration

### Step 10: Package.json Test Scripts
**Add to** `package.json` in root:

```json
{
  "scripts": {
    "test": "npm run test:server && npm run test:client",
    "test:server": "cd server && npm test",
    "test:client": "cd client && npm test",
    "test:e2e": "playwright test",
    "test:load": "node performance/websocket-benchmark.js",
    "test:coverage": "npm run test:server -- --coverage && npm run test:client -- --coverage",
    "test:watch": "concurrently \"npm run test:server -- --watch\" \"npm run test:client -- --watch\""
  }
}
```

### Step 11: GitHub Actions CI
**File:** `.github/workflows/websocket-tests.yml`

```yaml
name: WebSocket Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Install dependencies
      run: |
        npm run install:all
        npx playwright install chromium
    
    - name: Run backend tests
      run: cd server && npm test -- --coverage
    
    - name: Run frontend tests
      run: cd client && npm test -- --coverage
    
    - name: Start servers for E2E
      run: |
        cd server && npm run build && npm start &
        cd client && npm run build && npm run preview &
        sleep 5
    
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        SERVER_URL: http://localhost:4001
        CLIENT_URL: http://localhost:4173
    
    - name: Run load tests
      run: npm run test:load
      env:
        CLIENT_COUNT: 50
        PINGS_PER_CLIENT: 5
        TEST_DURATION: 10000
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./server/coverage/lcov.info,./client/coverage/lcov.info
```

## Testing Checklist

### Backend Testing ✅
- [ ] Unit tests for WebSocket service
- [ ] Connection management tests
- [ ] Rate limiting tests
- [ ] Message broadcasting tests
- [ ] Ping/pong functionality tests
- [ ] Error handling tests
- [ ] Graceful shutdown tests
- [ ] 70%+ code coverage

### Frontend Testing ✅
- [ ] Hook tests (useWebSocket)
- [ ] Component tests (WebSocketDemo)
- [ ] Connection state management
- [ ] Message handling tests
- [ ] UI interaction tests
- [ ] Error display tests
- [ ] 70%+ code coverage

### E2E Testing ✅
- [ ] Multi-client synchronization
- [ ] Connection/disconnection flows
- [ ] Message delivery verification
- [ ] Ping functionality
- [ ] UI responsiveness
- [ ] Reconnection scenarios

### Performance Testing ✅
- [ ] Connection scalability (100+ clients)
- [ ] Message throughput measurement
- [ ] Latency benchmarks
- [ ] Memory usage monitoring
- [ ] CPU usage monitoring
- [ ] Network bandwidth usage

### Load Testing Targets
- [ ] Support 100 concurrent connections
- [ ] < 100ms average ping latency
- [ ] < 500ms connection time
- [ ] 95th percentile latency < 200ms
- [ ] Zero message loss under normal load
- [ ] Graceful degradation under overload

## Running the Complete Test Suite

```bash
# Install all dependencies
npm run install:all

# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests (requires servers running)
npm run dev # In one terminal
npm run test:e2e # In another terminal

# Run load tests
npm run test:load

# Run specific test suites
cd server && npm test -- --testNamePattern="WebSocketService"
cd client && npm test -- --testNamePattern="useWebSocket"

# Watch mode for development
npm run test:watch
```

## Test Metrics and Reporting

### Coverage Goals
- **Overall:** 80% line coverage
- **Critical paths:** 90% coverage
- **Error handling:** 100% coverage
- **WebSocket events:** 100% coverage

### Performance Baselines
- **Connection time:** < 500ms (p95)
- **Ping latency:** < 100ms (p95)
- **Message delivery:** < 50ms (p95)
- **Concurrent clients:** 100+ stable
- **Memory per client:** < 1MB
- **CPU usage:** < 5% for 100 clients

### Quality Gates
1. All tests must pass
2. No decrease in coverage
3. Performance within baselines
4. No security vulnerabilities
5. TypeScript compilation without errors

## Notes for Development Team

This testing suite ensures:

1. **Reliability:** Comprehensive coverage of all WebSocket functionality
2. **Performance:** Validated against realistic load scenarios
3. **Maintainability:** Clear test structure and documentation
4. **CI/CD Ready:** Automated testing in pipeline
5. **Monitoring:** Performance baselines for production

The tests are independent and can be run in any order. Each phase of implementation can be validated independently before integration.