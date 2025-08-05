import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { authenticatedFetch } from '../utils/api';
import { useSpotifyPlayback } from './useSpotifyPlayback';

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
}

export function usePlaylistActions() {
  const { playPlaylist, queuePlaylist, playTrack, queueTrack, isLoading: isPlaybackLoading } = useSpotifyPlayback();
  const [savedPlaylists, setSavedPlaylists] = useState<Set<string>>(new Set());
  const [savingPlaylists, setSavingPlaylists] = useState<Set<string>>(new Set());

  const handlePlay = useCallback(async (playlistId: string, playlist?: Playlist) => {
    try {
      console.log(`🎵 Playing playlist: ${playlistId}`);
      const spotifyUri = `spotify:playlist:${playlistId}`;
      
      await playPlaylist(spotifyUri, playlist?.name);
      toast.success(`Now playing: ${playlist?.name || 'playlist'}`, {
        description: `${playlist?.trackCount || 0} tracks`
      });
    } catch (error) {
      console.error('❌ Failed to play playlist:', error);
      toast.error('Failed to play playlist', {
        description: 'Please try again or check your Spotify connection'
      });
    }
  }, [playPlaylist]);

  const handleQueue = useCallback(async (playlistId: string, playlist?: Playlist) => {
    try {
      console.log(`➕ Adding playlist to queue: ${playlistId}`);
      const spotifyUri = `spotify:playlist:${playlistId}`;
      
      const result = await queuePlaylist(spotifyUri, playlist?.name);
      
      if (result.success) {
        toast.success('Added to queue', {
          description: result.response || `Queued tracks from "${playlist?.name}"`
        });
      } else {
        throw new Error(result.error || 'Failed to queue playlist');
      }
    } catch (error: any) {
      console.error('❌ Failed to queue playlist:', error);
      toast.error('Failed to queue playlist', {
        description: error.message || 'Please try again'
      });
    }
  }, [queuePlaylist]);

  const handleSave = useCallback(async (playlistId: string, playlist?: Playlist) => {
    // Prevent duplicate requests
    if (savingPlaylists.has(playlistId)) return;
    
    try {
      setSavingPlaylists(prev => new Set(prev).add(playlistId));
      
      const isCurrentlySaved = savedPlaylists.has(playlistId);
      
      console.log(`${isCurrentlySaved ? '❌ Unfollowing' : '💾 Saving'} playlist: ${playlistId}`);
      
      // Use direct Spotify API call to follow/unfollow the playlist
      const response = await authenticatedFetch(`https://api.spotify.com/v1/playlists/${playlistId}/followers`, {
        method: isCurrentlySaved ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public: false })
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isCurrentlySaved ? 'unfollow' : 'follow'} playlist`);
      }

      // Update saved state
      setSavedPlaylists(prev => {
        const next = new Set(prev);
        if (isCurrentlySaved) {
          next.delete(playlistId);
        } else {
          next.add(playlistId);
        }
        return next;
      });
      
      // Show success feedback
      if (isCurrentlySaved) {
        toast.success('Playlist removed from library', {
          description: `"${playlist?.name}" has been removed from your Spotify library`,
          duration: 3000
        });
      } else {
        toast.success('Playlist saved to library', {
          description: `"${playlist?.name}" has been added to your Spotify library`,
          duration: 3000
        });
      }
      
    } catch (error) {
      console.error(`❌ Failed to ${savedPlaylists.has(playlistId) ? 'unfollow' : 'follow'} playlist:`, error);
      toast.error(`Failed to ${savedPlaylists.has(playlistId) ? 'remove' : 'save'} playlist`, {
        description: 'Please try again or check your connection'
      });
    } finally {
      setSavingPlaylists(prev => {
        const next = new Set(prev);
        next.delete(playlistId);
        return next;
      });
    }
  }, [savedPlaylists, savingPlaylists]);

  const handlePlayTrack = useCallback(async (trackId: string) => {
    try {
      console.log(`🎵 Playing track: ${trackId}`);
      const spotifyUri = `spotify:track:${trackId}`;
      await playTrack(spotifyUri);
      toast.success('Now playing track');
    } catch (error) {
      console.error('❌ Failed to play track:', error);
      toast.error('Failed to play track');
    }
  }, [playTrack]);

  const handleQueueTrack = useCallback(async (trackId: string) => {
    try {
      console.log(`➕ Adding track to queue: ${trackId}`);
      const spotifyUri = `spotify:track:${trackId}`;
      await queueTrack(spotifyUri);
      toast.success('Track added to queue');
    } catch (error) {
      console.error('❌ Failed to queue track:', error);
      toast.error('Failed to queue track');
    }
  }, [queueTrack]);

  return {
    // Playlist actions
    handlePlay,
    handleQueue,
    handleSave,
    
    // Track actions
    handlePlayTrack,
    handleQueueTrack,
    
    // State
    savedPlaylists,
    savingPlaylists,
    isPlaybackLoading,
    
    // State setters (if needed externally)
    setSavedPlaylists,
    setSavingPlaylists
  };
}