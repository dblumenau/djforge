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
      <div className="container">
        <div className="header">
          <h1>🎵 Spotify Claude Controller</h1>
          <p>Checking connection...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="container">
        <div className="header">
          <h1>🎵 Spotify Claude Controller</h1>
          <p>Server not running</p>
        </div>
        <div className="setup-message">
          <h2>⚠️ Backend Not Detected</h2>
          <p>Please make sure the server is running:</p>
          <ol>
            <li>Open a new terminal</li>
            <li>Navigate to the project directory</li>
            <li>Run: <code>npm run dev</code></li>
          </ol>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="container">
        <div className="header">
          <h1>🎵 Spotify Claude Controller</h1>
          <p>Control your music with natural language</p>
        </div>
        
        <div className="command-box">
          <h2>🎤 Ready for Commands!</h2>
          <p>Try natural language commands like:</p>
          <ul style={{ textAlign: 'left', margin: '15px auto', maxWidth: '400px', fontSize: '14px' }}>
            <li>"Play that dancey Taylor Swift song"</li>
            <li>"Queue up some chill jazz"</li>
            <li>"Volume up"</li>
            <li>"Pause for 2 minutes"</li>
            <li>"What's playing?"</li>
          </ul>
          
          <form onSubmit={handleCommandSubmit} style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Type your command..."
                disabled={isProcessing}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '16px',
                  backgroundColor: '#333',
                  border: '1px solid #444',
                  borderRadius: '8px',
                  color: '#fff',
                  outline: 'none'
                }}
                autoFocus
              />
              <button
                type="submit"
                disabled={isProcessing || !command.trim()}
                className="button"
                style={{ 
                  padding: '12px 24px',
                  opacity: isProcessing || !command.trim() ? 0.5 : 1
                }}
              >
                {isProcessing ? 'Processing...' : 'Send'}
              </button>
            </div>
          </form>

          {isProcessing && <MusicLoader />}

          {commandHistory.length > 0 && (
            <div style={{ marginTop: '30px', textAlign: 'left' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#1db954' }}>Command History</h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {commandHistory.slice().reverse().map((item, index) => (
                  <div key={index} style={{ marginBottom: '15px', fontSize: '14px' }}>
                    <div style={{ color: '#1db954' }}>▶ {item.command}</div>
                    <div style={{ color: '#b3b3b3', marginLeft: '20px', marginTop: '5px', whiteSpace: 'pre-line' }}>
                      {item.response}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <button 
            className="button" 
            onClick={() => {
              fetch('http://127.0.0.1:3001/api/auth/logout', { 
                method: 'POST',
                credentials: 'include'
              }).then(() => {
                setIsAuthenticated(false);
              });
            }}
            style={{ backgroundColor: '#dc3545' }}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>🎵 Spotify Claude Controller</h1>
        <p>Control your music with natural language</p>
      </div>
      
      <div className="setup-message">
        <h2>🚀 Ready to Connect!</h2>
        <p>Your Spotify credentials are configured. Click below to login:</p>
        <p style={{ marginTop: '15px', color: '#888', fontSize: '13px' }}>
          This will redirect you to Spotify for authorization
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <button 
          className="button" 
          onClick={handleLogin}
          disabled={authChecking}
        >
          {authChecking ? 'Checking...' : 'Login with Spotify'}
        </button>
      </div>
    </div>
  );
}

export default App;