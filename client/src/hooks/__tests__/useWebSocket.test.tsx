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