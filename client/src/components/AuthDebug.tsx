import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const AuthDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [renderCount, setRenderCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    setRenderCount(prev => prev + 1);
    
    const checkDebugInfo = async () => {
      const jwtToken = localStorage.getItem('spotify_jwt');
      
      let authResponse = null;
      if (jwtToken) {
        try {
          const response = await fetch('http://127.0.0.1:4001/api/auth/status', {
            headers: {
              'Authorization': `Bearer ${jwtToken}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });
          authResponse = await response.json();
        } catch (error) {
          authResponse = { error: error instanceof Error ? error.message : String(error) };
        }
      }
      
      setDebugInfo({
        currentPath: location.pathname,
        hasJWT: !!jwtToken,
        jwtExists: jwtToken ? 'YES' : 'NO',
        jwtLength: jwtToken?.length || 0,
        authResponse,
        timestamp: new Date().toISOString()
      });
    };
    
    checkDebugInfo();
  }, [location.pathname]);

  const clearToken = () => {
    localStorage.removeItem('spotify_jwt');
    window.location.reload();
  };

  const testAuth = async () => {
    const jwtToken = localStorage.getItem('spotify_jwt');
    if (jwtToken) {
      try {
        const response = await fetch('http://127.0.0.1:3001/api/auth/status', {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        const data = await response.json();
        alert(`Auth Status: ${JSON.stringify(data, null, 2)}`);
      } catch (error) {
        alert(`Auth Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      alert('No JWT token found');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      backgroundColor: 'rgba(255, 0, 0, 0.9)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <h4>🔍 Auth Debug (Renders: {renderCount})</h4>
      <div>Path: {debugInfo.currentPath}</div>
      <div>JWT: {debugInfo.jwtExists} ({debugInfo.jwtLength} chars)</div>
      <div>Auth: {debugInfo.authResponse?.authenticated ? '✅' : '❌'}</div>
      <div>Server: {debugInfo.authResponse?.error ? '❌' : '✅'}</div>
      <div style={{ marginTop: '5px' }}>
        <button onClick={testAuth} style={{ marginRight: '5px', fontSize: '10px' }}>Test Auth</button>
        <button onClick={clearToken} style={{ fontSize: '10px' }}>Clear Token</button>
      </div>
      <div style={{ fontSize: '10px', marginTop: '5px' }}>
        Updated: {debugInfo.timestamp?.substring(11, 19)}
      </div>
    </div>
  );
};

export default AuthDebug;