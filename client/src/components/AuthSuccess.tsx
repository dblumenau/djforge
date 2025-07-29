import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';

const AuthSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('sessionId');
        
        if (!sessionId) {
          setError('No session ID provided in callback');
          setLoading(false);
          return;
        }

        // Handle the auth callback with the new service
        await authService.handleAuthCallback(urlParams);
        
        // Clean up the URL
        window.history.replaceState(null, '', '/auth-success');
        
        // Redirect to main app
        navigate('/', { replace: true });
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Authentication failed');
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold mb-2">Completing Authentication</h2>
          <p className="text-zinc-300">Setting up your session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4">Authentication Failed</h2>
          <p className="text-zinc-300 mb-6">{error}</p>
          <button
            onClick={() => navigate('/landing')}
            className="px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthSuccess;