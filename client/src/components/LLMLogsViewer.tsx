import React, { useState, useEffect } from 'react';
import { apiEndpoint } from '../config/api';
import { authenticatedFetch } from '../utils/api';

interface LLMLogEntry {
  id: string;
  timestamp: number;
  userId: string;
  sessionId: string;
  command: string;
  interpretation: any;
  llmRequest: {
    model: string;
    provider: string;
    flow: string;
    messages: any[];
    temperature: number;
    jsonMode?: boolean;
    grounding?: boolean;
  };
  llmResponse: {
    content: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    latency: number;
    fallbackUsed?: boolean;
    actualModel?: string;
  };
  result: {
    success: boolean;
    message: string;
  };
}

interface LogsResponse {
  logs: LLMLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  stats?: {
    totalQueries: number;
    modelDistribution: Record<string, number>;
    avgLatency: number;
  };
}

interface StatsResponse {
  totalQueries: number;
  modelDistribution: Record<string, number>;
  avgLatency: number;
  flowDistribution: Record<string, number>;
  providerDistribution: Record<string, number>;
  intentDistribution: Record<string, number>;
  errorRate: number;
  periodDays: number;
}

const LLMLogsViewer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [logs, setLogs] = useState<LLMLogEntry[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState<'all' | 'openrouter' | 'gemini-direct'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Check if user is admin and load logs
  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to load admin logs first
        try {
          const response = await authenticatedFetch(apiEndpoint('/api/llm-logs/recent?limit=50'));
          if (response.ok) {
            const data: LogsResponse = await response.json();
            setLogs(data.logs);
            setIsAdmin(true);
          } else if (response.status === 403) {
            // Not admin, load user's own logs
            const userResponse = await authenticatedFetch(apiEndpoint('/api/llm-logs/my-logs'));
            if (userResponse.ok) {
              const data: LogsResponse = await userResponse.json();
              setLogs(data.logs);
              setIsAdmin(false);
            } else {
              throw new Error('Failed to load logs');
            }
          } else {
            throw new Error('Failed to load logs');
          }
        } catch (err) {
          // Fallback to user's own logs
          const userResponse = await authenticatedFetch(apiEndpoint('/api/llm-logs/my-logs'));
          if (userResponse.ok) {
            const data: LogsResponse = await userResponse.json();
            setLogs(data.logs);
            setIsAdmin(false);
          } else {
            throw new Error('Failed to load logs');
          }
        }

        // Load stats if admin
        if (isAdmin) {
          const statsResponse = await authenticatedFetch(apiEndpoint('/api/llm-logs/stats'));
          if (statsResponse.ok) {
            const statsData: StatsResponse = await statsResponse.json();
            setStats(statsData);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load logs');
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !isAdmin) return;

    try {
      setLoading(true);
      const response = await authenticatedFetch(
        apiEndpoint(`/api/llm-logs/search?q=${encodeURIComponent(searchQuery)}`)
      );
      
      if (response.ok) {
        const data: LogsResponse = await response.json();
        setLogs(data.logs);
      } else {
        setError('Search failed');
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = async (newFilter: 'all' | 'openrouter' | 'gemini-direct') => {
    setFilter(newFilter);
    if (!isAdmin || newFilter === 'all') return;

    try {
      setLoading(true);
      const response = await authenticatedFetch(
        apiEndpoint(`/api/llm-logs/by-flow/${newFilter}`)
      );
      
      if (response.ok) {
        const data: LogsResponse = await response.json();
        setLogs(data.logs);
      }
    } catch (err: any) {
      setError(err.message || 'Filter failed');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatLatency = (latency: number) => {
    if (latency < 1000) return `${latency}ms`;
    return `${(latency / 1000).toFixed(1)}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-zinc-800 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">
              LLM Logs {!isAdmin && '(Your Logs Only)'}
            </h2>
            {stats && (
              <p className="text-sm text-gray-400 mt-1">
                {stats.totalQueries} queries • {stats.periodDays} days • 
                {stats.avgLatency}ms avg latency • {stats.errorRate}% error rate
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        {isAdmin && (
          <div className="border-b border-zinc-800 p-4 flex gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-4 py-2 rounded ${
                  filter === 'all' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-zinc-800 text-gray-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleFilterChange('openrouter')}
                className={`px-4 py-2 rounded ${
                  filter === 'openrouter' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-zinc-800 text-gray-400 hover:text-white'
                }`}
              >
                OpenRouter
              </button>
              <button
                onClick={() => handleFilterChange('gemini-direct')}
                className={`px-4 py-2 rounded ${
                  filter === 'gemini-direct' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-zinc-800 text-gray-400 hover:text-white'
                }`}
              >
                Gemini Direct
              </button>
            </div>
            
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search logs..."
                className="flex-1 bg-zinc-800 text-white px-4 py-2 rounded"
              />
              <button
                onClick={handleSearch}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Search
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-400">Loading logs...</div>
          ) : error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-gray-400">No logs found</div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-zinc-800 rounded-lg p-4 hover:bg-zinc-700/50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-gray-400">{formatDate(log.timestamp)}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          log.llmRequest.flow === 'gemini-direct' 
                            ? 'bg-blue-600/20 text-blue-400' 
                            : 'bg-purple-600/20 text-purple-400'
                        }`}>
                          {log.llmRequest.flow}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-zinc-700 text-gray-300">
                          {log.llmRequest.model}
                        </span>
                        {log.llmResponse.fallbackUsed && (
                          <span className="text-xs px-2 py-1 rounded bg-yellow-600/20 text-yellow-400">
                            Fallback
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded ${
                          log.result.success 
                            ? 'bg-green-600/20 text-green-400' 
                            : 'bg-red-600/20 text-red-400'
                        }`}>
                          {log.result.success ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      
                      <div className="text-white mb-2">
                        <span className="text-gray-400">Command:</span> {log.command}
                      </div>
                      
                      <div className="text-sm text-gray-400">
                        <span className="text-gray-500">Intent:</span> {
                          (log.interpretation as any)?.intent || 'Unknown'
                        } • 
                        <span className="text-gray-500"> Latency:</span> {formatLatency(log.llmResponse.latency)} • 
                        <span className="text-gray-500"> Tokens:</span> {
                          log.llmResponse.usage?.totalTokens || 'N/A'
                        }
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      className="text-gray-400 hover:text-white ml-4"
                    >
                      <svg 
                        className={`w-5 h-5 transform transition-transform ${
                          expandedLog === log.id ? 'rotate-180' : ''
                        }`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {expandedLog === log.id && (
                    <div className="mt-4 pt-4 border-t border-zinc-700">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="text-gray-400 mb-2">Interpretation</h4>
                          <pre className="bg-zinc-900 rounded p-2 text-xs overflow-x-auto">
                            {JSON.stringify(log.interpretation, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <h4 className="text-gray-400 mb-2">Response</h4>
                          <pre className="bg-zinc-900 rounded p-2 text-xs overflow-x-auto">
                            {log.llmResponse.content}
                          </pre>
                        </div>
                      </div>
                      <div className="mt-4">
                        <h4 className="text-gray-400 mb-2">Result</h4>
                        <p className="text-gray-300">{log.result.message}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && isAdmin && (
          <div className="border-t border-zinc-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <h4 className="text-sm text-gray-400 mb-2">Model Distribution</h4>
                <div className="space-y-1">
                  {Object.entries(stats.modelDistribution)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([model, count]) => (
                      <div key={model} className="flex justify-between text-sm">
                        <span className="text-gray-300">{model}</span>
                        <span className="text-gray-500">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm text-gray-400 mb-2">Flow Distribution</h4>
                <div className="space-y-1">
                  {stats.flowDistribution && Object.entries(stats.flowDistribution)
                    .map(([flow, count]) => (
                      <div key={flow} className="flex justify-between text-sm">
                        <span className="text-gray-300">{flow}</span>
                        <span className="text-gray-500">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm text-gray-400 mb-2">Intent Distribution</h4>
                <div className="space-y-1">
                  {stats.intentDistribution && Object.entries(stats.intentDistribution)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([intent, count]) => (
                      <div key={intent} className="flex justify-between text-sm">
                        <span className="text-gray-300">{intent}</span>
                        <span className="text-gray-500">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LLMLogsViewer;