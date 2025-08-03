import { Clock, Calendar, User, Play, Copy, CheckCircle } from 'lucide-react';
import type { PlaylistDetails } from '../../../@types/playlist-search';

interface TracksTabProps {
  playlist: PlaylistDetails;
  copiedItem: string | null;
  onCopyToClipboard: (text: string, itemId: string) => void;
  formatDuration: (ms: number) => string;
  formatDate: (dateString: string) => string;
}

export default function TracksTab({ 
  playlist, 
  copiedItem, 
  onCopyToClipboard, 
  formatDuration, 
  formatDate 
}: TracksTabProps) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-400">
        Showing {playlist.tracks.items.length} of {playlist.tracks.total} tracks
      </div>
      <div className="space-y-2">
        {playlist.tracks.items.map((item, index) => {
          if (!item.track) return null;
          const track = item.track;
          
          return (
            <div key={`${track.id}-${index}`} className="bg-zinc-800 rounded-lg p-4 hover:bg-zinc-700 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-sm w-8">{index + 1}</span>
                    <div className="flex-1">
                      <h4 className="font-medium text-white">
                        {track.name}
                        {track.explicit && (
                          <span className="ml-2 px-1.5 py-0.5 bg-zinc-700 text-xs rounded">E</span>
                        )}
                      </h4>
                      <p className="text-sm text-zinc-400">
                        {track.artists.map(a => a.name).join(', ')} • {track.album.name}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(track.duration_ms)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Added {formatDate(item.added_at)}
                        </span>
                        {item.added_by?.display_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {item.added_by.display_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {track.preview_url && (
                    <a
                      href={track.preview_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-zinc-600 rounded-lg transition-colors"
                      title="Preview"
                    >
                      <Play className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => onCopyToClipboard(track.uri, `track-${track.id}`)}
                    className="p-2 hover:bg-zinc-600 rounded-lg transition-colors"
                    title="Copy Track URI"
                  >
                    {copiedItem === `track-${track.id}` ? 
                      <CheckCircle className="w-4 h-4 text-green-400" /> : 
                      <Copy className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {playlist.tracks.next && (
        <div className="text-center py-4 text-sm text-zinc-400">
          Note: Additional tracks available. Full pagination not implemented yet.
        </div>
      )}
    </div>
  );
}