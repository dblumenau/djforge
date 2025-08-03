# Playback Components

This directory contains the refactored playback control components, extracted from the monolithic PlaybackControls.tsx file for better maintainability and modularity.

## Component Architecture

The playback system is composed of modular components that work together to provide a comprehensive music control interface with three view modes: minimized, normal, and fullscreen.

## Components

### ControlButtons.tsx
- Primary playback control buttons
- Features:
  - Play/pause toggle with loading state
  - Previous track button
  - Next track button  
  - Shuffle toggle (off/on states)
  - Repeat toggle (off/context/track states)
- Props:
  - `playbackState` - Current playback state
  - `loading` - Loading state for async operations
  - `onPlayPause` - Play/pause handler
  - `onPrevious` - Previous track handler
  - `onNext` - Next track handler
  - `onShuffle` - Shuffle toggle handler
  - `onRepeat` - Repeat cycle handler

### SecondaryControls.tsx
- Additional control buttons for library and queue management
- Features:
  - Save/unsave track button with loading state
  - Queue view toggle button
  - Clear queue button with confirmation
- Props:
  - `savedStatus` - Track saved state
  - `libraryLoading` - Loading state for library operations
  - `onToggleSave` - Save/unsave handler
  - `onShowQueue` - Queue visibility toggle
  - `onClearQueue` - Queue clear handler

### ProgressBar.tsx
- Track progress display and seek functionality
- Features:
  - Visual progress bar with smooth animations
  - Click-to-seek interaction
  - Current time and duration display
  - Handles track changes without visual jumps
- Props:
  - `localPosition` - Current playback position (ms)
  - `duration` - Track duration (ms)
  - `isTrackChanging` - Track change state for animation reset
  - `onSeek` - Seek position handler

### TrackInfo.tsx
- Track metadata display component
- Features:
  - Track name with truncation
  - Artist name(s) display
  - Album name display
  - Responsive text sizing
- Props:
  - `track` - Current track object with metadata
  - `size` - Display size variant ('small' | 'normal' | 'large')

### VinylDisplay.tsx
- Animated vinyl record visualization
- Features:
  - Realistic vinyl rotation animation
  - Album art integration in center
  - Smooth rotation based on playback state
  - Track change detection for animation reset
- Props:
  - `albumArt` - Album artwork URL
  - `isPlaying` - Playback state for rotation
  - `vinylRotation` - Current rotation angle
  - `size` - Display size variant

### MinimizedView.tsx
- Compact horizontal playback bar layout
- Features:
  - Collapsible design with expand/minimize toggle
  - Shows current track info when expanded
  - Minimal controls when collapsed
  - Integrated progress bar
- Props:
  - All props from main PlaybackControls passed through
  - `isMinimized` - Collapsed state
  - `onToggleMinimize` - Minimize toggle handler

### FullscreenView.tsx
- Immersive fullscreen playback experience
- Features:
  - Large vinyl visualization with rotation
  - Full track information display
  - Complete control set with volume
  - Keyboard shortcut support (Space, Arrow keys)
  - Exit fullscreen button
- Props:
  - All playback state and control props
  - `onExitFullscreen` - Exit handler
  - WebSocket integration for real-time updates

## State Management

The parent `PlaybackControls.tsx` component manages:
- Playback state (track, playing, shuffle, repeat)
- Volume control
- View mode switching
- WebSocket connections
- API polling strategies

Child components receive props and callbacks, maintaining a unidirectional data flow.

## Custom Hooks Used

- `useTrackLibrary` - Manages track save/unsave state
- `useMusicWebSocket` - WebSocket for real-time updates  
- `useVinylAnimation` - Vinyl rotation calculations
- `useProgressTracking` - Local progress state management
- `usePlaybackPolling` - Smart polling interval logic

## Polling Strategy

The system uses intelligent polling to minimize API calls:
- **60s intervals** - When nothing is playing
- **30s intervals** - During normal playback
- **10s intervals** - In last 30s of track
- **2s intervals** - Just before track ends
- **Immediate** - After user actions

## View Modes

1. **Minimized**: Horizontal bar at bottom of screen
2. **Normal**: Full controls with medium-sized elements
3. **Fullscreen**: Immersive experience with large visuals

## WebSocket Events

Real-time updates via Socket.IO:
- Track changes
- Playback state changes
- Volume updates
- User action broadcasts

## Performance Optimizations

- Local progress tracking with requestAnimationFrame
- Debounced API calls
- Memoized components where appropriate
- Efficient re-render prevention
- Smart polling intervals to avoid rate limits

## Future Enhancements

- Lyrics display integration
- Queue visualization in fullscreen mode
- Gesture controls for mobile
- Visualizer animations
- Playlist context display