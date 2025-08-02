import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import QueueSkeleton from './skeletons/QueueSkeleton';

interface QueueTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string };
  duration_ms: number;
}

interface QueueDisplayProps {
  onClose: () => void;
}

const QueueDisplay: React.FC<QueueDisplayProps> = ({ onClose }) => {
  const [queue, setQueue] = useState<{
    currently_playing: QueueTrack | null;
    queue: QueueTrack[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/control/queue');
      if (response.ok) {
        const data = await response.json();
        console.log('Queue data from API:', data); // Debug log
        if (data.success && data.queue) {
          // The Spotify API returns queue data nested - extract it properly
          const queueData = {
            currently_playing: data.queue.currently_playing || null,
            queue: data.queue.queue || []
          };
          console.log('Processed queue data:', queueData); // Debug log
          setQueue(queueData);
        } else {
          setError('Failed to fetch queue');
        }
      } else {
        setError('Failed to fetch queue');
      }
    } catch (err) {
      console.error('Error fetching queue:', err);
      setError('Failed to fetch queue');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-lg p-6 max-w-2xl w-full h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Queue</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && <QueueSkeleton />}

        {error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-red-400">{error}</div>
          </div>
        )}

        {queue && !loading && !error && (
          <div className="flex-1 overflow-y-auto">
            {queue.currently_playing && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Now Playing</h3>
                <div className="bg-zinc-800 rounded-lg p-3 border border-green-500/30">
                  <div className="text-white font-medium">{queue.currently_playing.name}</div>
                  <div className="text-sm text-gray-400">
                    {queue.currently_playing.artists.map(a => a.name).join(', ')} • {queue.currently_playing.album.name}
                  </div>
                </div>
              </div>
            )}

            {queue.queue.length > 0 ? (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Up Next</h3>
                <div className="space-y-2">
                  {queue.queue.map((track, index) => (
                    <div key={`${track.id}-${index}`} className="bg-zinc-800 rounded-lg p-3 hover:bg-zinc-700 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="text-white font-medium truncate">{track.name}</div>
                          <div className="text-sm text-gray-400 truncate">
                            {track.artists.map(a => a.name).join(', ')} • {track.album.name}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDuration(track.duration_ms)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 mt-8">
                <div className="mb-2">No tracks in queue</div>
                <div className="text-sm">Add tracks to your queue to see them here</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueDisplay;