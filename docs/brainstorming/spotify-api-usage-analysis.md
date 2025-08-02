# Spotify API Usage Analysis - DJForge/Spotify Claude Controller

## Overview

This document provides a comprehensive analysis of all Spotify Web API calls made by the Spotify Claude Controller application. This analysis is crucial for designing a new authentication and token refresh system from scratch.

## Authentication Requirements

The application requires Spotify OAuth 2.0 authentication with the following scopes:
- `streaming` - Web Playback SDK
- `user-read-email`, `user-read-private` - User profile access
- `user-read-playback-state`, `user-modify-playback-state` - Playback control
- `user-read-currently-playing` - Current track info
- `playlist-read-private`, `playlist-read-collaborative` - Read playlists
- `playlist-modify-public`, `playlist-modify-private` - Modify playlists
- `user-library-read`, `user-library-modify` - Library management
- `user-read-recently-played` - Recent history
- `user-top-read` - Top artists/tracks

## Spotify API Endpoints Used

### Core API Class Location
All Spotify API calls are centralized through `/server/src/spotify/api.ts` - the `SpotifyWebAPI` class.

### 1. Search & Discovery APIs

#### `/v1/search`
- **Purpose**: Search for tracks, playlists, albums, artists
- **Frequency**: Very High - Called on every natural language command
- **Caching**: No caching (real-time search needed)
- **Critical**: Yes - Core functionality

#### `/v1/recommendations`
- **Purpose**: Get track recommendations based on seed track
- **Frequency**: Medium - On-demand when user asks for recommendations
- **Caching**: No caching (personalized results)
- **Critical**: No - Enhancement feature

### 2. User Profile & Data APIs

#### `/v1/me`
- **Purpose**: Get current user profile
- **Frequency**: Low - On login and periodic checks
- **Caching**: 2 hours
- **Critical**: Yes - Required for user identification

#### `/v1/me/top/artists`
- **Purpose**: Get user's top artists (short_term, medium_term, long_term)
- **Frequency**: Medium - Dashboard and taste profile generation
- **Caching**: 1 hour
- **Critical**: No - Used for personalization

#### `/v1/me/top/tracks`
- **Purpose**: Get user's top tracks (short_term, medium_term, long_term)
- **Frequency**: Medium - Dashboard and taste profile generation
- **Caching**: 1 hour
- **Critical**: No - Used for personalization

### 3. Playback Control APIs

#### `/v1/me/player/devices`
- **Purpose**: Get available Spotify devices
- **Frequency**: Very High - Before most playback commands
- **Caching**: No caching (real-time device state)
- **Critical**: Yes - Required for playback

#### `/v1/me/player/play`
- **Purpose**: Start/resume playback, play specific tracks/playlists
- **Frequency**: High - Core playback function
- **Caching**: No caching
- **Critical**: Yes - Core functionality

#### `/v1/me/player/pause`
- **Purpose**: Pause playback
- **Frequency**: High - Basic control
- **Caching**: No caching
- **Critical**: Yes - Core functionality

#### `/v1/me/player/next`
- **Purpose**: Skip to next track
- **Frequency**: High - Basic control
- **Caching**: No caching
- **Critical**: Yes - Core functionality

#### `/v1/me/player/previous`
- **Purpose**: Go to previous track
- **Frequency**: Medium - Basic control
- **Caching**: No caching
- **Critical**: Yes - Core functionality

#### `/v1/me/player/volume`
- **Purpose**: Set playback volume
- **Frequency**: Low - Occasional use
- **Caching**: No caching
- **Critical**: No - Enhancement feature

#### `/v1/me/player` (GET)
- **Purpose**: Get current playback state
- **Frequency**: Very High - Polling for UI updates
- **Caching**: No caching (real-time state)
- **Critical**: Yes - UI depends on this

#### `/v1/me/player/shuffle`
- **Purpose**: Set shuffle state
- **Frequency**: Low - Occasional use
- **Caching**: No caching
- **Critical**: No - Enhancement feature

#### `/v1/me/player/repeat`
- **Purpose**: Set repeat mode (off/track/context)
- **Frequency**: Low - Occasional use
- **Caching**: No caching
- **Critical**: No - Enhancement feature

#### `/v1/me/player/seek`
- **Purpose**: Seek to position in track
- **Frequency**: Low - Occasional use
- **Caching**: No caching
- **Critical**: No - Enhancement feature

#### `/v1/me/player` (PUT)
- **Purpose**: Transfer playback to specific device
- **Frequency**: Medium - Device switching
- **Caching**: No caching
- **Critical**: Yes - Multi-device support

### 4. Queue Management APIs

#### `/v1/me/player/queue` (POST)
- **Purpose**: Add track to playback queue
- **Frequency**: High - Common user action
- **Caching**: No caching
- **Critical**: Yes - Core functionality

#### `/v1/me/player/queue` (GET)
- **Purpose**: Get current queue
- **Frequency**: Medium - UI updates
- **Caching**: No caching (dynamic queue)
- **Critical**: No - UI enhancement

### 5. Library Management APIs

#### `/v1/me/tracks` (GET)
- **Purpose**: Get saved/liked tracks (paginated)
- **Frequency**: Low - Library browsing
- **Caching**: Short-term cache possible
- **Critical**: No - Library feature

#### `/v1/me/tracks` (PUT)
- **Purpose**: Save tracks to library
- **Frequency**: Low - User action
- **Caching**: No caching
- **Critical**: No - Library feature

#### `/v1/me/tracks` (DELETE)
- **Purpose**: Remove tracks from library
- **Frequency**: Low - User action
- **Caching**: No caching
- **Critical**: No - Library feature

#### `/v1/me/tracks/contains`
- **Purpose**: Check if tracks are saved
- **Frequency**: Medium - UI state updates
- **Caching**: Short-term cache possible
- **Critical**: No - UI enhancement

#### `/v1/me/albums` (GET)
- **Purpose**: Get saved albums (paginated)
- **Frequency**: Low - Library browsing
- **Caching**: Short-term cache possible
- **Critical**: No - Library feature

### 6. Playlist APIs

#### `/v1/me/playlists`
- **Purpose**: Get user's playlists
- **Frequency**: Medium - Playlist features
- **Caching**: 1 hour
- **Critical**: No - Playlist features

#### `/v1/playlists/{id}/tracks`
- **Purpose**: Get tracks from specific playlist
- **Frequency**: Medium - When playing playlists
- **Caching**: Short-term cache possible
- **Critical**: No - Playlist features

#### `/v1/users/{user_id}/playlists` (POST)
- **Purpose**: Create new playlist
- **Frequency**: Very Low - Occasional feature
- **Caching**: No caching
- **Critical**: No - Advanced feature

#### `/v1/playlists/{id}/tracks` (POST)
- **Purpose**: Add tracks to playlist
- **Frequency**: Low - User action
- **Caching**: No caching
- **Critical**: No - Advanced feature

### 7. History APIs

#### `/v1/me/player/recently-played`
- **Purpose**: Get recently played tracks
- **Frequency**: Medium - Dashboard feature
- **Caching**: 30 minutes
- **Critical**: No - Analytics feature

## API Call Patterns

### High-Frequency Calls (Need efficient handling)
1. Device checking before commands
2. Current playback state polling
3. Search on every command
4. Queue operations

### Cached Data (Reduces API load)
1. User profile (2hr)
2. Top artists/tracks (1hr)
3. Playlists (1hr)
4. Recently played (30min)
5. Taste profiles (1hr)

### Real-Time Requirements (No caching)
1. All playback controls
2. Device states
3. Search results
4. Queue state

## Authentication Touch Points

### Server-Side
1. **Middleware**: `ensureValidToken` on all protected routes
2. **API Class**: Token passed to SpotifyWebAPI constructor
3. **Token Refresh**: Axios interceptor handles 401 errors

### Client-Side
1. **JWT Storage**: localStorage for persistence
2. **API Wrapper**: Attaches JWT to all requests
3. **Refresh Detection**: Checks `X-Token-Refreshed` header

## Current Pain Points

1. **Token Rotation**: Spotify returns new refresh_token on refresh
2. **JWT Desync**: Client JWT contains old refresh_token after server refresh
3. **Concurrent Requests**: Multiple endpoints refresh simultaneously
4. **Race Conditions**: Stampede effect on token refresh

## Requirements for New Auth System

### Must Have
1. Handle Spotify's refresh token rotation
2. Keep client and server tokens synchronized
3. Handle concurrent API requests gracefully
4. Support high-frequency polling endpoints
5. Work with both REST API and Web Playback SDK

### Should Have
1. Minimize authentication interruptions
2. Support multiple devices/sessions
3. Provide clear error messages
4. Handle offline/recovery scenarios
5. Support token refresh preemption

### Nice to Have
1. Token refresh prediction
2. Request queuing during refresh
3. Metrics and monitoring
4. Graceful degradation
5. Multi-user session support

## Conclusion

The application makes extensive use of Spotify's Web API with a mix of high-frequency real-time calls and cacheable user data. The new authentication system must handle token rotation seamlessly while supporting concurrent requests and maintaining synchronization between client and server states.