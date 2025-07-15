import React, { useState, useEffect } from 'react';
import { apiEndpoint } from '../config/api';

interface AuthDebugInfo {
  localStorageToken: string | null;
  authStatus: any;
  apiResponse: any;
  error: string | null;
  timestamp: string;
}

const AuthDebugger: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<AuthDebugInfo>({
    localStorageToken: null,
    authStatus: null,
    apiResponse: null,
    error: null,
    timestamp: new Date().toISOString()
  });
  const [isChecking, setIsChecking] = useState(false);

  const runAuthDebugCheck = async () => {
    setIsChecking(true);
    const timestamp = new Date().toISOString();
    
    try {
      // Step 1: Check localStorage
      const localStorageToken = localStorage.getItem('spotify_jwt');
      console.log('🔍 AuthDebugger: localStorage token:', localStorageToken ? 'EXISTS' : 'MISSING');
      
      // Step 2: Check auth status endpoint
      const url = apiEndpoint('/api/auth/status');
      console.log('🔍 AuthDebugger: Checking auth at:', url);
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (localStorageToken) {
        headers['Authorization'] = `Bearer ${localStorageToken}`;
        console.log('🔍 AuthDebugger: Adding Authorization header');
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers
      });
      
      console.log('🔍 AuthDebugger: Response status:', response.status);
      
      const responseData = await response.json();
      console.log('🔍 AuthDebugger: Response data:', responseData);
      
      setDebugInfo({
        localStorageToken,
        authStatus: responseData,
        apiResponse: {
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        },
        error: null,
        timestamp
      });
    } catch (error) {
      console.error('🔍 AuthDebugger: Error during debug check:', error);
      setDebugInfo({
        localStorageToken: localStorage.getItem('spotify_jwt'),
        authStatus: null,
        apiResponse: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Run debug check on component mount
  useEffect(() => {
    runAuthDebugCheck();
  }, []);

  const clearLocalStorage = () => {
    localStorage.removeItem('spotify_jwt');
    console.log('🔍 AuthDebugger: Cleared localStorage token');
    runAuthDebugCheck();
  };

  const testJWTDecoding = () => {
    const token = localStorage.getItem('spotify_jwt');
    if (!token) {
      console.log('🔍 AuthDebugger: No token to decode');
      return;
    }
    
    try {
      // Simple JWT parsing (just for debugging, not secure)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('🔍 AuthDebugger: Invalid JWT format');
        return;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      console.log('🔍 AuthDebugger: JWT payload:', payload);
      
      // Check expiration
      const now = Date.now() / 1000;
      if (payload.exp && payload.exp < now) {
        console.log('🔍 AuthDebugger: JWT token is EXPIRED');
      } else {
        console.log('🔍 AuthDebugger: JWT token is VALID');
      }
    } catch (error) {
      console.error('🔍 AuthDebugger: Error decoding JWT:', error);
    }
  };

  return (
    <div className="fixed top-4 right-4 bg-zinc-800 border border-zinc-700 rounded-lg p-4 max-w-md z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Auth Debugger</h3>
        <button
          onClick={runAuthDebugCheck}
          disabled={isChecking}
          className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 text-sm"
        >
          {isChecking ? 'Checking...' : 'Refresh'}
        </button>
      </div>
      
      <div className="space-y-3 text-sm">
        <div>
          <span className="font-medium text-gray-300">localStorage Token:</span>
          <div className="text-xs text-gray-400 mt-1">
            {debugInfo.localStorageToken ? (
              <span className="text-green-400">✓ EXISTS ({debugInfo.localStorageToken.length} chars)</span>
            ) : (
              <span className="text-red-400">✗ MISSING</span>
            )}
          </div>
        </div>
        
        <div>
          <span className="font-medium text-gray-300">Auth Status:</span>
          <div className="text-xs text-gray-400 mt-1">
            {debugInfo.authStatus ? (
              <div className="space-y-1">
                <div>Authenticated: {debugInfo.authStatus.authenticated ? 
                  <span className="text-green-400">✓ YES</span> : 
                  <span className="text-red-400">✗ NO</span>
                }</div>
                {debugInfo.authStatus.tokenExpired !== undefined && (
                  <div>Token Expired: {debugInfo.authStatus.tokenExpired ? 
                    <span className="text-red-400">✓ YES</span> : 
                    <span className="text-green-400">✗ NO</span>
                  }</div>
                )}
                {debugInfo.authStatus.hasRefreshToken !== undefined && (
                  <div>Has Refresh Token: {debugInfo.authStatus.hasRefreshToken ? 
                    <span className="text-green-400">✓ YES</span> : 
                    <span className="text-red-400">✗ NO</span>
                  }</div>
                )}
              </div>
            ) : (
              <span className="text-gray-500">No data</span>
            )}
          </div>
        </div>
        
        <div>
          <span className="font-medium text-gray-300">API Response:</span>
          <div className="text-xs text-gray-400 mt-1">
            {debugInfo.apiResponse ? (
              <div>
                Status: {debugInfo.apiResponse.status} ({debugInfo.apiResponse.ok ? 'OK' : 'ERROR'})
              </div>
            ) : (
              <span className="text-gray-500">No response</span>
            )}
          </div>
        </div>
        
        {debugInfo.error && (
          <div>
            <span className="font-medium text-red-400">Error:</span>
            <div className="text-xs text-red-300 mt-1">{debugInfo.error}</div>
          </div>
        )}
        
        <div className="text-xs text-gray-500">
          Last check: {new Date(debugInfo.timestamp).toLocaleTimeString()}
        </div>
      </div>
      
      <div className="mt-4 flex space-x-2">
        <button
          onClick={clearLocalStorage}
          className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
        >
          Clear Token
        </button>
        <button
          onClick={testJWTDecoding}
          className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs"
        >
          Decode JWT
        </button>
      </div>
    </div>
  );
};

export default AuthDebugger;