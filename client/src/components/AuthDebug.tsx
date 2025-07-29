import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
// WARNING: Using temporary auth bypass during auth system refactor
import { tempAuthUtils } from '../utils/temp-auth';

const AuthDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [renderCount, setRenderCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    setRenderCount(prev => prev + 1);
    
    const checkDebugInfo = async () => {
      // WARNING: JWT system disabled during auth system refactor
      const jwtToken = tempAuthUtils.getToken();
      
      let authResponse = {
        authenticated: false,
        message: 'Auth system disabled during refactor',
        error: null
      };
      
      setDebugInfo({
        currentPath: location.pathname,
        hasJWT: !!jwtToken,
        jwtExists: jwtToken ? 'YES' : 'NO (temp disabled)',
        jwtLength: 0,
        authResponse,
        timestamp: new Date().toISOString()
      });
    };
    
    checkDebugInfo();
  }, [location.pathname]);

  const clearToken = () => {
    // WARNING: Using temp auth utils during refactor
    tempAuthUtils.logout();
    window.location.reload();
  };

  const testAuth = async () => {
    // WARNING: Auth testing disabled during auth system refactor
    alert('Auth testing disabled during auth system refactor');
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