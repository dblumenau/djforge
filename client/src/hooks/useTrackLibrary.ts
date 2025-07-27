import { useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';

interface UseTrackLibraryProps {
  trackIds: string[];
  onSaveToggle?: (trackId: string, isSaved: boolean) => void;
}

interface TrackLibraryState {
  savedStatus: Map<string, boolean>;
  loading: Map<string, boolean>;
  error: string | null;
}

export const useTrackLibrary = ({ trackIds, onSaveToggle }: UseTrackLibraryProps) => {
  const [state, setState] = useState<TrackLibraryState>({
    savedStatus: new Map(),
    loading: new Map(),
    error: null
  });

  // Check if tracks are saved
  const checkSavedStatus = useCallback(async () => {
    if (trackIds.length === 0) return;

    try {
      const response = await api.get(`/api/user-data/saved-tracks/contains?ids=${trackIds.join(',')}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.savedStatus) {
          const newSavedStatus = new Map<string, boolean>();
          trackIds.forEach((id, index) => {
            newSavedStatus.set(id, data.savedStatus[index]);
          });
          setState(prev => ({
            ...prev,
            savedStatus: newSavedStatus,
            error: null
          }));
        }
      }
    } catch (error) {
      console.error('Failed to check saved status:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to check saved status'
      }));
    }
  }, [trackIds.join(',')]);

  // Toggle save status for a track
  const toggleSave = useCallback(async (trackId: string) => {
    const isSaved = state.savedStatus.get(trackId) || false;
    
    // Update loading state
    setState(prev => ({
      ...prev,
      loading: new Map(prev.loading).set(trackId, true)
    }));

    try {
      const endpoint = isSaved 
        ? '/api/user-data/saved-tracks' 
        : '/api/user-data/saved-tracks';
      
      const response = isSaved 
        ? await api.delete(endpoint, { trackIds: [trackId] })
        : await api.put(endpoint, { trackIds: [trackId] });

      if (response.ok) {
        // Update saved status
        setState(prev => ({
          ...prev,
          savedStatus: new Map(prev.savedStatus).set(trackId, !isSaved),
          loading: new Map(prev.loading).set(trackId, false),
          error: null
        }));

        // Call callback if provided
        if (onSaveToggle) {
          onSaveToggle(trackId, !isSaved);
        }
      } else {
        throw new Error('Failed to update library');
      }
    } catch (error) {
      console.error('Failed to toggle save status:', error);
      setState(prev => ({
        ...prev,
        loading: new Map(prev.loading).set(trackId, false),
        error: 'Failed to update library'
      }));
    }
  }, [state.savedStatus, onSaveToggle]);

  // Check saved status when track IDs change
  useEffect(() => {
    checkSavedStatus();
  }, [checkSavedStatus]);

  return {
    savedStatus: state.savedStatus,
    loading: state.loading,
    error: state.error,
    toggleSave,
    checkSavedStatus,
    isSaved: (trackId: string) => state.savedStatus.get(trackId) || false,
    isLoading: (trackId: string) => state.loading.get(trackId) || false
  };
};