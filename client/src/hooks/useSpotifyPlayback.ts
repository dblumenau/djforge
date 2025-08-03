import { useCallback, useState } from 'react';
import { apiEndpoint } from '../config/api';
import { authenticatedFetch } from '../utils/api';

export function useSpotifyPlayback() {
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

  const isLoading = useCallback((uri: string) => {
    return loadingItems.has(uri);
  }, [loadingItems]);

  const playTrack = useCallback(async (uri: string) => {
    if (loadingItems.has(uri)) return;
    
    setLoadingItems(prev => new Set(prev).add(uri));
    
    try {
      const response = await authenticatedFetch(apiEndpoint('/api/direct/song'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri,
          action: 'play'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to play track');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error playing track:', error);
      throw error;
    } finally {
      setLoadingItems(prev => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
    }
  }, [loadingItems]);

  const queueTrack = useCallback(async (uri: string) => {
    if (loadingItems.has(uri)) return;
    
    setLoadingItems(prev => new Set(prev).add(uri));
    
    try {
      const response = await authenticatedFetch(apiEndpoint('/api/direct/song'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri,
          action: 'queue'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to queue track');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error queueing track:', error);
      throw error;
    } finally {
      setLoadingItems(prev => {
        const next = new Set(prev);
        next.delete(uri);
        return next;
      });
    }
  }, [loadingItems]);

  const playPlaylist = useCallback(async (uriOrId: string, name?: string) => {
    if (loadingItems.has(uriOrId)) return;
    
    // Convert ID to full Spotify URI if needed
    const uri = uriOrId.startsWith('spotify:') 
      ? uriOrId 
      : `spotify:playlist:${uriOrId}`;
    
    setLoadingItems(prev => new Set(prev).add(uriOrId));
    
    try {
      const response = await authenticatedFetch(apiEndpoint('/api/direct/playlist-uri'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri,
          action: 'play',
          name
        })
      });

      if (!response.ok) {
        throw new Error('Failed to play playlist');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error playing playlist:', error);
      throw error;
    } finally {
      setLoadingItems(prev => {
        const next = new Set(prev);
        next.delete(uriOrId);
        return next;
      });
    }
  }, [loadingItems]);

  return {
    playTrack,
    queueTrack,
    playPlaylist,
    isLoading
  };
}