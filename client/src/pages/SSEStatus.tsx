import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { api } from '../utils/api';

interface ConnectionInfo {
  id: string;
  userId: string;
  connectedAt: string;
  lastActivity: string;
  ageSeconds: number;
  lastActivitySeconds: number;
  isAlive: boolean;
}

interface SSEStatusData {
  totalConnections: number;
  userConnectionCounts: Record<string, number>;
  connections: ConnectionInfo[];
  message: string;
}

const SSEStatus: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useSpotifyAuth();
  const [statusData, setStatusData] = useState<SSEStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await api.get('/api/auth/admin-check');
        if (response.ok) {
          const data = await response.json();
          if (!data.isAdmin) {
            navigate('/');
          } else {
            setIsAdmin(true);
          }
        } else {
          navigate('/');
        }
      } catch (error) {
        console.error('Failed to check admin status:', error);
        navigate('/');
      }
    };

    if (!authLoading && isAuthenticated) {
      checkAdminStatus();
    } else if (!authLoading && !isAuthenticated) {
      navigate('/landing');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Fetch SSE status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/admin/sse/status');
      if (response.ok) {
        const data = await response.json();
        setStatusData(data);
      } else {
        throw new Error('Failed to fetch SSE status');
      }
    } catch (error: any) {
      console.error('Error fetching SSE status:', error);
      setError(error.message || 'Failed to fetch SSE status');
    } finally {
      setLoading(false);
    }
  };

  // Clear all connections
  const clearAllConnections = async () => {
    if (!confirm('Are you sure you want to close all SSE connections?')) {
      return;
    }

    try {
      const response = await api.delete('/api/admin/sse/connections');
      if (response.ok) {
        const data = await response.json();
        alert(`Successfully cleared ${data.previousCount} connections`);
        fetchStatus(); // Refresh the status
      } else {
        throw new Error('Failed to clear connections');
      }
    } catch (error: any) {
      console.error('Error clearing connections:', error);
      alert('Failed to clear connections: ' + error.message);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStatus();
      // Auto-refresh every 10 seconds
      const interval = setInterval(fetchStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-green-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">SSE Connection Status</h1>
          <div className="flex gap-2">
            <button
              onClick={fetchStatus}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              🔄 Refresh
            </button>
            <button
              onClick={clearAllConnections}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              🗑️ Clear All Connections
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>

        {loading && (
          <div className="bg-zinc-800 rounded-lg p-6 text-center">
            <div className="animate-pulse text-zinc-400">Loading connection data...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {statusData && !loading && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="text-sm text-zinc-400 mb-2">Total Connections</h3>
                <p className="text-3xl font-bold text-white">{statusData.totalConnections}</p>
                <p className="text-xs text-zinc-500 mt-2">Max: 10 per instance</p>
              </div>
              
              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="text-sm text-zinc-400 mb-2">Unique Users</h3>
                <p className="text-3xl font-bold text-white">
                  {Object.keys(statusData.userConnectionCounts).length}
                </p>
              </div>
              
              <div className="bg-zinc-800 rounded-lg p-6">
                <h3 className="text-sm text-zinc-400 mb-2">Dead Connections</h3>
                <p className="text-3xl font-bold text-red-400">
                  {statusData.connections.filter(c => !c.isAlive).length}
                </p>
              </div>
            </div>

            {/* User Connection Counts */}
            <div className="bg-zinc-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Connections per User</h2>
              <div className="space-y-2">
                {Object.entries(statusData.userConnectionCounts).map(([userId, count]) => (
                  <div key={userId} className="flex justify-between items-center py-2 border-b border-zinc-700">
                    <span className="text-zinc-300 font-mono">{userId}</span>
                    <span className={`font-bold ${count > 2 ? 'text-orange-400' : 'text-green-400'}`}>
                      {count} connection{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connection Details */}
            <div className="bg-zinc-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Connection Details</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700">
                      <th className="text-left py-2 px-2 text-zinc-400">User ID</th>
                      <th className="text-left py-2 px-2 text-zinc-400">Age</th>
                      <th className="text-left py-2 px-2 text-zinc-400">Last Activity</th>
                      <th className="text-left py-2 px-2 text-zinc-400">Status</th>
                      <th className="text-left py-2 px-2 text-zinc-400">Connection ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusData.connections.map((conn) => (
                      <tr key={conn.id} className="border-b border-zinc-700/50 hover:bg-zinc-700/20">
                        <td className="py-2 px-2 font-mono text-zinc-300">{conn.userId}</td>
                        <td className="py-2 px-2 text-zinc-400">
                          {Math.floor(conn.ageSeconds / 60)}m {conn.ageSeconds % 60}s
                        </td>
                        <td className="py-2 px-2 text-zinc-400">
                          {conn.lastActivitySeconds < 60 
                            ? `${conn.lastActivitySeconds}s ago` 
                            : `${Math.floor(conn.lastActivitySeconds / 60)}m ago`}
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            conn.isAlive 
                              ? 'bg-green-900/30 text-green-400' 
                              : 'bg-red-900/30 text-red-400'
                          }`}>
                            {conn.isAlive ? '● Active' : '○ Dead'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-xs font-mono text-zinc-500">
                          {conn.id.substring(0, 20)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Auto-refresh indicator */}
            <div className="mt-4 text-center text-xs text-zinc-500">
              Auto-refreshing every 10 seconds
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SSEStatus;