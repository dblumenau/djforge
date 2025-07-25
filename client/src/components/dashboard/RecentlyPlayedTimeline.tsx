import React from 'react';

interface RecentTrack {
  track: {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: {
      name: string;
      images: Array<{ url: string }>;
    };
    duration_ms: number;
    uri: string;
  };
  played_at: string;
  context?: {
    type: string;
    uri: string;
  };
}

interface RecentlyPlayedTimelineProps {
  tracks: RecentTrack[];
  onPlay?: (trackUri: string) => void;
  onQueue?: (trackUri: string) => void;
  isLoading?: (uri: string) => boolean;
}

export default function RecentlyPlayedTimeline({ tracks, onPlay, onQueue, isLoading }: RecentlyPlayedTimelineProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let relativeTime = '';
    if (diffMins < 1) relativeTime = 'Just now';
    else if (diffMins < 60) relativeTime = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    else if (diffHours < 24) relativeTime = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    else if (diffDays < 7) relativeTime = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    else relativeTime = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const exactTime = date.toLocaleTimeString('en-US', { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    return { relativeTime, exactTime };
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Group tracks by date
  const groupedTracks = tracks.reduce((acc, track) => {
    const date = new Date(track.played_at).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(track);
    return acc;
  }, {} as Record<string, RecentTrack[]>);

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-zinc-700"></div>

      {/* Grouped tracks */}
      {Object.entries(groupedTracks).map(([date, dateTracks], groupIndex) => (
        <div key={date} className="mb-8">
          {/* Date header */}
          <div className="flex items-center mb-4">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center border-4 border-zinc-950">
              <span className="text-xs font-bold text-zinc-400">
                {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <h3 className="ml-4 text-lg font-semibold text-zinc-300">
              {date === new Date().toDateString() ? 'Today' : 
               date === new Date(Date.now() - 86400000).toDateString() ? 'Yesterday' : 
               new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}
            </h3>
          </div>

          {/* Tracks for this date */}
          <div className="ml-20 space-y-3">
            {dateTracks.map((item, index) => (
              <div 
                key={`${item.track.id}-${index}`}
                className="group relative bg-zinc-900 rounded-lg p-4 hover:bg-zinc-800 transition-all duration-200 hover:shadow-lg"
              >
                {/* Time dot */}
                <div className="absolute -left-[46px] top-6 w-3 h-3 bg-green-500 rounded-full ring-4 ring-zinc-950"></div>

                <div className="flex items-center gap-4">
                  {/* Album art */}
                  <div className="relative w-14 h-14 flex-shrink-0">
                    {item.track.album.images?.[0] && (
                      <img
                        src={item.track.album.images[0].url}
                        alt={item.track.album.name}
                        className="w-full h-full rounded object-cover"
                      />
                    )}
                    {(onPlay || onQueue) && (
                      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                        {onPlay && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlay(item.track.uri);
                            }}
                            disabled={isLoading?.(item.track.uri)}
                            className="p-1 hover:bg-white/20 rounded disabled:opacity-60"
                            title="Play"
                          >
                            {isLoading?.(item.track.uri) ? (
                              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 4v12l10-6z" />
                              </svg>
                            )}
                          </button>
                        )}
                        {onQueue && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onQueue(item.track.uri);
                            }}
                            disabled={isLoading?.(item.track.uri)}
                            className="p-1 hover:bg-white/20 rounded disabled:opacity-60"
                            title="Add to Queue"
                          >
                            {isLoading?.(item.track.uri) ? (
                              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Track info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate group-hover:text-green-400 transition-colors">
                      {item.track.name}
                    </h4>
                    <p className="text-xs text-zinc-400 truncate">
                      {item.track.artists.map(a => a.name).join(', ')} • {item.track.album.name}
                    </p>
                  </div>

                  {/* Time and duration */}
                  <div className="text-right text-xs text-zinc-500">
                    <p>{formatTime(item.played_at).relativeTime}</p>
                    <p className="text-zinc-600">{formatTime(item.played_at).exactTime}</p>
                    <p>{formatDuration(item.track.duration_ms)}</p>
                  </div>
                </div>

                {/* Context info */}
                {item.context && (
                  <div className="mt-2 text-xs text-zinc-600">
                    Played from {item.context.type}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}