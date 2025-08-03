import { useState, useCallback } from 'react';
import { PlaybackState } from '../types/playback.types';
import { calculateNextPollTime, trackApiCall } from '../utils/playback';

/**
 * Custom hook for managing playback polling and rate limiting
 * 
 * Handles:
 * - Smart polling intervals based on track state
 * - API call rate limiting protection
 * - Timeout management for scheduled polls
 * 
 * @param localPosition - Current local playback position
 * @returns Object containing rate limit state and polling functions
 */
export const usePlaybackPolling = (localPosition: number) => {
  const [apiCallCount, setApiCallCount] = useState<number[]>([]);
  const [pollTimeoutId, setPollTimeoutId] = useState<number | null>(null);

  // Track API calls for rate limiting
  const trackApiCallWrapper = useCallback(() => {
    setApiCallCount(prevCalls => trackApiCall(prevCalls));
  }, []);

  // Check if we're currently rate limited
  const isRateLimited = apiCallCount.length >= 150;

  // Schedule next poll based on current state
  const scheduleNextPoll = useCallback((delay: number, fetchFunction?: () => Promise<void>) => {
    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId);
    }
    
    const timeoutId = window.setTimeout(() => {
      if (fetchFunction) {
        fetchFunction();
      }
    }, delay);
    
    setPollTimeoutId(timeoutId);
  }, [pollTimeoutId]);

  // Calculate smart poll interval based on playback state
  const getSmartPollInterval = useCallback((playbackState: PlaybackState): number => {
    return calculateNextPollTime(playbackState.track, playbackState.isPlaying, localPosition);
  }, [localPosition]);

  // Cleanup function for timeouts
  const cleanup = useCallback(() => {
    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId);
      setPollTimeoutId(null);
    }
  }, [pollTimeoutId]);

  return {
    apiCallCount,
    isRateLimited,
    scheduleNextPoll,
    getSmartPollInterval,
    trackApiCall: trackApiCallWrapper,
    cleanup
  };
};