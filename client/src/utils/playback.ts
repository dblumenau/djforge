/**
 * Utility functions for playback controls
 */

/**
 * Format time in milliseconds as MM:SS
 */
export const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Calculate the next poll time based on track state and playback status
 */
export const calculateNextPollTime = (track: any, isPlaying: boolean, localPosition: number): number => {
  if (!track || !isPlaying) {
    // If nothing is playing, poll less frequently
    return 60000; // 1 minute
  }
  
  // track.duration is in seconds, localPosition is in milliseconds
  const durationMs = (track.duration || 0) * 1000;
  const timeRemaining = durationMs - localPosition;
  
  if (timeRemaining <= 5000) {
    // Track is about to end, poll soon to catch the transition
    return Math.max(timeRemaining - 1000, 500); // 1s before end, min 500ms
  } else if (timeRemaining <= 30000) {
    // Last 30 seconds of track
    return 5000; // Poll every 5 seconds
  } else if (timeRemaining <= 60000) {
    // Last minute of track
    return 10000; // Poll every 10 seconds
  } else {
    // Normal playback
    return 30000; // Poll every 30 seconds
  }
};

/**
 * Track API calls for rate limiting - pure function version
 * Returns the updated array of recent API call timestamps
 */
export const trackApiCall = (apiCallCount: number[]): number[] => {
  const now = Date.now();
  // Keep only calls from last 30 seconds
  const recentCalls = apiCallCount.filter(time => now - time < 30000);
  recentCalls.push(now);
  
  // Log if approaching rate limit
  if (recentCalls.length > 80) {
    console.warn('[PlaybackControls] Approaching rate limit:', recentCalls.length, 'calls in 30s');
  }
  
  return recentCalls;
};