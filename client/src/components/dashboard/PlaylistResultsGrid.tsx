import { useState, useCallback } from 'react';
import PlaylistDiscoveryCard from './PlaylistDiscoveryCard';
import PlaylistDetailsModal from './PlaylistDetailsModal';
import { usePlaylistActions } from '../../hooks/usePlaylistActions';

interface DiscoveredPlaylist {
  id: string;
  name: string;
  owner: string;
  description?: string;
  followers: number;
  trackCount: number;
  images: Array<{ url: string; height: number; width: number }>;
  uniqueArtists?: string[] | number;
  summary?: string;
  alignmentLevel?: 'strong' | 'moderate' | 'weak' | 'tangential';
  characteristics?: {
    primaryGenre?: string;
    mood?: string;
    instrumentation?: string[];
    tempo?: string;
    decadeRange?: string;
  };
  matchScore?: number;
  reasoning?: string;
  // Add any tracks that might be loaded later
  tracks?: any[];
}

interface PlaylistResultsGridProps {
  playlists: DiscoveredPlaylist[];
  title?: string;
  emptyMessage?: string;
}

export default function PlaylistResultsGrid({ 
  playlists, 
  title,
  emptyMessage = "No playlists to display"
}: PlaylistResultsGridProps) {
  const {
    handlePlay,
    handleQueue,
    handleSave,
    handlePlayTrack,
    handleQueueTrack,
    savedPlaylists,
    savingPlaylists,
    isPlaybackLoading
  } = usePlaylistActions();

  const [selectedPlaylist, setSelectedPlaylist] = useState<DiscoveredPlaylist | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewTracks = useCallback((playlistId: string) => {
    console.log(`👁️ View tracks for playlist: ${playlistId}`);
    
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist) {
      setSelectedPlaylist(playlist);
      setIsModalOpen(true);
    }
  }, [playlists]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedPlaylist(null);
  }, []);

  // Wrapper functions that pass the playlist object
  const handlePlayWrapper = useCallback((playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    return handlePlay(playlistId, playlist);
  }, [playlists, handlePlay]);

  const handleQueueWrapper = useCallback((playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    return handleQueue(playlistId, playlist);
  }, [playlists, handleQueue]);

  const handleSaveWrapper = useCallback((playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    return handleSave(playlistId, playlist);
  }, [playlists, handleSave]);

  const handlePlayPlaylist = useCallback((playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    return handlePlay(playlistId, playlist);
  }, [playlists, handlePlay]);

  if (playlists.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {title && (
        <h3 className="text-lg font-semibold text-white mb-4">
          {title}
        </h3>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playlists.map((playlist) => (
          <PlaylistDiscoveryCard
            key={playlist.id}
            playlist={playlist}
            onPlay={handlePlayWrapper}
            onQueue={handleQueueWrapper}
            onSave={handleSaveWrapper}
            onViewTracks={handleViewTracks}
            isLoading={isPlaybackLoading(`spotify:playlist:${playlist.id}`)}
            isSaved={savedPlaylists.has(playlist.id)}
            isSaving={savingPlaylists.has(playlist.id)}
          />
        ))}
      </div>

      {/* Playlist Details Modal */}
      <PlaylistDetailsModal
        playlist={selectedPlaylist ? {
          ...selectedPlaylist,
          uniqueArtists: Array.isArray(selectedPlaylist.uniqueArtists) 
            ? selectedPlaylist.uniqueArtists 
            : []
        } : null}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onPlayTrack={handlePlayTrack}
        onQueueTrack={handleQueueTrack}
        onPlayPlaylist={handlePlayPlaylist}
      />
    </>
  );
}