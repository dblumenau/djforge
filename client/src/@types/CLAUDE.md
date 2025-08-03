# Client TypeScript Definitions

This directory contains TypeScript type definitions and interfaces for the client application.

## Type Files

### playlist-search.ts
- Comprehensive type definitions for playlist search functionality
- Interfaces:
  - `PlaylistImage` - Spotify playlist image structure
  - `PlaylistOwner` - Playlist owner/user information
  - `Playlist` - Basic playlist from search results
  - `SearchResults` - Complete search response
  - `TrackArtist` - Artist information for tracks
  - `TrackAlbum` - Album information for tracks
  - `Track` - Complete track information
  - `PlaylistTrack` - Track with playlist-specific metadata
  - `PlaylistDetails` - Full playlist with all tracks
  - `AnalyticsData` - Computed playlist analytics

## Type Organization

Types are organized by feature area to maintain clear separation of concerns:
- **Playlist Search**: All types related to searching and viewing playlists
- **Playback** (if added): Types for playback controls and state
- **Dashboard** (if added): Types for data visualization
- **Auth** (if added): Authentication and user types

## Usage Guidelines

### Importing Types
```typescript
// Use type imports for better tree-shaking
import type { PlaylistDetails, AnalyticsData } from '../@types/playlist-search';
```

### Type vs Interface
- Use `interface` for object shapes that might be extended
- Use `type` for unions, intersections, and aliases
- Prefer `interface` for public API contracts

### Naming Conventions
- Use PascalCase for type and interface names
- Suffix with descriptive terms (e.g., `Response`, `Request`, `State`)
- Group related types with common prefixes

## Benefits of Centralized Types

1. **Single Source of Truth**: All components use the same type definitions
2. **Type Safety**: Compile-time checking prevents runtime errors
3. **IntelliSense**: Better IDE support and autocomplete
4. **Maintainability**: Changes in one place update all usages
5. **Documentation**: Types serve as API documentation

## Adding New Types

When adding new type definitions:
1. Create a new file for each feature area
2. Export all types/interfaces explicitly
3. Add JSDoc comments for complex types
4. Update this documentation
5. Consider backward compatibility

## Type Validation

Types in this directory should align with:
- Backend API responses
- Spotify Web API documentation
- Database schemas (where applicable)
- Component prop requirements

## Future Enhancements

- Add runtime type validation with libraries like Zod
- Generate types from OpenAPI/Swagger specs
- Add type guards for runtime checking
- Create shared types package for client/server