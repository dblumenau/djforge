# Playlist Search Types

This directory contains shared TypeScript interfaces and types for the playlist search functionality.

## Files

- `playlist-search.ts` - Contains all interfaces and types used by the playlist search components

## Types Defined

- `PlaylistImage` - Spotify playlist image data
- `PlaylistOwner` - Spotify user/owner information
- `Playlist` - Basic playlist information from search results
- `SearchResults` - Complete search response structure
- `TrackArtist` - Artist information for tracks
- `TrackAlbum` - Album information for tracks  
- `Track` - Complete track information
- `PlaylistTrack` - Track with playlist-specific metadata (added date, added by, etc.)
- `PlaylistDetails` - Complete playlist with tracks and metadata
- `AnalyticsData` - Computed analytics data for playlists

## Usage

Import types using:

```typescript
import type { PlaylistDetails, AnalyticsData } from '../@types/playlist-search';
```

## Benefits

- **Type Safety**: Ensures consistency across components
- **DRY**: Eliminates duplicate interface definitions
- **Maintainability**: Single source of truth for types
- **IntelliSense**: Better IDE support and autocomplete