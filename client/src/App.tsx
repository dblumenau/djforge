import React, { useState, useEffect } from 'react';
import MusicLoader from './components/MusicLoader';
import SpotifyPlayer from './components/SpotifyPlayer';
import ModelSelector from './components/ModelSelector';
import { useSpotifyAuth } from './hooks/useSpotifyAuth';
import { apiEndpoint } from './config/api';
import { authenticatedFetch } from './utils/api';

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

function App() {
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
    model?: string;
    interpretation?: {
      intent?: string;
      confidence?: number;
      reasoning?: string;
      searchQuery?: string;
      model?: string;
    };
  }>>([])
  
  const authState = useSpotifyAuth();
  const { isAuthenticated, accessToken, loading: authLoading } = authState;
  const authChecking = authLoading;

  // Handle auth callback in a separate effect that runs immediately
  useEffect(() => {
    // Check for auth callback params IMMEDIATELY
    const urlParams = new URLSearchParams(window.location.search);
    console.log('🔍 Checking URL params:', window.location.search);
    
    if (urlParams.get('success') === 'true') {
      console.log('✅ Success param detected!');
      const token = urlParams.get('token');
      
      if (token) {
        // JWT token received (works for both local and production)
        console.log('🔑 JWT token found:', token.substring(0, 20) + '...');
        
        // Clear URL params AFTER we've read them
        window.history.replaceState({}, document.title, '/');
        
        // Handle JWT token immediately
        handleJWTToken(token);
      } else {
        console.log('❌ No token found in callback');
        window.history.replaceState({}, document.title, '/');
      }
    } else if (urlParams.get('error')) {
      console.error('❌ Auth error:', urlParams.get('error'));
      window.history.replaceState({}, document.title, '/');
    }
  }, []); // This runs FIRST

  useEffect(() => {
    checkConnection();
  }, []); // This runs SECOND

  // Fetch history when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated]);


  const checkConnection = async () => {
    try {
      const response = await fetch(apiEndpoint('/api/health'));
      if (response.ok) {
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Server not reachable:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleJWTToken = (token: string) => {
    console.log('🔑 Storing JWT token and checking auth...');
    
    // Store JWT in localStorage (could also use memory/context)
    localStorage.setItem('spotify_jwt', token);
    
    // Check auth status with the new token
    authState.checkAuthStatus();
  };

  const handleLogin = () => {
    authState.login();
  };

  const handleDeviceReady = (deviceId: string) => {
    setWebPlayerDeviceId(deviceId);
    // Optionally auto-transfer playback to web player
    // transferPlayback(deviceId);
  };

  const fetchHistory = async () => {
    try {
      const response = await authenticatedFetch('/api/claude/history');
      if (response.ok) {
        const data = await response.json();
        setCommandHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch command history:', error);
    }
  };

  // Will be used for device selection UI
  // @ts-ignore - Will be used later
  const transferPlayback = async (deviceId: string) => {
    try {
      const response = await authenticatedFetch('/api/control/transfer', {
        method: 'POST',
        body: JSON.stringify({ deviceId, play: false })
      });
      
      if (response.ok) {
        setActiveDeviceId(deviceId);
      }
    } catch (error) {
      console.error('Failed to transfer playback:', error);
    }
  };

  const sendAlternativeCommand = async (alternative: string, action: 'play' | 'queue') => {
    const command = action === 'play' ? `Play ${alternative}` : `Queue ${alternative}`;
    setCommand('');
    setIsProcessing(true);
    
    try {
      const response = await authenticatedFetch('/api/claude/command', {
        method: 'POST',
        body: JSON.stringify({ command })
      });

      const data = await response.json();
      
      // Format response - keep it simple since we now show interpretation details separately
      let responseMessage = data.message || 'Command processed';
      
      const alternatives = data.interpretation?.alternatives || [];
      
      setCommandHistory(prev => [...prev, { 
        command,
        response: responseMessage,
        confidence: data.interpretation?.confidence,
        isEnhanced: true,
        timestamp: Date.now(),
        alternatives: alternatives,
        interpretation: data.interpretation,
        model: currentModel
      }]);
      setCommand('');
      // Fetch fresh history from server to ensure sync
      await fetchHistory();
    } catch (error) {
      console.error('Command failed:', error);
      setCommandHistory(prev => [...prev, { 
        command,
        response: 'Error processing command',
        isEnhanced: false,
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const playAlternative = (alternative: string) => sendAlternativeCommand(alternative, 'play');
  const queueAlternative = (alternative: string) => sendAlternativeCommand(alternative, 'queue');

  const handleClearHistory = async () => {
    setIsProcessing(true);
    try {
      const response = await authenticatedFetch('/api/claude/clear-history', {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        // Fetch fresh (empty) history from server
        await fetchHistory();
        // Add success message
        setCommandHistory([{
          command: '[System]',
          response: 'Conversation history cleared successfully',
          timestamp: Date.now()
        }]);
      } else {
        setCommandHistory(prev => [...prev, {
          command: '[System]',
          response: data.message || 'Failed to clear history',
          timestamp: Date.now()
        }]);
      }
    } catch (error) {
      console.error('Failed to clear history:', error);
      setCommandHistory(prev => [...prev, {
        command: '[System]',
        response: 'Error clearing conversation history',
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const response = await authenticatedFetch('/api/claude/command', {
        method: 'POST',
        body: JSON.stringify({ command: command.trim() })
      });

      const data = await response.json();
      
      // Format response - keep it simple since we now show interpretation details separately
      let responseMessage = data.message || 'Command processed';
      
      // Add alternatives with popularity scores
      if (data.result?.alternatives && data.result.alternatives.length > 0) {
        responseMessage += '\n\nOther versions found in Spotify:';
        data.result.alternatives.forEach((track: any, index: number) => {
          responseMessage += `\n${index + 1}. ${track.name} by ${track.artists}`;
          if (track.popularity !== undefined) {
            responseMessage += ` (popularity: ${track.popularity})`;
          }
        });
      }
      
      // Store alternatives separately for clickable UI
      const alternatives = data.interpretation?.alternatives || [];
      
      setCommandHistory(prev => [...prev, { 
        command: command.trim(), 
        response: responseMessage,
        confidence: data.interpretation?.confidence,
        isEnhanced: true,
        timestamp: Date.now(),
        alternatives: alternatives,
        interpretation: data.interpretation,
        model: currentModel
      }]);
      setCommand('');
      // Fetch fresh history from server to ensure sync
      await fetchHistory();
    } catch (error) {
      console.error('Command failed:', error);
      setCommandHistory(prev => [...prev, { 
        command: command.trim(), 
        response: 'Error processing command',
        isEnhanced: false,
        timestamp: Date.now(),
        model: currentModel
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="bg-zinc-800 rounded-xl p-8 shadow-xl">
          <h1 className="text-3xl font-bold text-green-500 mb-2">🎵 Spotify Claude Controller</h1>
          <p className="text-gray-400">Checking connection...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-xl p-8 shadow-xl max-w-md w-full">
          <h1 className="text-3xl font-bold text-green-500 mb-2">🎵 Spotify Claude Controller</h1>
          <p className="text-gray-400 mb-6">Server not running</p>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-yellow-500 mb-4">⚠️ Backend Not Detected</h2>
            <p className="text-gray-400 mb-4">Please make sure the server is running:</p>
            <ol className="space-y-2 text-gray-400">
              <li>1. Open a new terminal</li>
              <li>2. Navigate to the project directory</li>
              <li>3. Run: <code className="bg-black px-2 py-1 rounded text-sm">npm run dev</code></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
          {/* Spotify Player - Full Width at Top */}
          {accessToken && (
            <div className="w-full">
              <SpotifyPlayer 
                token={accessToken}
                onDeviceReady={handleDeviceReady}
              />
            </div>
          )}
          
          {/* Main Content - Two Columns */}
          <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
            {/* Left Column - Command Area */}
            <div className="w-full lg:w-5/12">
              <div className="bg-zinc-900 rounded-xl shadow-xl p-4 md:p-6 lg:p-8 flex flex-col">
                <div className="mb-6 md:mb-8 text-center flex-shrink-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-green-500 mb-2">🎵 DJ Forge</h1>
                  <p className="text-gray-400 text-sm md:text-base">Control your Spotify with natural language</p>
                  <div className="mt-4 flex justify-center">
                    <ModelSelector onModelChange={setCurrentModel} />
                  </div>
                </div>
              
              <details className="bg-zinc-800 rounded-lg mb-4 md:mb-6 flex-shrink-0" open={window.innerWidth >= 1024}>
                <summary className="cursor-pointer p-4 md:p-6 flex items-center justify-between text-lg md:text-xl font-semibold text-green-500 hover:text-green-400 transition-colors">
                  <span>🎤 Command Examples</span>
                  <span className="text-sm font-normal text-gray-400 lg:hidden">Click to expand</span>
                </summary>
                <div className="px-4 md:px-6 pb-4 md:pb-6">
                  <p className="text-gray-400 text-sm md:text-base mb-3 md:mb-4">Try natural language commands like:</p>
                  <ul className="space-y-2 text-gray-400 text-sm">
                    <li>• "Play" / "Pause" / "Skip" / "Volume up"</li>
                    <li>• "Play a lesser known Enya song"</li>
                    <li>• "Queue the most obscure Taylor Swift track"</li>
                    <li>• "Play Love Live"</li>
                    <li>• "No! Only Taylors Version!"</li>
                    <li>• "What's playing?"</li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => setShowExamplesModal(true)}
                    className="mt-3 text-green-500 hover:text-green-400 text-sm underline"
                  >
                    See 50+ more examples →
                  </button>
                </div>
              </details>
              
              <div className="flex-grow flex flex-col justify-end">
              <form onSubmit={handleCommandSubmit}>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="Type your command..."
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isProcessing || !command.trim()}
                    className="w-full px-6 py-3 bg-green-500 text-black font-bold rounded-full hover:bg-green-400 disabled:bg-gray-600 disabled:text-gray-400 transition-all transform hover:scale-105 disabled:scale-100"
                  >
                    {isProcessing ? 'Processing...' : 'Send'}
                  </button>
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

              {isProcessing && <MusicLoader modelName={currentModel} />}
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
            </div>

            {/* Right Column - Command History */}
            <div className="w-full lg:w-7/12 mt-4 lg:mt-0">
              <div className="bg-zinc-900 rounded-xl shadow-xl p-4 md:p-6 flex flex-col min-h-[400px] lg:min-h-[600px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg md:text-xl font-semibold text-green-500">Command History</h3>
                {commandHistory.length > 0 && (
                  <button
                    onClick={() => {
                      setCommandHistory([]);
                    }}
                    className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                  >
                    Clear History
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
                {commandHistory.length === 0 ? (
                  <p className="text-gray-400 text-sm">Your commands will appear here...</p>
                ) : (
                  commandHistory.slice().reverse().map((item, index) => (
                    <div key={index} className={`border-b border-zinc-800 pb-4 last:border-0 ${
                      item.isEnhanced && item.confidence && item.confidence > 0.8 
                        ? 'bg-zinc-800/30 rounded-lg p-3 mb-2' 
                        : ''
                    }`}>
                      <div className="text-green-500 text-sm font-medium mb-1 flex items-center gap-2">
                        ▶ {item.command}
                        {item.isEnhanced && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                            Enhanced
                          </span>
                        )}
                        {item.model && (
                          <span className="text-xs bg-gray-600/30 text-gray-400 px-2 py-0.5 rounded-full">
                            {item.model.split('/').pop()}
                          </span>
                        )}
                      </div>
                      
                      {/* Show intent and confidence */}
                      {item.interpretation && (
                        <div className="pl-4 mb-2 flex items-center gap-3 flex-wrap">
                          {item.interpretation.intent && (
                            <span className={`text-xs px-2 py-1 rounded ${
                              item.interpretation.intent === 'play_specific_song' ? 'bg-purple-500/20 text-purple-400' :
                              item.interpretation.intent === 'queue_specific_song' ? 'bg-green-500/20 text-green-400' :
                              item.interpretation.intent === 'play_playlist' ? 'bg-blue-500/20 text-blue-400' :
                              item.interpretation.intent === 'queue_playlist' ? 'bg-cyan-500/20 text-cyan-400' :
                              item.interpretation.intent === 'pause' ? 'bg-yellow-500/20 text-yellow-400' :
                              item.interpretation.intent === 'skip' ? 'bg-orange-500/20 text-orange-400' :
                              item.interpretation.intent === 'set_volume' ? 'bg-pink-500/20 text-pink-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              Intent: {item.interpretation.intent}
                            </span>
                          )}
                          {item.interpretation.confidence !== undefined && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Confidence:</span>
                              <div className="w-16 h-2 bg-zinc-700 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${
                                    item.interpretation.confidence > 0.8 ? 'bg-green-500' : 
                                    item.interpretation.confidence > 0.6 ? 'bg-yellow-500' : 
                                    'bg-orange-500'
                                  }`}
                                  style={{ width: `${item.interpretation.confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400">{Math.round(item.interpretation.confidence * 100)}%</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Show reasoning in distinct style */}
                      {item.interpretation?.reasoning && (
                        <div className="pl-4 mb-2">
                          <div className="bg-zinc-900/50 border-l-2 border-purple-500/30 px-3 py-2 rounded">
                            <p className="text-xs text-purple-300 italic">
                              💭 {item.interpretation.reasoning}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Show search query if available */}
                      {item.interpretation?.searchQuery && (
                        <div className="pl-4 mb-2">
                          <p className="text-xs text-gray-500">
                            🔍 Searched Spotify for: <code className="bg-zinc-800 px-1 rounded">{item.interpretation.searchQuery}</code>
                          </p>
                        </div>
                      )}
                      
                      <div className="text-gray-400 text-sm whitespace-pre-line pl-4">
                        {item.response}
                      </div>
                      {item.alternatives && item.alternatives.length > 0 && (
                        <div className="mt-3 pl-4">
                          <p className="text-green-400 text-xs mb-2 flex items-center gap-1">
                            <span className="text-base">🎵</span> Claude also suggests:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {item.alternatives.map((alt, altIndex) => (
                              <div key={altIndex} className="flex items-center bg-zinc-800 rounded-full">
                                <button
                                  onClick={() => playAlternative(alt)}
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 text-gray-300 hover:text-green-400 text-xs rounded-l-full transition-all hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                  title="Play now"
                                >
                                  <span className="text-green-500">▶</span>
                                  {alt}
                                </button>
                                <button
                                  onClick={() => queueAlternative(alt)}
                                  disabled={isProcessing}
                                  className="px-2 py-1.5 text-gray-400 hover:text-yellow-400 text-xs rounded-r-full transition-all hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border-l border-zinc-700"
                                  title="Add to queue"
                                >
                                  <span className="text-yellow-500">+</span>
                                </button>
                              </div>
                            ))}
                          </div>
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 rounded-xl max-w-7xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-zinc-800">
              <div className="p-6 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-800">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-green-500 flex items-center gap-2">
                    🎵 Command Examples
                    <span className="text-sm text-gray-400 font-normal">56 ways to control your music</span>
                  </h2>
                  <button
                    onClick={() => setShowExamplesModal(false)}
                    className="text-gray-400 hover:text-white text-3xl transition-colors hover:rotate-90 transform duration-200"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)] bg-zinc-950">
                {/* Quick tip banner */}
                <div className="mb-6 bg-gradient-to-r from-green-500/10 to-green-600/10 border border-green-500/20 rounded-lg p-4">
                  <p className="text-green-400 text-sm flex items-center gap-2">
                    <span className="text-xl">💡</span>
                    <span>Pro tip: Click any example to copy it to your clipboard!</span>
                  </p>
                </div>
                
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {/* Basic Controls */}
                  <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 hover:border-zinc-700 transition-colors">
                    <h3 className="text-lg font-semibold text-green-500 mb-3 flex items-center gap-2">
                      <span className="text-2xl">🎮</span> Basic Controls
                    </h3>
                    <ExampleList examples={[
                      "Play",
                      "Pause",
                      "Skip",
                      "Previous",
                      "Volume up",
                      "Volume to 70",
                      "Mute",
                      "What's playing?"
                    ]} />
                  </div>

                  {/* Obscure & Rare Tracks */}
                  <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 hover:border-zinc-700 transition-colors">
                    <h3 className="text-lg font-semibold text-green-500 mb-3 flex items-center gap-2">
                      <span className="text-2xl">💎</span> Obscure & Rare Tracks
                    </h3>
                    <ExampleList examples={[
                      "Play the most obscure Taylor Swift song",
                      "Play a lesser known Enya track",
                      "Queue the rarest Beatles song",
                      "Play some deep cut Pink Floyd",
                      "Find me an obscure Radiohead B-side",
                      "Play the least popular Beyoncé song",
                      "Queue a rare David Bowie demo",
                      "Play an unknown gem by The Cure"
                    ]} />
                  </div>

                  {/* Version Preferences */}
                  <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 hover:border-zinc-700 transition-colors">
                    <h3 className="text-lg font-semibold text-green-500 mb-3 flex items-center gap-2">
                      <span className="text-2xl">🎛️</span> Version Preferences
                    </h3>
                    <ExampleList examples={[
                      "Play Long Live original version not Taylor's Version",
                      "Queue Wonderwall acoustic version",
                      "Play Layla the MTV Unplugged version",
                      "Find Every Breath You Take radio edit",
                      "Play Blue Monday extended 12 inch remix",
                      "Queue Hey Jude demo version",
                      "Play Hurt but the Johnny Cash version",
                      "Play All Along the Watchtower but Hendrix not Dylan"
                    ]} />
                  </div>

                  {/* Mood & Atmosphere */}
                  <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 hover:border-zinc-700 transition-colors">
                    <h3 className="text-lg font-semibold text-green-500 mb-3 flex items-center gap-2">
                      <span className="text-2xl">🌈</span> Mood & Atmosphere
                    </h3>
                    <ExampleList examples={[
                      "Play something that sounds like rain",
                      "Queue music for a rainy Sunday morning",
                      "Play something melancholy",
                      "Find me upbeat summer vibes",
                      "Play chill study music",
                      "Queue songs for a dinner party",
                      "Play something ethereal and dreamy",
                      "Find music that feels like floating in space",
                      "Play aggressive workout music",
                      "Queue peaceful meditation sounds"
                    ]} />
                  </div>

                  {/* Cultural References */}
                  <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 hover:border-zinc-700 transition-colors">
                    <h3 className="text-lg font-semibold text-green-500 mb-3 flex items-center gap-2">
                      <span className="text-2xl">🎬</span> Cultural References
                    </h3>
                    <ExampleList examples={[
                      "Play that song from the desert driving scene",
                      "Queue the song from the Stranger Things finale",
                      "Play that dancey ABBA song from Mamma Mia",
                      "Find the song from the Guardians of the Galaxy intro",
                      "Play the theme from The Office",
                      "Queue that epic song from Inception",
                      "Play the training montage song from Rocky",
                      "Find that whistling song from Kill Bill",
                      "Play the song from the Pulp Fiction dance scene",
                      "Queue the needle drop from Baby Driver"
                    ]} />
                  </div>

                  {/* Specific Artist Requests */}
                  <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 hover:border-zinc-700 transition-colors">
                    <h3 className="text-lg font-semibold text-green-500 mb-3 flex items-center gap-2">
                      <span className="text-2xl">🎤</span> Artist Deep Dives
                    </h3>
                    <ExampleList examples={[
                      "Play Taylor Swift's most vulnerable song",
                      "Queue Kanye's most experimental track",
                      "Play the Beatles song about a walrus",
                      "Find Prince's funkiest deep cut",
                      "Play Björk's weirdest song",
                      "Queue Frank Ocean's most emotional track",
                      "Play the Smiths song about cemetery gates",
                      "Find Daft Punk's longest song"
                    ]} />
                  </div>

                  {/* Smart Combinations */}
                  <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 hover:border-zinc-700 transition-colors">
                    <h3 className="text-lg font-semibold text-green-500 mb-3 flex items-center gap-2">
                      <span className="text-2xl">🧠</span> Smart Combinations
                    </h3>
                    <ExampleList examples={[
                      "Play an upbeat 80s song but not the hits",
                      "Queue jazzy hip-hop from the 90s",
                      "Play electronic music that's good for coding",
                      "Find indie rock with female vocals",
                      "Play something like Bon Iver but happier",
                      "Queue ambient music without vocals",
                      "Play folk music from the 60s protest era",
                      "Find modern songs that sound vintage"
                    ]} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl p-8 shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-green-500 mb-2">🎵 Spotify Claude Controller</h1>
        <p className="text-gray-400 mb-6">Control your music with natural language</p>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-green-500 mb-4">🚀 Ready to Connect!</h2>
          <p className="text-gray-400 mb-2">Your Spotify credentials are configured. Click below to login:</p>
          <p className="text-gray-500 text-sm">This will redirect you to Spotify for authorization</p>
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

export default App;