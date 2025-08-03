# Playback Components

This directory contains the refactored components from the large PlaybackControls.tsx file.

## Structure

The original 1422-line PlaybackControls.tsx is being broken down into smaller, manageable components:

### Phase 1 (Complete)
- ✅ Created directory structure
- ✅ Extracted utility functions to `/src/utils/playback.ts`
- ✅ Extracted types to `/src/types/playback.types.ts`

### Planned Components
- `PlaybackHeader.tsx` - Header with status indicators and controls
- `AlbumArt.tsx` - Album art with vinyl rotation animation
- `TrackInfo.tsx` - Track name, artist, album, and metadata
- `ProgressBar.tsx` - Seek bar with time display
- `MainControls.tsx` - Play/pause/skip/shuffle/repeat buttons
- `VolumeControl.tsx` - Volume slider
- `SecondaryControls.tsx` - Heart/save, queue, clear queue buttons
- `FullscreenView.tsx` - Fullscreen immersive playback mode
- `MobileControls.tsx` - Mobile-optimized control layout

## Utility Functions

The following functions have been extracted to `/src/utils/playback.ts`:

- `formatTime(milliseconds: number): string` - Format time as MM:SS
- `calculateNextPollTime(track, isPlaying, localPosition): number` - Smart polling intervals
- `trackApiCall(apiCallCount: number[]): number[]` - Rate limiting tracker

## Types

TypeScript interfaces moved to `/src/types/playback.types.ts`:

- `PlaybackState` - Main playback state interface
- `PlaybackControlsProps` - Props for the main component
- `ViewMode` - View modes: 'minimized' | 'normal' | 'fullscreen'