import { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Plus, Users, Clock, Music, Loader2, Heart } from 'lucide-react';
import { apiEndpoint } from '../../config/api';
import { authenticatedFetch } from '../../utils/api';
import { useSpotifyPlayback } from '../../hooks/useSpotifyPlayback';

interface Track {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  duration_ms: number;
  preview_url?: string;
}

interface PlaylistDetailsModalProps {
  playlist: {
    id: string;
    name: string;
    owner: string;
    description?: string;
    followers: number;
    trackCount: number;
    images: Array<{ url: string; height: number; width: number }>;
    tracks?: Track[];
    uniqueArtists: string[];
    summary?: string;
    characteristics?: {
      primaryGenre?: string;
      mood?: string;
      instrumentation?: string[];
      tempo?: string;
    };
    matchScore?: number;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onPlayTrack: (trackId: string) => void;
  onQueueTrack: (trackId: string) => void;
  onPlayPlaylist: (playlistId: string) => void;
}

export default function PlaylistDetailsModal({
  playlist,
  isOpen,
  onClose,
  onPlayTrack,
  onQueueTrack,
  onPlayPlaylist
}: PlaylistDetailsModalProps) {
  const { isLoading } = useSpotifyPlayback();
  const [fullTrackList, setFullTrackList] = useState<Track[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Format duration from milliseconds to MM:SS
  const formatDuration = useCallback((ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Format follower count with K/M suffixes
  const formatFollowers = useCallback((count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }, []);

  // Fetch full track details when modal opens
  const fetchFullTrackList = useCallback(async (playlistId: string) => {
    setIsLoadingTracks(true);
    setTrackError(null);
    
    try {
      const response = await authenticatedFetch(
        apiEndpoint(`/api/playlist-discovery/batch-details`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlistIds: [playlistId] })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch track details');
      }

      const data = await response.json();
      const playlistData = data.playlists?.[0];
      
      if (playlistData?.tracks) {
        setFullTrackList(playlistData.tracks);
      } else {
        setTrackError('No track data available');
      }
    } catch (error: any) {
      console.error('Error fetching track details:', error);
      setTrackError(error.message || 'Failed to load tracks');
    } finally {
      setIsLoadingTracks(false);
    }
  }, []);

  // Handle escape key and prevent body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Fetch tracks when playlist changes
  useEffect(() => {
    if (isOpen && playlist && (!fullTrackList.length || !playlist.tracks)) {
      fetchFullTrackList(playlist.id);
    }
  }, [isOpen, playlist, fetchFullTrackList, fullTrackList.length]);

  // Handle track actions
  const handlePlayTrack = useCallback((trackId: string) => {
    if (!trackId) {
      console.error('Cannot play track: missing track ID');
      return;
    }
    onPlayTrack(trackId);
  }, [onPlayTrack]);

  const handleQueueTrack = useCallback((trackId: string) => {
    if (!trackId) {
      console.error('Cannot queue track: missing track ID');
      return;
    }
    onQueueTrack(trackId);
  }, [onQueueTrack]);

  // Handle save individual track
  const handleSaveTrack = useCallback(async (trackId: string) => {
    try {
      const response = await authenticatedFetch(`https://api.spotify.com/v1/me/tracks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [trackId] })
      });

      if (!response.ok) {
        throw new Error('Failed to save track');
      }

      console.log(`✅ Saved track ${trackId} to library`);
    } catch (error) {
      console.error('❌ Failed to save track:', error);
    }
  }, []);

  if (!isOpen || !playlist) return null;

  const tracksToShow = fullTrackList.length > 0 ? fullTrackList : (playlist.tracks || []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] m-4 bg-zinc-900 rounded-lg shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-zinc-700">
          <div className="flex items-start gap-4">
            {/* Playlist Cover */}
            <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800">
              {playlist.images?.[0]?.url ? (
                <img
                  src={playlist.images[0].url}
                  alt={playlist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-8 h-8 text-zinc-600" />
                </div>
              )}
            </div>

            {/* Playlist Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white mb-2 truncate">
                {playlist.name}
              </h2>
              <p className="text-zinc-400 mb-2">By {playlist.owner}</p>
              
              <div className="flex items-center gap-4 text-sm text-zinc-500 mb-3">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{formatFollowers(playlist.followers)} followers</span>
                </div>
                <div className="flex items-center gap-1">
                  <Music className="w-4 h-4" />
                  <span>{playlist.trackCount} tracks</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onPlayPlaylist(playlist.id)}
                  disabled={isLoading(`spotify:playlist:${playlist.id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors disabled:opacity-60"
                >
                  {isLoading(`spotify:playlist:${playlist.id}`) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" fill="currentColor" />
                  )}
                  Play Playlist
                </button>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Summary Section */}
          {playlist.summary && (
            <div className="p-6 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-white mb-3">About This Playlist</h3>
              <p className="text-zinc-300 leading-relaxed">{playlist.summary}</p>
              
              {/* Characteristics */}
              {playlist.characteristics && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {playlist.characteristics.primaryGenre && (
                    <span className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm">
                      {playlist.characteristics.primaryGenre}
                    </span>
                  )}
                  {playlist.characteristics.mood && (
                    <span className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm">
                      {playlist.characteristics.mood}
                    </span>
                  )}
                  {playlist.characteristics.tempo && (
                    <span className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm">
                      {playlist.characteristics.tempo}
                    </span>
                  )}
                  {playlist.characteristics.instrumentation?.slice(0, 3).map((instrument, index) => (
                    <span key={index} className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm">
                      {instrument}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Artist Analysis */}
          {playlist.uniqueArtists.length > 0 && (
            <div className="p-6 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-white mb-3">Featured Artists</h3>
              <div className="flex flex-wrap gap-2">
                {playlist.uniqueArtists.slice(0, 20).map((artist, index) => (
                  <span 
                    key={index} 
                    className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm hover:bg-zinc-700 transition-colors"
                  >
                    {artist}
                  </span>
                ))}
                {playlist.uniqueArtists.length > 20 && (
                  <span className="px-3 py-1 bg-zinc-700 text-zinc-400 rounded-full text-sm">
                    +{playlist.uniqueArtists.length - 20} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Track Listing */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">All Tracks</h3>
            
            {isLoadingTracks ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                  <span className="text-zinc-400">Loading tracks...</span>
                </div>
              </div>
            ) : trackError ? (
              <div className="text-center py-8 text-zinc-400">
                <p>{trackError}</p>
              </div>
            ) : tracksToShow.length > 0 ? (
              <div className="space-y-2">
                {tracksToShow.map((track, index) => (
                  <div
                    key={track.id}
                    className="group flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    {/* Track Number */}
                    <div className="w-8 text-center text-zinc-500 text-sm font-mono">
                      {index + 1}
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate group-hover:text-green-400 transition-colors">
                        {track.name}
                      </h4>
                      <p className="text-zinc-400 text-sm truncate">
                        {track.artists.map(artist => artist.name).join(', ')}
                      </p>
                    </div>

                    {/* Duration */}
                    <div className="text-zinc-500 text-sm font-mono">
                      <Clock className="w-4 h-4 inline mr-1" />
                      {formatDuration(track.duration_ms)}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handlePlayTrack(track.id)}
                        disabled={isLoading(`spotify:track:${track.id}`)}
                        className="p-2 text-zinc-400 hover:text-green-400 transition-colors disabled:opacity-60"
                        aria-label={`Play ${track.name}`}
                      >
                        {isLoading(`spotify:track:${track.id}`) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" fill="currentColor" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleQueueTrack(track.id)}
                        disabled={isLoading(`spotify:track:${track.id}`)}
                        className="p-2 text-zinc-400 hover:text-green-400 transition-colors disabled:opacity-60"
                        aria-label={`Add ${track.name} to queue`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleSaveTrack(track.id)}
                        className="p-2 text-zinc-400 hover:text-green-400 transition-colors"
                        aria-label={`Save ${track.name} to library`}
                      >
                        <Heart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-400">
                <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No tracks available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}