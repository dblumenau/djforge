import { useState, useRef, useEffect } from 'react';
import { PlaybackState } from '../types/playback.types';

/**
 * Custom hook for managing vinyl rotation animation
 * 
 * Handles:
 * - Smooth rotation animation during playback
 * - Pause/resume functionality with preserved rotation
 * - Cleanup of animation frames
 * 
 * @param playbackState - Current playback state
 * @param previousTrackNameRef - Ref to track name changes
 * @returns Object containing vinyl rotation and pause state
 */
export const useVinylAnimation = (
  playbackState: PlaybackState,
  previousTrackNameRef: React.MutableRefObject<string | null>
) => {
  const [vinylRotation, setVinylRotation] = useState(0);
  const [isVinylPaused, setIsVinylPaused] = useState(false);
  const vinylAnimationRef = useRef<number>();
  const vinylStartTimeRef = useRef<number>(Date.now());

  // Handle vinyl rotation animation
  useEffect(() => {
    // Cancel existing animation
    if (vinylAnimationRef.current) {
      cancelAnimationFrame(vinylAnimationRef.current);
      vinylAnimationRef.current = undefined;
    }

    if (!playbackState.track) {
      setVinylRotation(0);
      setIsVinylPaused(false);
      return;
    }

    // When pausing, capture current rotation
    if (!playbackState.isPlaying && !isVinylPaused) {
      const elapsed = Date.now() - vinylStartTimeRef.current;
      const calculatedRotation = (elapsed / 5000) * 360;  // 5000ms for a nice slow rotation
      setVinylRotation(calculatedRotation % 360);
      setIsVinylPaused(true);
      return;
    }
    
    // When playing (either resuming or starting fresh)
    if (playbackState.isPlaying) {
      if (isVinylPaused) {
        // Resuming: adjust start time to account for current rotation
        const rotationTime = (vinylRotation / 360) * 5000;  // 5000ms for a nice slow rotation
        vinylStartTimeRef.current = Date.now() - rotationTime;
        setIsVinylPaused(false);
      } else if (!playbackState.track?.name || playbackState.track?.name !== previousTrackNameRef.current) {
        // Starting fresh with new track
        vinylStartTimeRef.current = Date.now();
        setVinylRotation(0);
      }

      // Start animation loop
      const animate = () => {
        if (playbackState.isPlaying && playbackState.track) {
          const elapsed = Date.now() - vinylStartTimeRef.current;
          const rotation = (elapsed / 5000) * 360;  // 5000ms for a nice slow rotation
          setVinylRotation(rotation % 360);
          
          vinylAnimationRef.current = requestAnimationFrame(animate);
        }
      };
      
      vinylAnimationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (vinylAnimationRef.current) {
        cancelAnimationFrame(vinylAnimationRef.current);
        vinylAnimationRef.current = undefined;
      }
    };
  }, [playbackState.isPlaying, playbackState.track?.name, isVinylPaused, vinylRotation]);

  return {
    vinylRotation,
    isVinylPaused
  };
};