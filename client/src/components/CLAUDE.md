# Components Directory

This directory contains reusable React components for the Spotify Claude Controller application.

## Component Files

### LandingPage.tsx
- Authentication landing page with Spotify OAuth login
- Displays error messages from failed auth attempts
- Redirects authenticated users to main app

### MainApp.tsx
- Main application UI with command interface
- Integrates all major features:
  - Command input with LLM processing
  - Response history display
  - Model selection dropdown
  - Spotify playback controls
  - Weather display
  - Debug panel (development only)
- Manages command history and processing state

### MusicLoader.tsx
- Animated loading component for music-related operations
- Displays pulsing music note animation
- Used during command processing and API calls

### SpotifyPlayer.tsx
- Web Playback SDK integration
- Shows currently playing track information
- Provides playback controls (play/pause, skip, previous)
- Displays album artwork and track progress

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