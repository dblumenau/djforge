import React, { useState, useEffect } from 'react';
import MusicLoader from './components/MusicLoader';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [commandHistory, setCommandHistory] = useState<Array<{command: string, response: string}>>([]);

  useEffect(() => {
    checkConnection();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      window.history.replaceState({}, document.title, '/');
      checkAuthStatus();
    } else if (urlParams.get('error')) {
      console.error('Auth error:', urlParams.get('error'));
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('http://127.0.0.1:3001/api/health');
      if (response.ok) {
        setIsConnected(true);
        checkAuthStatus();
      }
    } catch (error) {
      console.error('Server not reachable:', error);
    } finally {
      setChecking(false);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('http://127.0.0.1:3001/api/auth/status', {
        credentials: 'include'
      });
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogin = () => {
    window.location.href = 'http://127.0.0.1:3001/api/auth/login';
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const response = await fetch('http://127.0.0.1:3001/api/claude/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ command: command.trim() })
      });

      const data = await response.json();
      
      // Format response with alternatives if available
      let responseMessage = data.message || 'Command processed';
      if (data.result?.alternatives && data.result.alternatives.length > 0) {
        responseMessage += '\n\nOther options:';
        data.result.alternatives.forEach((track: any, index: number) => {
          responseMessage += `\n${index + 1}. ${track.name} by ${track.artists.map((a: any) => a.name).join(', ')}`;
        });
      }
      
      setCommandHistory(prev => [...prev, { 
        command: command.trim(), 
        response: responseMessage
      }]);
      setCommand('');
    } catch (error) {
      console.error('Command failed:', error);
      setCommandHistory(prev => [...prev, { 
        command: command.trim(), 
        response: 'Error processing command' 
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="max-w-7xl w-full flex flex-col md:flex-row gap-6">
          {/* Left Column - Command Area */}
          <div className="w-full md:w-5/12">
            <div className="bg-zinc-900 rounded-xl shadow-xl p-8">
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-green-500 mb-2">🎵 Spotify Claude Controller</h1>
                <p className="text-gray-400">Control your music with natural language</p>
              </div>
              
              <div className="bg-zinc-800 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-green-500 mb-4">🎤 Ready for Commands!</h2>
                <p className="text-gray-400 mb-4">Try natural language commands like:</p>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li>• "Play that dancey Taylor Swift song"</li>
                  <li>• "Queue up some chill jazz"</li>
                  <li>• "Volume up"</li>
                  <li>• "Pause for 2 minutes"</li>
                  <li>• "What's playing?"</li>
                </ul>
              </div>
              
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
                </div>
              </form>

              {isProcessing && <MusicLoader />}
              
              <div className="mt-6 text-center">
                <button 
                  className="px-6 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700 transition-colors text-sm"
                  onClick={() => {
                    fetch('http://127.0.0.1:3001/api/auth/logout', { 
                      method: 'POST',
                      credentials: 'include'
                    }).then(() => {
                      setIsAuthenticated(false);
                    });
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Command History */}
          <div className="w-full md:w-7/12">
            <div className="bg-zinc-900 rounded-xl shadow-xl p-6 h-full flex flex-col">
              <h3 className="text-xl font-semibold text-green-500 mb-4">Command History</h3>
              <div className="flex-1 overflow-y-auto space-y-4">
                {commandHistory.length === 0 ? (
                  <p className="text-gray-400 text-sm">Your commands will appear here...</p>
                ) : (
                  commandHistory.slice().reverse().map((item, index) => (
                    <div key={index} className="border-b border-zinc-800 pb-4 last:border-0">
                      <div className="text-green-500 text-sm font-medium mb-1">
                        ▶ {item.command}
                      </div>
                      <div className="text-gray-400 text-sm whitespace-pre-line pl-4">
                        {item.response}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
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