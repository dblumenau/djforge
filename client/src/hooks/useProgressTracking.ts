import { useState, useCallback, useRef } from 'react';
import { PlaybackState } from '../types/playback.types';
import { api } from '../utils/api';

/**
 * Custom hook for managing progress tracking and seeking functionality
 * 
 * Handles:
 * - Local position state for smooth animations
 * - Animation frame-based position updates
 * - Seeking functionality with instant visual feedback
 * - Track change detection for transition effects
 * 
 * @param playbackState - Current playback state
 * @param fetchPlaybackState - Function to refresh playback state
 * @returns Object containing position state and seek handler
 */
export const useProgressTracking = (
  playbackState: PlaybackState,
  fetchPlaybackState: (immediate?: boolean) => Promise<void>
) => {
  const [localPosition, setLocalPosition] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const [isTrackChanging, setIsTrackChanging] = useState(false);

  // Update local position with animation frame
  const startProgressAnimation = useCallback((startPosition?: number) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // CRITICAL: Use the provided startPosition, NOT localPosition (which may be stale)
    const basePosition = startPosition !== undefined 
      ? startPosition 
      : playbackState.track?.position ?? 0;
    
    // If we have a start position, immediately set it
    if (startPosition !== undefined) {
      setLocalPosition(startPosition);
    }
    
    const animationStartTime = Date.now();
    
    const animate = () => {
      if (playbackState.isPlaying && playbackState.track) {
        const elapsed = Date.now() - animationStartTime;
        const newPosition = Math.min(
          basePosition + elapsed,
          playbackState.track.duration * 1000  // Convert seconds to milliseconds
        );
        setLocalPosition(newPosition);
        
        // Continue animation only if still playing
        if (playbackState.isPlaying) {
          const frameId = requestAnimationFrame(animate);
          animationFrameRef.current = frameId;
        }
      }
    };
    
    animate();
  }, [playbackState.isPlaying, playbackState.track]);
  // Note: animationFrameId is intentionally omitted from dependencies
  // to prevent infinite recreation of this function

  // Handle seeking functionality
  const handleSeek = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playbackState.track) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newPosition = Math.floor(playbackState.track.duration * 1000 * percentage); // Convert to milliseconds
    
    // Stop any existing animation first
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Disable CSS transition for instant jump
    setIsTrackChanging(true);
    
    // Immediately update the visual position (teleport!)
    setLocalPosition(newPosition);
    
    try {
      // Convert milliseconds to seconds for API
      await api.post('/api/control/seek', { position: Math.floor(newPosition / 1000) });
      
      // Restart animation from the new position if playing
      if (playbackState.isPlaying) {
        startProgressAnimation(newPosition);
      }
      
      // Re-enable CSS transition after a brief moment
      setTimeout(() => {
        setIsTrackChanging(false);
      }, 50);
      
      // Fetch new state after a short delay to confirm
      setTimeout(() => fetchPlaybackState(true), 500);
    } catch (error) {
      console.error('Seek failed:', error);
      // Revert position on error
      setLocalPosition(playbackState.track?.position ?? 0);
      setIsTrackChanging(false);
    }
  }, [playbackState.track, startProgressAnimation, fetchPlaybackState]);
  // Note: animationFrameId omitted to prevent dependency issues

  return {
    localPosition,
    setLocalPosition,
    animationFrameId: animationFrameRef.current,
    isTrackChanging,
    setIsTrackChanging,
    handleSeek,
    startProgressAnimation
  };
};