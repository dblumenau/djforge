import { render, screen } from '@testing-library/react';
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