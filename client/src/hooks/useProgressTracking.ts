import { useState, useCallback, useRef, useEffect } from 'react';
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
  const [localPosition, setLocalPosition] = useState(0); // Now in SECONDS
  const animationFrameRef = useRef<number | null>(null);
  const animationStartTimeRef = useRef<number>(0);
  const basePositionRef = useRef<number>(0);
  const [isTrackChanging, setIsTrackChanging] = useState(false);
  
  // Store playback state in a ref so animation always has current value
  const playbackStateRef = useRef(playbackState);
  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  // Stop the animation - stable function with no dependencies
  const stopProgressAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []); // Empty deps = stable function

  // Update local position with animation frame - stable function
  const startProgressAnimation = useCallback((startPosition?: number) => {
    // Stop any existing animation first
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // All positions are now in SECONDS
    const basePosition = startPosition !== undefined 
      ? startPosition 
      : playbackStateRef.current.track?.position ?? 0;
    
    // Store base position and start time in refs
    basePositionRef.current = basePosition;
    animationStartTimeRef.current = Date.now();
    
    // Set initial position
    setLocalPosition(basePosition);
    
    const animate = () => {
      // Always use current playback state from ref
      const currentState = playbackStateRef.current;
      if (currentState.isPlaying && currentState.track) {
        const elapsedMs = Date.now() - animationStartTimeRef.current;
        const elapsedSeconds = elapsedMs / 1000; // Convert to seconds
        const newPosition = Math.min(
          basePositionRef.current + elapsedSeconds,
          currentState.track.duration // Both in seconds now
        );
        
        setLocalPosition(newPosition);
        
        // Continue animation only if still playing
        if (currentState.isPlaying) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          animationFrameRef.current = null;
        }
      } else {
        animationFrameRef.current = null;
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
  }, []); // Empty deps = stable function

  // Handle seeking functionality
  const handleSeek = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playbackState.track) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newPosition = playbackState.track.duration * percentage; // Now in seconds
    
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
      // Position is already in seconds for API
      await api.post('/api/control/seek', { position: Math.floor(newPosition) });
      
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
    animationFrameRef, // Expose the ref itself
    isTrackChanging,
    setIsTrackChanging,
    handleSeek,
    startProgressAnimation,
    stopProgressAnimation
  };
};