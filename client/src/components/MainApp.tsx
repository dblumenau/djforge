import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MusicLoader from './MusicLoader';
import SpotifyPlayer from './SpotifyPlayer';
import ModelSelector from './ModelSelector';
import LLMLogsViewer from './LLMLogsViewer';
import WeatherDisplay from './WeatherDisplay';
import CommandHistorySkeleton from './skeletons/CommandHistorySkeleton';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { apiEndpoint } from '../config/api';
import { authenticatedFetch, api } from '../utils/api';

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
  const navigate = useNavigate();
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
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
  const [toast, setToast] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<Array<{
    command: string;
    response: string;
    confidence?: number;
    isEnhanced?: boolean;
    timestamp?: number;
    alternatives?: string[] | Array<{ name: string; artists: string; popularity: number; uri: string }>;
    intent?: string;
    reasoning?: string;
    model?: string;
    interpretation?: any; // Full interpretation object for debugging
    queuedSongs?: Array<{ name: string; artists: string; success: boolean }>;
    isAIDiscovery?: boolean;
    trackUri?: string;
    trackName?: string;
    artist?: string;
    aiReasoning?: string;
    feedback?: 'loved' | 'disliked';
    feedbackLoading?: boolean;
  }>>([]);
  const [commandHistoryLoading, setCommandHistoryLoading] = useState(false);
  // Authentication
  const { isAuthenticated, accessToken, loading: authLoading, logout, checkAuthStatus, error: authError, login } = useSpotifyAuth();

  // Check server connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(apiEndpoint('/api/health'));
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
      checkAuthStatus();
    }
  }, [isConnected, checking, checkAuthStatus]);

  // Load command history from Redis when authenticated
  useEffect(() => {
    const loadCommandHistory = async () => {
      if (!isAuthenticated) return;
      
      setCommandHistoryLoading(true);
      try {
        const response = await authenticatedFetch(apiEndpoint('/api/claude/history'));
        if (response.ok) {
          const data = await response.json();
          if (data.history && Array.isArray(data.history)) {
            // History from server is already in chronological order (oldest first)
            // No need to reverse here since we reverse when displaying
            setCommandHistory(data.history);
          }
        }
      } catch (error) {
        console.error('Failed to load command history:', error);
      } finally {
        setCommandHistoryLoading(false);
      }
    };

    loadCommandHistory();
  }, [isAuthenticated]);

  // Redirect to landing page if not authenticated (but not if they have expired tokens)
  useEffect(() => {
    console.log('🔄 MainApp: Auth redirect check -', { checking, authLoading, isAuthenticated, authError });
    if (!checking && !authLoading && !isAuthenticated && !authError) {
      console.log('⚠️ MainApp: Redirecting to landing page');
      navigate('/landing');
    }
  }, [checking, authLoading, isAuthenticated, authError, navigate]);

  const updateModelPreference = async (_type: string, model: string) => {
    if (!isAuthenticated) return;

    try {
      const response = await authenticatedFetch(apiEndpoint('/api/preferences/models'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: model })
      });

      if (response.ok) {
        console.log('Model preference updated:', model);
      }
    } catch (error) {
      console.error('Failed to update model preference:', error);
    }
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleFeedback = async (trackUri: string, feedback: 'loved' | 'disliked') => {
    // Find the message with this trackUri
    const messageIndex = commandHistory.findIndex(m => m.trackUri === trackUri);
    if (messageIndex === -1) return;

    // Set loading state
    setCommandHistory(prev => prev.map((msg, idx) => 
      idx === messageIndex ? { ...msg, feedbackLoading: true } : msg
    ));

    try {
      // If clicking the same feedback again, remove it
      const currentFeedback = commandHistory[messageIndex].feedback;
      const newFeedback = currentFeedback === feedback ? 'remove' : feedback;
      
      await api.recordFeedback(trackUri, newFeedback);
      
      // Update message with new feedback
      setCommandHistory(prev => prev.map((msg, idx) => 
        idx === messageIndex 
          ? { 
              ...msg, 
              feedback: newFeedback === 'remove' ? undefined : feedback,
              feedbackLoading: false 
            } 
          : msg
      ));

      // Show toast notification
      showToast(
        newFeedback === 'remove' 
          ? 'Feedback removed' 
          : `Thanks for the feedback!`
      );
    } catch (error) {
      console.error('Failed to record feedback:', error);
      setCommandHistory(prev => prev.map((msg, idx) => 
        idx === messageIndex ? { ...msg, feedbackLoading: false } : msg
      ));
    }
  };

  const handleAlternativeClick = async (alternative: { name: string; artists: string; popularity: number; uri: string }, action: 'play' | 'queue') => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      // Use direct action endpoint to bypass LLM for known URIs
      const response = await authenticatedFetch(apiEndpoint('/api/direct/song'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          uri: alternative.uri,
          action: action,
          name: alternative.name,
          artists: alternative.artists
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();
      
      // Don't add to command history - these are just quick actions
      // The response is already shown in the UI feedback
      
    } catch (error) {
      console.error('Alternative click error:', error);
      // Could show a toast notification here if needed
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isProcessing) return;

    setIsProcessing(true);
    const userCommand = command.trim();
    setCommand('');

    try {
      const response = await authenticatedFetch(apiEndpoint('/api/llm/simple/command'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          command: userCommand
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      
      if (data.success) {
        const newMessage = {
          command: userCommand,
          response: data.response || data.message,
          confidence: data.interpretation?.confidence,
          isEnhanced: data.isEnhanced,
          timestamp: Date.now(),
          alternatives: data.interpretation?.alternatives,
          intent: data.interpretation?.intent,
          reasoning: data.interpretation?.reasoning,
          model: data.interpretation?.model || currentModel,
          interpretation: data.interpretation, // Store the full interpretation object
          queuedSongs: data.queuedSongs,
          isAIDiscovery: data.interpretation?.isAIDiscovery || false,
          trackUri: data.track?.uri,
          trackName: data.track?.name,
          artist: data.track?.artists?.map((a: any) => a.name).join(', '),
          aiReasoning: data.interpretation?.aiReasoning
        };
        
        setCommandHistory(prev => [...prev, newMessage]);
      } else {
        setCommandHistory(prev => [...prev, {
          command: userCommand,
          response: data.error || data.message || 'An error occurred',
          timestamp: Date.now(),
          confidence: data.interpretation?.confidence,
          intent: data.interpretation?.intent,
          reasoning: data.interpretation?.reasoning,
          model: data.interpretation?.model || currentModel,
          interpretation: data.interpretation, // Store the full interpretation object
          queuedSongs: data.queuedSongs
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

  const handleClearHistory = async () => {
    try {
      // Clear Redis conversation history
      const response = await authenticatedFetch(apiEndpoint('/api/claude/clear-history'), {
        method: 'POST'
      });
      
      if (response.ok) {
        // Clear local state only if Redis clear was successful
        setCommandHistory([]);
        console.log('Conversation history cleared successfully');
      } else {
        console.error('Failed to clear conversation history on server');
      }
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      // Still clear local state even if server request fails
      setCommandHistory([]);
    }
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
          <p className="text-gray-300 mb-8">Cannot connect to the DJ Forge backend server.</p>
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

  if (!isAuthenticated && !authError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <MusicLoader modelName="System" />
          <p className="text-white mt-4">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white">
      <div className="container mx-auto px-4 py-8" style={{ maxWidth: '1440px' }}>
        <div className="w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img 
                src="/square_icon.png" 
                alt="DJ Forge" 
                className="h-12 w-12"
              />
              <h1 className="text-4xl font-bold">DJ Forge</h1>
            </div>
            <p className="text-gray-400">Control your Spotify with natural language</p>
          </div>

          {/* Auth Error Message */}
          {authError && (
            <div className="mb-6 bg-yellow-900/50 border border-yellow-600 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-yellow-400 mr-2">⚠️</span>
                  <span className="text-yellow-200">{authError}</span>
                </div>
                <button 
                  onClick={login}
                  className="px-4 py-2 bg-yellow-600 text-black font-semibold rounded-full hover:bg-yellow-500 transition-colors text-sm"
                >
                  Re-authenticate
                </button>
              </div>
            </div>
          )}

          {/* Navigation Bar */}
          <div className="mb-6">
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left: Model Selector */}
                <div className="flex-shrink-0">
                  <ModelSelector onModelChange={handleModelSelect} />
                </div>

                {/* Center: Weather */}
                <div className="hidden lg:block">
                  <WeatherDisplay />
                </div>

                {/* Right: Main Navigation */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 hover:border-zinc-500 rounded-md transition-all text-xs font-medium"
                  >
                    📊 Dashboard
                  </button>
                  <button
                    onClick={() => navigate('/feedback-dashboard')}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 hover:text-white border border-zinc-600 hover:border-zinc-500 rounded-md transition-all text-xs font-medium"
                  >
                    🎯 Feedback
                  </button>
                  <button 
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-zinc-100 border border-zinc-600 hover:border-zinc-500 rounded-md transition-all text-xs"
                    onClick={() => setShowLogs(true)}
                  >
                    📋 Logs
                  </button>
                  <button 
                    className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/30 text-red-300 hover:text-red-200 border border-red-800/50 hover:border-red-700/50 rounded-md transition-all text-xs font-medium"
                    onClick={() => {
                      logout();
                    }}
                  >
                    🚪 Logout
                  </button>

                  {/* Dev Tools - Hidden in production */}
                  {import.meta.env.DEV && (
                    <>
                      <button 
                        className="px-2 py-1 bg-yellow-900/20 hover:bg-yellow-900/30 text-yellow-400/70 hover:text-yellow-300 border border-yellow-800/30 rounded text-xs opacity-50"
                        onClick={async () => {
                          const jwtToken = localStorage.getItem('spotify_jwt');
                          if (jwtToken) {
                            try {
                              const response = await fetch(apiEndpoint('/api/auth/debug/simulate-expired'), {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${jwtToken}`,
                                  'Content-Type': 'application/json'
                                }
                              });
                              const data = await response.json();
                              if (data.success) {
                                localStorage.setItem('spotify_jwt', data.simulatedToken);
                                console.log('⏰ Simulated expired tokens - refresh page to test auto-refresh');
                                alert('Tokens expired! Refresh the page to test automatic token refresh.');
                              } else {
                                alert(data.error);
                              }
                            } catch (error) {
                              console.error('Simulate expired failed:', error);
                            }
                          }
                        }}
                      >
                        ⏰ Expire
                      </button>
                      <button 
                        className="px-2 py-1 bg-red-900/20 hover:bg-red-900/30 text-red-400/70 hover:text-red-300 border border-red-800/30 rounded text-xs opacity-50"
                        onClick={async () => {
                          const jwtToken = localStorage.getItem('spotify_jwt');
                          if (jwtToken) {
                            try {
                              const response = await fetch(apiEndpoint('/api/auth/debug/simulate-revoked'), {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${jwtToken}`,
                                  'Content-Type': 'application/json'
                                }
                              });
                              const data = await response.json();
                              if (data.success) {
                                localStorage.setItem('spotify_jwt', data.revokedToken);
                                console.log('🚫 Simulated revoked refresh token');
                                alert('Refresh token revoked! Refresh the page to test error handling.');
                              }
                            } catch (error) {
                              console.error('Simulate revoked failed:', error);
                            }
                          }
                        }}
                      >
                        🚫 Revoke
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Mobile: Weather Display */}
              <div className="lg:hidden mt-3 pt-3 border-t border-zinc-700/50 flex justify-center">
                <WeatherDisplay />
              </div>
            </div>
          </div>

          {/* Spotify Player */}
          <div className="mb-6">
            <SpotifyPlayer 
              token={accessToken || ''}
              onDeviceReady={handleDeviceReady}
            />
          </div>

          {/* Two-column layout - asymmetric for larger screens */}
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Command Input */}
            <div className="space-y-6 lg:col-span-2">
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
                  </div>
                </form>
              </div>
            </div>

            {/* Command History */}
            <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700 lg:col-span-3">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Command History</h2>
                {commandHistory.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                  >
                    Clear History
                  </button>
                )}
              </div>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {commandHistoryLoading ? (
                  <CommandHistorySkeleton count={3} />
                ) : commandHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No commands yet. Try sending a command!</p>
                ) : (
                  commandHistory.slice().reverse().map((item, index) => {
                    // Extract interpretation data properly
                    const intent = item.intent;
                    const confidence = item.confidence;
                    const reasoning = item.reasoning;
                    const searchQuery = undefined;
                    
                    return (
                      <div key={index} className="border-b border-zinc-800 pb-4 last:border-0">
                        {/* Command with badges */}
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-green-500 text-sm">▶</span>
                          <div className="flex-1">
                            <span className="text-green-500 text-sm font-medium">{item.command}</span>
                            {/* Badges */}
                            <div className="inline-flex items-center gap-2 ml-3">
                              {item.isEnhanced && (
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                  Enhanced
                                </span>
                              )}
                              {item.model && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  item.model === 'direct-action' 
                                    ? 'bg-blue-500/20 text-blue-400' 
                                    : 'bg-gray-600/30 text-gray-400'
                                }`} title={item.model}>
                                  {item.model === 'direct-action' 
                                    ? 'Direct' 
                                    : item.model.split('/').pop()?.split('-')[0] || item.model}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.timestamp && (
                            <span className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
                          )}
                        </div>
                        
                        {/* Intent and confidence */}
                        {(intent || confidence !== undefined) && (
                          <div className="pl-6 mb-2 flex items-center gap-3 flex-wrap">
                            {intent && (
                              <span className={`text-xs px-2 py-1 rounded ${
                                intent === 'play_specific_song' ? 'bg-purple-500/20 text-purple-400' :
                                intent === 'queue_specific_song' ? 'bg-green-500/20 text-green-400' :
                                intent === 'play_playlist' ? 'bg-blue-500/20 text-blue-400' :
                                intent === 'queue_playlist' ? 'bg-cyan-500/20 text-cyan-400' :
                                intent === 'pause' ? 'bg-yellow-500/20 text-yellow-400' :
                                intent === 'skip' ? 'bg-orange-500/20 text-orange-400' :
                                intent === 'set_volume' ? 'bg-pink-500/20 text-pink-400' :
                                intent === 'get_playback_info' ? 'bg-indigo-500/20 text-indigo-400' :
                                intent === 'chat' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                Intent: {intent.replace(/_/g, ' ')}
                              </span>
                            )}
                            {confidence !== undefined && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">Confidence:</span>
                                <div className="w-16 h-2 bg-zinc-700 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all ${
                                      confidence >= 0.8 ? 'bg-green-500' : 
                                      confidence >= 0.6 ? 'bg-yellow-500' : 
                                      'bg-orange-500'
                                    }`}
                                    style={{ width: `${confidence * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400">{Math.round(confidence * 100)}%</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Reasoning */}
                        {reasoning && (
                          <div className="pl-6 mb-2">
                            <div className="bg-zinc-900/50 border-l-2 border-purple-500/30 px-3 py-2 rounded">
                              <p className="text-xs text-purple-300 italic">
                                💭 {reasoning}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {/* Search query */}
                        {searchQuery && (
                          <div className="pl-6 mb-2">
                            <p className="text-xs text-gray-500">
                              🔍 Searched for: <code className="bg-zinc-800 px-1 rounded">{searchQuery}</code>
                            </p>
                          </div>
                        )}
                        
                        {/* Response */}
                        <div className="text-gray-400 text-sm pl-6 whitespace-pre-line">
                          {item.response}
                        </div>
                        
                        {/* Feedback Buttons for AI Discoveries */}
                        {item.isAIDiscovery && item.trackUri && (
                          <div className="flex gap-2 mt-2 pl-6 opacity-100">
                            <button
                              onClick={() => handleFeedback(item.trackUri!, 'loved')}
                              className={`px-3 py-1 rounded-lg transition-all ${
                                item.feedback === 'loved' 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-zinc-800 hover:bg-green-900 text-zinc-300'
                              }`}
                              disabled={item.feedbackLoading}
                            >
                              👍
                            </button>
                            <button
                              onClick={() => handleFeedback(item.trackUri!, 'disliked')}
                              className={`px-3 py-1 rounded-lg transition-all ${
                                item.feedback === 'disliked' 
                                  ? 'bg-red-600 text-white' 
                                  : 'bg-zinc-800 hover:bg-red-900 text-zinc-300'
                              }`}
                              disabled={item.feedbackLoading}
                            >
                              👎
                            </button>
                          </div>
                        )}
                        
                        {/* Alternatives */}
                        {item.alternatives && item.alternatives.length > 0 && (
                          <div className="mt-2 pl-6">
                            {/* Check if alternatives are objects with URI (new format) or simple strings (old format) */}
                            {typeof item.alternatives[0] === 'object' ? (
                              <div className="space-y-2">
                                <span className="text-xs text-gray-500 font-medium">Similar songs:</span>
                                <div className="space-y-1">
                                  {(item.alternatives as Array<{ name: string; artists: string; popularity: number; uri: string }>).map((alt, altIndex) => (
                                    <div key={altIndex} className="flex items-center justify-between bg-zinc-900/50 rounded p-2 text-xs">
                                      <div className="flex-1 text-gray-300">
                                        <span className="font-medium">{alt.name}</span>
                                        <span className="text-gray-500"> by {alt.artists}</span>
                                      </div>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => handleAlternativeClick(alt, 'play')}
                                          disabled={isProcessing}
                                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                          Play
                                        </button>
                                        <button
                                          onClick={() => handleAlternativeClick(alt, 'queue')}
                                          disabled={isProcessing}
                                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                          Queue
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">
                                <span className="font-medium">Also tried:</span> {(item.alternatives as string[]).join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Queued Songs */}
                        {item.queuedSongs && item.queuedSongs.length > 0 && (
                          <div className="mt-2 pl-6">
                            <div className="space-y-2">
                              <span className="text-xs text-gray-500 font-medium">Songs queued:</span>
                              <div className="space-y-1">
                                {item.queuedSongs.map((song, songIndex) => (
                                  <div key={songIndex} className="flex items-center bg-zinc-900/50 rounded p-2 text-xs">
                                    <span className="text-blue-400 mr-2">♪</span>
                                    <div className="flex-1 text-gray-300">
                                      <span className="font-medium">{song.name}</span>
                                      <span className="text-gray-500"> by {song.artists}</span>
                                    </div>
                                    {song.success && (
                                      <span className="text-green-400 text-xs">✓</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
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

      {/* LLM Logs Viewer */}
      {showLogs && (
        <LLMLogsViewer onClose={() => setShowLogs(false)} />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-zinc-800 text-white px-4 py-2 rounded-lg shadow-lg animate-[slideIn_0.3s_ease-out]">
          {toast}
        </div>
      )}
    </div>
  );
};

export default MainApp;