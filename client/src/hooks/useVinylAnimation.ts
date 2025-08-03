import { useRef, useEffect, useCallback } from 'react';
import { PlaybackState } from '../types/playback.types';

/**
 * Custom hook for managing vinyl rotation animation
 * 
 * Handles:
 * - Smooth rotation animation during playback using CSS transforms
 * - Pause/resume functionality with preserved rotation
 * - Cleanup of animation frames
 * - Hardware acceleration for smooth performance
 * 
 * @param playbackState - Current playback state
 * @param previousTrackNameRef - Ref to track name changes
 * @returns Object containing vinyl rotation control functions
 */
export const useVinylAnimation = (
  playbackState: PlaybackState,
  previousTrackNameRef: React.MutableRefObject<string | null>
) => {
  const vinylElementRef = useRef<HTMLElement>(null);
  const vinylAnimationRef = useRef<number>();
  const vinylStartTimeRef = useRef<number>(Date.now());
  const currentRotationRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);

  // Apply rotation directly to DOM element for better performance
  const applyRotation = useCallback((rotation: number) => {
    if (vinylElementRef.current) {
      // Use hardware-accelerated transform with translateZ(0) for better performance
      vinylElementRef.current.style.transform = `rotate(${rotation}deg) translateZ(0)`;
    }
  }, []);

  // Handle vinyl rotation animation
  useEffect(() => {
    // Cancel existing animation
    if (vinylAnimationRef.current) {
      cancelAnimationFrame(vinylAnimationRef.current);
      vinylAnimationRef.current = undefined;
    }

    if (!playbackState.track) {
      currentRotationRef.current = 0;
      isPausedRef.current = false;
      applyRotation(0);
      return;
    }

    // When pausing, capture current rotation
    if (!playbackState.isPlaying && !isPausedRef.current) {
      const elapsed = Date.now() - vinylStartTimeRef.current;
      const calculatedRotation = (elapsed / 5000) * 360;  // 5000ms for a nice slow rotation
      currentRotationRef.current = calculatedRotation % 360;
      applyRotation(currentRotationRef.current);
      isPausedRef.current = true;
      return;
    }
    
    // When playing (either resuming or starting fresh)
    if (playbackState.isPlaying) {
      if (isPausedRef.current) {
        // Resuming: adjust start time to account for current rotation
        const rotationTime = (currentRotationRef.current / 360) * 5000;  // 5000ms for a nice slow rotation
        vinylStartTimeRef.current = Date.now() - rotationTime;
        isPausedRef.current = false;
      } else if (!playbackState.track?.name || playbackState.track?.name !== previousTrackNameRef.current) {
        // Starting fresh with new track
        vinylStartTimeRef.current = Date.now();
        currentRotationRef.current = 0;
      }

      // Start animation loop with RAF for smooth 60fps animation
      const animate = () => {
        if (playbackState.isPlaying && playbackState.track) {
          const elapsed = Date.now() - vinylStartTimeRef.current;
          const rotation = (elapsed / 5000) * 360;  // 5000ms for a nice slow rotation
          const normalizedRotation = rotation % 360;
          
          currentRotationRef.current = normalizedRotation;
          applyRotation(normalizedRotation);
          
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
  }, [playbackState.isPlaying, playbackState.track?.name, applyRotation]);

  return {
    vinylElementRef, // Ref to attach to the vinyl element
    vinylRotation: currentRotationRef.current, // Current rotation for initial render
    isVinylPaused: isPausedRef.current
  };
};