import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

export default function WebSocketDemo() {
  const { connectionInfo, messages, sendPing, clearMessages, connect, disconnect } = useWebSocket();
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get user info from localStorage (if available)
  const sessionId = localStorage.getItem('spotify_session_id');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
  };

  // Get message color based on type
  const getMessageColor = (type: string): string => {
    switch (type) {
      case 'randomString':
        return 'text-blue-400';
      case 'ping':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">
            WebSocket Demo
          </h1>
          <p className="text-gray-400">
            Real-time bidirectional communication with Socket.IO
          </p>
        </div>

        {/* Connection Status Card */}
        <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 mb-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Connection Status</h2>
            <div className="flex items-center gap-4">
              {/* Authentication Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${sessionId ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                <span className="text-sm text-gray-400">
                  {sessionId ? 'Authenticated' : 'No Session'}
                </span>
              </div>
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${connectionInfo.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className={`text-sm font-medium ${connectionInfo.connected ? 'text-green-400' : 'text-red-400'}`}>
                  {connectionInfo.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Socket ID:</span>
              <p className="text-white font-mono text-xs truncate">
                {connectionInfo.socketId || 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Transport:</span>
              <p className="text-white">
                {connectionInfo.transport || 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Messages:</span>
              <p className="text-white">{messages.length}</p>
            </div>
            <div>
              <span className="text-gray-500">Reconnect:</span>
              <p className="text-white">
                {connectionInfo.reconnectAttempt ? `Attempt ${connectionInfo.reconnectAttempt}` : 'N/A'}
              </p>
            </div>
          </div>

          {connectionInfo.lastError && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
              <p className="text-red-400 text-sm">
                Error: {connectionInfo.lastError}
              </p>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 mb-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">Controls</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={sendPing}
              disabled={!connectionInfo.connected}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
            >
              Send Ping
            </button>
            <button
              onClick={clearMessages}
              disabled={messages.length === 0}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
            >
              Clear Messages
            </button>
            <button
              onClick={() => connectionInfo.connected ? disconnect() : connect()}
              className={`px-4 py-2 ${
                connectionInfo.connected 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white rounded-lg transition-colors duration-200`}
            >
              {connectionInfo.connected ? 'Disconnect' : 'Connect'}
            </button>
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>
          </div>
        </div>

        {/* Messages Display */}
        <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Message History</h2>
            <span className="text-sm text-gray-400">
              Last 50 messages
            </span>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No messages yet. Waiting for data...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className="flex items-start gap-3 p-2 rounded hover:bg-gray-800/30 transition-all duration-300 animate-fadeIn"
                    style={{
                      animationDelay: `${index * 0.05}s`
                    }}
                  >
                    <span className="text-gray-600 text-xs whitespace-nowrap">
                      {formatTimestamp(message.timestamp)}
                    </span>
                    <span className={`flex-1 break-all ${getMessageColor(message.type)}`}>
                      {message.type === 'randomString' && '📨 '}
                      {message.type === 'ping' && '🏓 '}
                      {message.type === 'error' && '❌ '}
                      {message.value}
                    </span>
                    <span className="text-gray-600 text-xs">
                      {message.type}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>WebSocket endpoint: {import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:4001'}/demo</p>
          <p>Random strings are broadcast every 5-15 seconds to all connected clients</p>
        </div>
      </div>

      {/* Add fade-in animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}