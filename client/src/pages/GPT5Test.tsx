import { useState, useRef, useEffect } from 'react';
import { authService } from '../services/auth.service';
import { apiEndpoint } from '../config/api';
import { useWebSocket } from '../hooks/useWebSocket';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'function' | 'websocket' | 'console';
  content: string;
  timestamp: Date;
  functionCall?: {
    name: string;
    arguments: any;
    result?: any;
  };
  websocketEvent?: {
    event: string;
    data: any;
  };
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
  };
}

export function GPT5Test() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('Play Hotel California by Eagles');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [manualSessionId, setManualSessionId] = useState('');
  const [useManualSession, setUseManualSession] = useState(false);
  const [model, setModel] = useState('gpt-5-nano');
  const [useTools, setUseTools] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [showWebSocketEvents, setShowWebSocketEvents] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingMessageRef = useRef<string>('');
  const currentStreamingId = useRef<string>('');

  // WebSocket integration
  const { 
    isConnected: wsConnected, 
    playbackState, 
    connectionInfo 
  } = useWebSocket();

  useEffect(() => {
    // Check for session on mount
    const storedSession = authService.getSessionId();
    setSessionId(storedSession);
  }, []);

  // Listen for WebSocket playback updates
  useEffect(() => {
    if (showWebSocketEvents && playbackState) {
      addWebSocketMessage('playback_update', playbackState);
    }
  }, [playbackState, showWebSocketEvents]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getCurrentSessionId = () => {
    return useManualSession ? manualSessionId : sessionId;
  };

  const handleSetManualSession = () => {
    if (manualSessionId.trim()) {
      setUseManualSession(true);
      addSystemMessage(`Using manual session ID: ${manualSessionId}`);
    }
  };

  const handleClearManualSession = () => {
    setUseManualSession(false);
    setManualSessionId('');
    addSystemMessage('Cleared manual session. Using stored session.');
  };

  const addSystemMessage = (content: string, metadata?: any) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: new Date(),
      metadata
    };
    setMessages(prev => [...prev, message]);
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const addAssistantMessage = (content: string, functionCall?: any, metadata?: any) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'assistant',
      content,
      timestamp: new Date(),
      functionCall,
      metadata
    };
    setMessages(prev => [...prev, message]);
  };

  const addWebSocketMessage = (event: string, data: any) => {
    const message: Message = {
      id: 'ws-' + Date.now().toString(),
      type: 'websocket',
      content: `WebSocket: ${event}`,
      timestamp: new Date(),
      websocketEvent: { event, data }
    };
    setMessages(prev => [...prev, message]);
  };

  const addConsoleMessage = (content: string, metadata?: any) => {
    const message: Message = {
      id: 'console-' + Date.now().toString(),
      type: 'console',
      content,
      timestamp: new Date(),
      metadata
    };
    setMessages(prev => [...prev, message]);
  };

  const handleStandardResponse = async (currentSessionId: string) => {
    try {
      const response = await fetch(apiEndpoint('/api/gpt5/command'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': currentSessionId
        },
        body: JSON.stringify({
          command: input,
          model,
          useTools,
          temperature
        })
      });

      const data = await response.json();

      if (!response.ok) {
        addSystemMessage(`Error: ${data.error || 'Request failed'}`);
        return;
      }

      // Handle the response
      if (data.functionCalls && data.functionCalls.length > 0) {
        data.functionCalls.forEach((fc: any) => {
          addAssistantMessage(
            `Calling function: ${fc.name}`,
            {
              name: fc.name,
              arguments: fc.arguments,
              result: fc.result
            }
          );
        });
      }

      if (data.content) {
        addAssistantMessage(data.content);
      }

      if (data.usage) {
        addSystemMessage(`Tokens used: ${data.usage.total_tokens} (prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens})`);
      }

    } catch (error: any) {
      addSystemMessage(`Network error: ${error.message}`);
    }
  };

  const handleStreamingResponse = async (currentSessionId: string) => {
    try {
      const response = await fetch(apiEndpoint('/api/gpt5/command'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': currentSessionId,
          'X-Stream-Response': 'true'
        },
        body: JSON.stringify({
          command: input,
          model,
          useTools,
          temperature,
          stream: true
        })
      });

      if (!response.ok) {
        const error = await response.json();
        addSystemMessage(`Error: ${error.error || 'Request failed'}`);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        addSystemMessage('Streaming not supported by browser');
        return;
      }

      // Create a placeholder message for streaming
      currentStreamingId.current = 'streaming-' + Date.now();
      const streamingMessage: Message = {
        id: currentStreamingId.current,
        type: 'assistant',
        content: '',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, streamingMessage]);
      
      streamingMessageRef.current = '';
      let buffer = '';
      let functionCalls: any[] = [];
      let reasoningContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              if (functionCalls.length > 0) {
                addConsoleMessage('Functions executed during stream:', { functions: functionCalls });
              }
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              
              // Handle all different event types from GPT-5 streaming
              switch (parsed.type) {
                case 'content':
                  // Regular content streaming
                  streamingMessageRef.current += parsed.content;
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === currentStreamingId.current 
                        ? { ...msg, content: streamingMessageRef.current }
                        : msg
                    )
                  );
                  break;

                case 'reasoning':
                  // Reasoning tokens (console output)
                  reasoningContent += parsed.content;
                  addConsoleMessage(`Reasoning: ${parsed.content}`);
                  break;

                case 'function_call':
                  // Function call during stream
                  functionCalls.push(parsed);
                  addConsoleMessage(`Function Call: ${parsed.name}`, {
                    call_id: parsed.call_id,
                    arguments: parsed.arguments
                  });
                  break;

                case 'function_call_output':
                  // Function execution result
                  addConsoleMessage(`Function Result: ${parsed.name}`, {
                    call_id: parsed.call_id,
                    output: parsed.output
                  });
                  break;

                case 'response_metadata':
                  // Metadata about the response
                  addSystemMessage('Response Metadata', {
                    model: parsed.model,
                    response_id: parsed.response_id,
                    created_at: parsed.created_at
                  });
                  break;

                case 'usage':
                  // Token usage information
                  const usage = parsed.usage || parsed;
                  let usageText = `Tokens: ${usage.total_tokens || 0}`;
                  if (usage.prompt_tokens) usageText += ` (prompt: ${usage.prompt_tokens}`;
                  if (usage.completion_tokens) usageText += `, completion: ${usage.completion_tokens}`;
                  if (usage.reasoning_tokens) usageText += `, reasoning: ${usage.reasoning_tokens}`;
                  usageText += ')';
                  addSystemMessage(usageText);
                  break;

                case 'error':
                  addSystemMessage(`Stream error: ${parsed.error}`, { code: parsed.code });
                  break;

                case 'console':
                  // Console output from test scripts
                  addConsoleMessage(parsed.message || parsed.content);
                  break;

                case 'debug':
                  // Debug information
                  addConsoleMessage(`Debug: ${parsed.message}`, parsed.data);
                  break;

                default:
                  // Unknown event type - log it
                  addConsoleMessage(`Unknown event: ${parsed.type}`, parsed);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', data, e);
              addConsoleMessage(`Parse error: ${data.substring(0, 100)}...`);
            }
          }
        }
      }

      // If we accumulated reasoning content, show summary
      if (reasoningContent) {
        addSystemMessage(`Total reasoning: ${reasoningContent.length} characters`);
      }

    } catch (error: any) {
      addSystemMessage(`Stream error: ${error.message}`);
    }
  };

  const handleSend = async (useStreaming: boolean = false) => {
    const currentSessionId = getCurrentSessionId();
    
    if (!currentSessionId) {
      addSystemMessage('No session ID available. Please login or set a manual session ID.');
      return;
    }

    if (!input.trim()) {
      addSystemMessage('Please enter a command.');
      return;
    }

    addUserMessage(input);
    setIsStreaming(useStreaming);

    if (useStreaming) {
      await handleStreamingResponse(currentSessionId);
    } else {
      await handleStandardResponse(currentSessionId);
    }

    setIsStreaming(false);
  };

  const quickCommands = [
    'Play Stairway to Heaven by Led Zeppelin',
    'Play some Beatles',
    'Play something relaxing',
    'What is currently playing?',
    'Skip to the next track',
    'Pause the music'
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-green-400">🚀 GPT-5 Test Interface</h1>

        {/* Session Management */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-3">Session Management</h2>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Current Session:</span>
              <span className="text-green-400 font-mono text-sm">
                {getCurrentSessionId() || 'Not set'}
              </span>
              {useManualSession && (
                <span className="text-xs bg-blue-600 px-2 py-1 rounded">Manual</span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={manualSessionId}
                onChange={(e) => setManualSessionId(e.target.value)}
                placeholder="Enter manual session ID"
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-400"
              />
              <button
                onClick={handleSetManualSession}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
              >
                Set Manual
              </button>
              <button
                onClick={handleClearManualSession}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-3">Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-400"
              >
                <option value="gpt-5-nano">GPT-5 Nano</option>
                <option value="gpt-5">GPT-5</option>
                <option value="gpt-5-pro">GPT-5 Pro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Temperature ({temperature})</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useTools}
                  onChange={(e) => setUseTools(e.target.checked)}
                  className="w-4 h-4 text-green-600"
                />
                <span>Enable Tools (Function Calling)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Quick Commands */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-3">Quick Commands</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {quickCommands.map((cmd) => (
              <button
                key={cmd}
                onClick={() => setInput(cmd)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors text-left"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4 h-96 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-3">Conversation</h2>
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.type === 'user' 
                    ? 'bg-blue-900 ml-12' 
                    : msg.type === 'assistant'
                    ? 'bg-gray-700 mr-12'
                    : msg.type === 'system'
                    ? 'bg-yellow-900 text-yellow-200 text-sm'
                    : 'bg-purple-900 mr-12'
                }`}
              >
                <div className="text-xs text-gray-400 mb-1">
                  {msg.type.toUpperCase()} - {msg.timestamp.toLocaleTimeString()}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.functionCall && (
                  <div className="mt-2 p-2 bg-black bg-opacity-30 rounded text-sm">
                    <div className="font-semibold text-green-400">{msg.functionCall.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Args: {JSON.stringify(msg.functionCall.arguments, null, 2)}
                    </div>
                    {msg.functionCall.result && (
                      <div className="text-xs text-gray-300 mt-1">
                        Result: {JSON.stringify(msg.functionCall.result, null, 2)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isStreaming && handleSend(false)}
              placeholder="Enter a command..."
              disabled={isStreaming}
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-400 disabled:opacity-50"
            />
            <button
              onClick={() => handleSend(false)}
              disabled={isStreaming}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded transition-colors"
            >
              Send
            </button>
            <button
              onClick={() => handleSend(true)}
              disabled={isStreaming}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
            >
              Stream
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}