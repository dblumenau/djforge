import React, { useState, useEffect } from 'react';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';

const SimpleAuthDebug: React.FC = () => {
  const [renderCount, setRenderCount] = useState(0);
  const [authCheckCount, setAuthCheckCount] = useState(0);
  const authState = useSpotifyAuth();

  // Track render count
  useEffect(() => {
    setRenderCount(prev => prev + 1);
  });

  // Track auth check count
  useEffect(() => {
    setAuthCheckCount(prev => prev + 1);
  }, [authState.isAuthenticated, authState.loading]);

  const currentPath = window.location.pathname;
  const hasToken = !!localStorage.getItem('spotify_jwt');

  return (
    <div className="fixed top-4 left-4 bg-red-800 text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <div className="font-bold mb-2">Auth Debug - Simple</div>
      <div>Path: {currentPath}</div>
      <div>Has Token: {hasToken ? 'YES' : 'NO'}</div>
      <div>Is Authenticated: {authState.isAuthenticated ? 'YES' : 'NO'}</div>
      <div>Loading: {authState.loading ? 'YES' : 'NO'}</div>
      <div>Error: {authState.error || 'None'}</div>
      <div>Render Count: {renderCount}</div>
      <div>Auth Change Count: {authCheckCount}</div>
      <div className="mt-2">
        <button 
          onClick={() => authState.checkAuthStatus()}
          className="bg-blue-600 text-white px-2 py-1 rounded text-xs mr-2"
        >
          Check Auth
        </button>
        <button 
          onClick={() => {
            localStorage.removeItem('spotify_jwt');
            window.location.reload();
          }}
          className="bg-red-600 text-white px-2 py-1 rounded text-xs"
        >
          Clear & Reload
        </button>
      </div>
    </div>
  );
};

export default SimpleAuthDebug;