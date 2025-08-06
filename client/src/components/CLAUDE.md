# Components Directory

This directory contains reusable React components for the Spotify Claude Controller application.

## Component Files

### HeaderNav.tsx
- Fixed header navigation component
- Desktop features:
  - Logo and app title
  - Weather display (center)
  - Model and device selectors
  - Navigation buttons (Dashboard, Feedback, Logs, Logout)
  - Dev tools (token expiry simulation)
- Mobile: Hamburger menu button

### MobileMenu.tsx
- Slide-out navigation drawer for mobile devices
- Features:
  - Weather display
  - Model and device selectors
  - Full playback controls
  - Navigation links
  - Logout button
- Backdrop overlay and keyboard navigation support

### ChatMessage.tsx
- Individual message component for chat interface
- Displays:
  - User commands with timestamp
  - AI responses with confidence indicators
  - Song alternatives with play/queue actions
  - Clarification options for ambiguous requests
  - Feedback buttons for AI discovery tracks
  - Loading states for feedback actions
- Supports rich formatting with bold text

### ChatInput.tsx
- Fixed bottom input component
- Features:
  - Full-width text input with rounded styling
  - Examples button for command suggestions
  - Send button with disabled state during processing
  - Floating MusicLoader animation when processing
- Auto-focus for improved UX

### LandingPage.tsx
- Authentication landing page with Spotify OAuth login
- Displays error messages from failed auth attempts
- Redirects authenticated users to main app

### MainApp.tsx
- Main application with modern chat-style interface
- Layout structure:
  - Fixed header navigation bar at top
  - Scrollable chat message area in center
  - Fixed input area at bottom
- Integrates all major features:
  - Natural language command processing
  - Chronological message history with ChatMessage components
  - Real-time playback state updates
  - Responsive design with mobile menu
  - Toast notifications for user feedback
- State management:
  - Command history with Redis persistence
  - Authentication state handling
  - Loading states with skeleton components

### MusicLoader.tsx
- Animated loading component for music-related operations
- Displays pulsing music note animation
- Used during command processing and API calls

### PlaybackControls.tsx
- Main orchestrator component for playback functionality
- Integrates multiple subcomponents from `playback/` directory
- State management for playback, volume, and view modes
- WebSocket integration for real-time updates
- **Enhanced View Modes**: minimized, normal, fullscreen with improved mobile support
- **Safari Compatibility**: Fixed progress bar seeking and playback state synchronization
- Custom hooks integration:
  - `useTrackLibrary` - Save/unsave track functionality
  - `useMusicWebSocket` - Real-time WebSocket events
  - `useVinylAnimation` - Vinyl rotation animations
  - `useProgressTracking` - Local progress state with Safari fixes
  - `usePlaybackPolling` - Smart polling intervals with rate limiting
- Renders different layouts based on view mode
- **Device Selector Integration**: Enhanced Spotify Connect with fixed compact mode JSX wrapping

### WeatherDisplay.tsx
- Fetches and displays weather information
- Shows temperature and conditions
- Auto-refreshes every 15 minutes
- Uses DMI weather API

### DebugPanel.tsx
- Development-only debugging tools
- Displays session information
- Shows authentication state
- Model selection details

### LoadingEllipsis.tsx
- Simple animated ellipsis for loading states
- Used in buttons and inline text

### NotFound.tsx
- 404 page component
- Displayed for invalid routes
- Provides link back to main app

### playback/ (Directory)
- Refactored subcomponents from PlaybackControls
- Modular playback interface components
- **Recent Enhancements**: Safari compatibility fixes and fullscreen improvements
- Components include:
  - `ControlButtons.tsx` - Play/pause, skip, previous, shuffle, repeat controls
  - `SecondaryControls.tsx` - Save/unsave, queue, clear queue buttons
  - `ProgressBar.tsx` - **Enhanced**: Fixed Safari seeking behavior and smooth progress tracking
  - `TrackInfo.tsx` - Track name, artist, album display
  - `VinylDisplay.tsx` - Animated vinyl record visualization
  - `MinimizedView.tsx` - Compact playback controls layout
  - `FullscreenView.tsx` - **Enhanced**: Immersive fullscreen with ambient album art glow and optimized mobile layout
- See `playback/CLAUDE.md` for implementation details

### playlist-search/ (Directory)
- Components for playlist search functionality
- Modular UI components for search results and details
- Components include:
  - `PlaylistCard.tsx` - Individual playlist result card
  - `PlaylistDetailsModal.tsx` - Full playlist details modal with tabs
  - `SearchGuide.tsx` - Comprehensive search syntax guide
  - `PlaylistModalTabs/` - Tab components for playlist details
- See `playlist-search/CLAUDE.md` for details

### dashboard/ (Directory)
- Contains specialized components for Dashboard page
- Data visualization components
- Chart components for listening insights
- See `dashboard/CLAUDE.md` for details

### skeletons/ (Directory)
- Comprehensive skeleton loading components for zero layout shift
- Motion-safe animations respecting accessibility preferences
- Configurable components matching exact content dimensions
- Components include:
  - `ProfileSkeleton.tsx` - User profile card loading state
  - `StatCardSkeleton.tsx` - Statistics card loading state
  - `TrackListSkeleton.tsx` - Track list loading state (configurable count)
  - `AlbumGridSkeleton.tsx` - Album/artist grid loading state (responsive)
  - `TimelineSkeleton.tsx` - Recently played timeline loading state
  - `ChartSkeleton.tsx` - Data visualization loading state
  - `CommandHistorySkeleton.tsx` - Command history loading state

## Component Patterns

### State Management
- Components use React hooks (useState, useEffect)
- Complex state managed in parent components
- Props used for component communication

### Error Handling
- Components display user-friendly error messages
- Network errors handled gracefully
- **Skeleton Loading States**: Immediate visual feedback with zero layout shift
- Progressive content replacement without visual disruption
- Graceful fallback to empty states when no data available

### Styling
- Tailwind CSS v4 utility classes
- Dark theme with Spotify green accents
- Responsive design patterns

### Authentication
- Components check JWT token validity
- Redirect to landing page if not authenticated
- Use `useSpotifyAuth` hook for auth state

## Adding New Components

1. Create component file with TypeScript (.tsx)
2. Use functional components with hooks
3. Add proper TypeScript types for props
4. Follow existing styling patterns
5. Handle loading and error states
6. Add to appropriate parent component
7. Update this documentation