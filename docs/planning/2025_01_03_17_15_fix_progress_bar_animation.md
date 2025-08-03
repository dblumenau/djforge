# Fix Progress Bar Animation - Planning Document

**Created**: 2025-01-03 17:15  
**Task**: Fix progress bar animation not starting in PlaybackControls component

## Problem Analysis

The progress bar in the PlaybackControls component is not showing progress because the `startProgressAnimation` function from the `useProgressTracking` hook is never called. The hook provides this function but the PlaybackControls component doesn't use it to start the animation loop when playback begins or tracks change.

## Current State Analysis

### What's Working:
- The `useProgressTracking` hook correctly defines `startProgressAnimation` function
- The animation logic itself works (animation frame loop, position updates)
- Seeking functionality calls `startProgressAnimation` properly
- Progress bar displays the current localPosition value correctly

### What's Broken:
- No animation starts when playback begins (isPlaying becomes true)
- No animation starts when a new track begins playing
- Animation doesn't stop when playback pauses
- No cleanup of animation frames on component unmount

### Root Cause:
The PlaybackControls component destructures `startProgressAnimation` from the hook (line 98) but never calls it in response to playback state changes.

## Requirements

1. **Start Animation on Play**: Call `startProgressAnimation` when `playbackState.isPlaying` becomes true
2. **Start Animation on Track Change**: Call `startProgressAnimation` when a new track starts (reset to position 0)
3. **Stop Animation on Pause**: Cancel animation when `playbackState.isPlaying` becomes false
4. **Cleanup on Unmount**: Ensure animation frames are properly cleaned up
5. **Handle Edge Cases**:
   - Track changes while playing (restart animation from 0)
   - Pause/resume (stop/start animation at current position)
   - Seeking already handled in the hook

## Proposed Implementation

Add a `useEffect` in PlaybackControls.tsx that:

1. **Watches Dependencies**: 
   - `playbackState.isPlaying` - for play/pause state changes
   - `playbackState.track?.id` - for track changes
   - `playbackState.track?.position` - for position updates from server

2. **Logic Flow**:
   ```typescript
   useEffect(() => {
     if (playbackState.isPlaying && playbackState.track) {
       // Start animation from current track position
       startProgressAnimation(playbackState.track.position);
     } else {
       // Stop animation when paused or no track
       if (animationFrameId) {
         cancelAnimationFrame(animationFrameId);
         setAnimationFrameId(null);
       }
     }
   }, [playbackState.isPlaying, playbackState.track?.id, playbackState.track?.position]);
   ```

3. **Cleanup on Unmount**:
   ```typescript
   useEffect(() => {
     return () => {
       if (animationFrameId) {
         cancelAnimationFrame(animationFrameId);
       }
     };
   }, [animationFrameId]);
   ```

## Edge Cases to Handle

1. **Track Change While Playing**: When track ID changes, animation should restart from position 0
2. **Position Updates from Server**: When position changes (e.g., from WebSocket), animation should restart from new position
3. **Rapid State Changes**: Multiple rapid play/pause commands should be handled cleanly
4. **Component Unmount**: Animation frames must be canceled to prevent memory leaks

## Implementation Details

### Dependencies to Use:
- `startProgressAnimation` - function from useProgressTracking hook
- `animationFrameId` - to check if animation is running
- `setAnimationFrameId` - to clear animation frame ID

### State to Monitor:
- `playbackState.isPlaying` - play/pause state
- `playbackState.track?.id` - track identity
- `playbackState.track?.position` - current position from server

### Cleanup Strategy:
- Cancel animation frame before starting new one (already handled in hook)
- Cancel on component unmount
- Cancel when playback stops

## Success Criteria

✅ Progress bar animates smoothly when track is playing  
✅ Animation stops when playback is paused  
✅ Animation restarts from 0 when new track begins  
✅ Animation resumes from correct position when resuming playback  
✅ No memory leaks from uncanceled animation frames  
✅ Seeking still works correctly (already implemented)  
✅ Edge cases handled properly (rapid state changes, unmount, etc.)

## Questions for Clarification

None - the requirements and implementation approach are clear. The problem is well-defined and the solution is straightforward.

## Next Steps

1. Implement the useEffect hooks in PlaybackControls.tsx
2. Test the functionality in the browser
3. Verify edge cases work correctly
4. Ensure no memory leaks or performance issues

## Risk Assessment

**Low Risk** - This is a straightforward fix that:
- Uses existing, tested animation logic from the hook
- Follows React best practices for useEffect
- Doesn't modify the hook itself, only adds proper usage
- Has clear cleanup patterns to prevent memory leaks

The only potential issue is ensuring the dependencies are correct to avoid infinite re-renders, but the proposed dependencies are stable and appropriate.