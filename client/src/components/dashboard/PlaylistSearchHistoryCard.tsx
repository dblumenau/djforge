import { Clock, Search, AlertCircle, Bot } from 'lucide-react';

interface SearchHistoryMetadata {
  searchHash: string;
  query: string;
  model: string;
  timestamp: number;
  resultCount: number;
  cached: boolean;
}

interface PlaylistSearchHistoryCardProps {
  search: SearchHistoryMetadata;
  onClick: (searchHash: string) => void;
  isLoading?: boolean;
}

export default function PlaylistSearchHistoryCard({ 
  search, 
  onClick, 
  isLoading = false 
}: PlaylistSearchHistoryCardProps) {
  
  // Format timestamp to human-readable date
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return diffMinutes === 0 ? 'Just now' : `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  // Format model name for display
  const formatModelName = (model: string): string => {
    if (model.includes('gemini')) {
      return 'Gemini';
    } else if (model.includes('claude')) {
      return 'Claude';
    } else if (model.includes('gpt')) {
      return 'GPT';
    } else {
      return model.split('/').pop() || model;
    }
  };

  const handleClick = () => {
    if (!isLoading && search.cached) {
      onClick(search.searchHash);
    }
  };

  return (
    <div 
      className={`
        p-4 rounded-xl border transition-all duration-200 cursor-pointer
        ${search.cached 
          ? 'bg-zinc-900/50 border-zinc-800 hover:border-green-600/50 hover:bg-zinc-900/70' 
          : 'bg-zinc-900/30 border-zinc-800/50 cursor-not-allowed opacity-60'
        }
        ${isLoading ? 'animate-pulse' : ''}
      `}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Search Query */}
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-green-500 flex-shrink-0" />
            <h3 className="text-white font-medium truncate">
              "{search.query}"
            </h3>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatDate(search.timestamp)}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Bot className="w-3 h-3" />
              <span>{formatModelName(search.model)}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <span>{search.resultCount} playlist{search.resultCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex-shrink-0">
          {!search.cached ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-900/30 border border-red-800/50">
              <AlertCircle className="w-3 h-3 text-red-400" />
              <span className="text-xs text-red-400 font-medium">Expired</span>
            </div>
          ) : (
            <div className="w-2 h-2 rounded-full bg-green-500" />
          )}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="mt-3 pt-2 border-t border-zinc-800/50">
        <p className="text-xs text-zinc-500">
          {search.cached 
            ? 'Click to load cached results instantly' 
            : 'Search result has expired and is no longer available'
          }
        </p>
      </div>
    </div>
  );
}