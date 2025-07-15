import React, { useState, useEffect } from 'react';
import MusicLoader from './MusicLoader';
import SpotifyPlayer from './SpotifyPlayer';
import ModelSelector from './ModelSelector';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { apiEndpoint } from '../config/api';
import { authenticatedFetch } from '../utils/api';

// Helper component for clickable example lists
const ExampleList: React.FC<{ examples: string[] }> = ({ examples }) => {
  const copyToClipboard = (text: string) => {
    // Remove bullet point and quotes
    const cleanText = text.replace(/^[•"] /, '').replace(/"$/, '');
    navigator.clipboard.writeText(cleanText);
  };
  
  return (
    <ul className="space-y-2 text-gray-400 text-sm">
      {examples.map((example, index) => (
        <li 
          key={index}
          className="hover:text-green-400 cursor-pointer transition-colors"
          onClick={() => copyToClipboard(example)}
        >
          • "{example}"
        </li>
      ))}
    </ul>
  );
};

const MainApp: React.FC = () => {
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // Device management states (will be used for device selection UI)
  // @ts-ignore - Will be used later
  const [webPlayerDeviceId, setWebPlayerDeviceId] = useState<string | null>(null);
  // @ts-ignore - Will be used later  
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [commandHistory, setCommandHistory] = useState<Array<{
    command: string;
    response: string;
    confidence?: number;
    isEnhanced?: boolean;
    timestamp?: number;
    alternatives?: string[];
  }>>([]);
  // Authentication
  const authState = useSpotifyAuth();
  const { isAuthenticated } = authState;
  const [authChecking, setAuthChecking] = useState(false);

  // Check server connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${apiEndpoint}/health`);
        if (response.ok) {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      } catch (error) {
        setIsConnected(false);
      } finally {
        setChecking(false);
      }
    };

    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Check authentication when component mounts
  useEffect(() => {
    if (isConnected && !checking) {
      authState.checkAuthStatus();
    }
  }, [isConnected, checking, authState]);

  const updateModelPreference = async (type: string, model: string) => {
    if (!isAuthenticated) return;

    try {
      const response = await authenticatedFetch(`${apiEndpoint}/preferences/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, model })
      });

      if (response.ok) {
        console.log('Model preference updated:', model);
      }
    } catch (error) {
      console.error('Failed to update model preference:', error);
    }
  };

  const handleLogin = async () => {
    setAuthChecking(true);
    try {
      authState.login();
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isProcessing) return;

    setIsProcessing(true);
    const userCommand = command.trim();
    setCommand('');

    try {
      const response = await authenticatedFetch(`${apiEndpoint}/claude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          command: userCommand,
          model: currentModel 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setCommandHistory(prev => [...prev, {
          command: userCommand,
          response: data.response,
          confidence: data.confidence,
          isEnhanced: data.isEnhanced,
          timestamp: Date.now(),
          alternatives: data.alternatives
        }]);
      } else {
        setCommandHistory(prev => [...prev, {
          command: userCommand,
          response: data.error || 'An error occurred',
          timestamp: Date.now()
        }]);
      }
    } catch (error) {
      console.error('Command error:', error);
      setCommandHistory(prev => [...prev, {
        command: userCommand,
        response: 'Network error. Please try again.',
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearHistory = () => {
    setCommandHistory([]);
  };

  const handleModelSelect = (model: string) => {
    setCurrentModel(model);
    updateModelPreference('default', model);
  };

  const handleDeviceReady = (deviceId: string) => {
    setWebPlayerDeviceId(deviceId);
    setActiveDeviceId(deviceId);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <MusicLoader modelName="System" />
          <p className="text-white mt-4">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">⚠️ Connection Error</h1>
          <p className="text-gray-300 mb-8">Cannot connect to the Spotify Claude server.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-green-500 text-black font-bold rounded-full hover:bg-green-400 transition-all transform hover:scale-105"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">🎵 Spotify Claude</h1>
            <p className="text-gray-300">Control your Spotify with natural language commands powered by Claude AI.</p>
          </div>
          
          <div className="text-center">
            <button 
              className="px-8 py-3 bg-green-500 text-black font-bold rounded-full hover:bg-green-400 disabled:bg-gray-600 disabled:text-gray-400 transition-all transform hover:scale-105 disabled:scale-100"
              onClick={handleLogin}
              disabled={authChecking}
            >
              {authChecking ? 'Checking...' : 'Login with Spotify'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">🎵 Spotify Claude</h1>
            <p className="text-gray-400">Control your Spotify with natural language</p>
          </div>

          {/* Model Selector */}
          <div className="mb-6">
            <ModelSelector 
              onModelChange={handleModelSelect}
            />
          </div>

          {/* Spotify Player */}
          <div className="mb-6">
            <SpotifyPlayer 
              token={authState.accessToken || ''}
              onDeviceReady={handleDeviceReady}
            />
          </div>

          {/* Two-column layout */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Command Input */}
            <div className="space-y-6">
              <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Send Command</h2>
                  <button 
                    onClick={() => setShowExamplesModal(true)}
                    className="text-green-400 hover:text-green-300 text-sm font-medium"
                  >
                    View Examples
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="Type your command..."
                      disabled={isProcessing}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                      autoFocus
                    />
                    <div className="relative">
                      <button
                        type="submit"
                        disabled={isProcessing || !command.trim()}
                        className="w-full px-6 py-3 bg-green-500 text-black font-bold rounded-full hover:bg-green-400 disabled:bg-gray-600 disabled:text-gray-400 transition-all transform hover:scale-105 disabled:scale-100"
                      >
                        {isProcessing ? 'Processing...' : 'Send'}
                      </button>
                      {isProcessing && <MusicLoader modelName={currentModel} />}
                    </div>
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      disabled={isProcessing}
                      className="w-full px-6 py-3 bg-zinc-700 text-white font-semibold rounded-full hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-gray-500 transition-all transform hover:scale-105 disabled:scale-100"
                    >
                      Clear Conversation History
                    </button>
                  </div>
                </form>
              </div>
              
              <div className="mt-6 text-center flex-shrink-0">
                <button 
                  className="px-6 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700 transition-colors text-sm"
                  onClick={() => {
                    authState.logout();
                  }}
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Command History */}
            <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
              <h2 className="text-xl font-semibold mb-4">Command History</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {commandHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No commands yet. Try sending a command!</p>
                ) : (
                  commandHistory.map((item, index) => (
                    <div key={index} className="border-b border-zinc-700 pb-4 last:border-b-0">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-green-400 font-medium flex-1">{item.command}</p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 ml-2">
                          {item.confidence !== undefined && (
                            <span className="px-2 py-1 bg-zinc-700 rounded">
                              {Math.round(item.confidence * 100)}%
                            </span>
                          )}
                          {item.isEnhanced && (
                            <span className="px-2 py-1 bg-blue-600 rounded">Enhanced</span>
                          )}
                          {item.timestamp && (
                            <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-300">{item.response}</p>
                      {item.alternatives && item.alternatives.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          <span className="font-medium">Alternatives:</span> {item.alternatives.join(', ')}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Examples Modal */}
      {showExamplesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Command Examples</h2>
              <button 
                onClick={() => setShowExamplesModal(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Basic Playback</h3>
                <ExampleList examples={[
                  "Play some music",
                  "Pause the music",
                  "Skip this song",
                  "Go back to the previous song",
                  "Set volume to 50%"
                ]} />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Search & Play</h3>
                <ExampleList examples={[
                  "Play Bohemian Rhapsody by Queen",
                  "Play some jazz music",
                  "Play the Beatles",
                  "Play relaxing music",
                  "Play my Discover Weekly playlist"
                ]} />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Queue Management</h3>
                <ExampleList examples={[
                  "Add Hotel California to the queue",
                  "Queue some rock music",
                  "Add Taylor Swift to the queue",
                  "Play my liked songs",
                  "Shuffle my music"
                ]} />
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Click any example to copy it to your clipboard
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainApp;