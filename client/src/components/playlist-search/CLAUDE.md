# Playlist Search Components

This directory contains the modular components for the playlist search functionality, providing a comprehensive interface for searching and exploring Spotify playlists.

## Component Architecture

The playlist search system is built with reusable components that handle search results display, detailed playlist exploration, and user guidance.

## Components

### PlaylistCard.tsx
- Individual playlist result card component
- Features:
  - Playlist cover image with fallback
  - Playlist name and owner information
  - Track count display
  - Description with truncation (140 characters)
  - Click handler for detailed view
  - Responsive grid layout support
- Props:
  - `playlist` - Playlist object from search results
  - `onClick` - Handler to open details modal
  - `truncateDescription` - Utility function for text truncation

### PlaylistDetailsModal.tsx
- Full-featured modal for playlist exploration
- Features:
  - Multi-tab interface (Overview, Tracks, Analytics, JSON)
  - Portal rendering for proper z-index handling
  - Responsive design with mobile optimization
  - Keyboard navigation support (Esc to close)
  - Loading states for async data fetching
- Props:
  - `showModal` - Modal visibility state
  - `onClose` - Close handler
  - `selectedPlaylist` - Detailed playlist data
  - `loadingDetails` - Loading state
  - `modalTab` - Current active tab
  - `onTabChange` - Tab switch handler
  - Various utility functions for data formatting

### SearchGuide.tsx
- Comprehensive search syntax guide
- Features:
  - Search syntax examples and tips
  - Clickable example queries
  - Search operators explanation
  - Playlist filtering guidance
  - Collapsible sections for space efficiency
- Props:
  - `onExampleClick` - Handler for example query selection
  - `performSearch` - Search execution function

### PlaylistModalTabs/ (Directory)

#### OverviewTab.tsx
- Playlist overview information
- Features:
  - Playlist metadata display
  - Cover image with high resolution
  - Owner information with Spotify link
  - Description and track count
  - Public/private status
  - Follower count (if available)
  - Open in Spotify button
- Props:
  - `playlist` - Complete playlist details
  - `formatDate` - Date formatting utility

#### TracksTab.tsx
- Track listing with playback controls
- Features:
  - Complete track list with numbering
  - Track name, artist, album display
  - Duration for each track
  - Added date and added by information
  - Play/Queue buttons for each track
  - Pagination for large playlists
  - Copy track/artist/album names
- Props:
  - `playlist` - Playlist with tracks array
  - `onCopyItem` - Copy to clipboard handler
  - `copiedItem` - Currently copied item indicator
  - `formatDuration` - Duration formatting utility

#### AnalyticsTab.tsx
- Playlist analytics and insights
- Features:
  - Total duration calculation
  - Average track duration
  - Track popularity distribution
  - Artist frequency analysis
  - Genre distribution (if available)
  - Decade distribution
  - Explicit content percentage
  - Most frequent artists chart
- Props:
  - `analytics` - Computed analytics data
  - `formatDuration` - Duration formatting utility

#### JsonTab.tsx
- Raw JSON data viewer
- Features:
  - Syntax highlighted JSON display
  - Copy to clipboard functionality
  - Collapsible sections
  - Search within JSON (browser native)
  - Full playlist data structure
- Props:
  - `playlist` - Complete playlist object
  - `showJson` - JSON visibility toggle
  - `onToggleJson` - Toggle handler

## Type Definitions

All TypeScript interfaces are defined in `/client/src/@types/playlist-search.ts`:
- `PlaylistImage` - Spotify image object
- `PlaylistOwner` - Playlist owner information
- `Playlist` - Basic playlist from search
- `SearchResults` - Search response structure
- `Track` - Complete track information
- `PlaylistTrack` - Track with playlist metadata
- `PlaylistDetails` - Full playlist with tracks
- `AnalyticsData` - Computed analytics

## API Integration

### Search Endpoint
- `GET /api/playlist-search?q={query}`
- Returns paginated playlist results
- Supports Spotify search operators

### Playlist Details Endpoint
- `GET /api/playlist-search/{playlistId}`
- Returns complete playlist with tracks
- Includes all metadata and track information

## State Management

The parent `PlaylistSearch.tsx` page manages:
- Search query and debouncing
- Search results state
- Modal visibility and selected playlist
- Loading states for search and details
- Tab navigation state
- Copy to clipboard functionality

## Features

### Search Capabilities
- Real-time search with debouncing (500ms)
- Support for Spotify search operators
- Error handling with user feedback
- Loading states during search

### Playlist Exploration
- Detailed playlist information
- Track-by-track exploration
- Analytics and insights
- Raw data access for power users

### User Interactions
- Click to view playlist details
- Copy track/artist/album names
- Play or queue tracks directly
- Open playlists in Spotify

## Performance Optimizations

- Debounced search to reduce API calls
- Lazy loading of playlist details
- Memoized analytics calculations
- Virtual scrolling for large track lists (planned)
- Image lazy loading with fallbacks

## Accessibility

- Keyboard navigation support
- ARIA labels for screen readers
- Focus management in modals
- Semantic HTML structure
- Color contrast compliance

## Future Enhancements

- Playlist comparison tools
- Advanced filtering options
- Playlist export functionality
- Collaborative playlist features
- Playlist recommendation engine
- Track deduplication tools