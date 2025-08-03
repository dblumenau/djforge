# Planning Document: Implement Playlist Play Button

## Task Overview
Implement a play button for playlist cards in the Spotify Controller application that allows users to directly play playlists from the search results.

## Requirements Analysis

### 1. Backend - New API Endpoint
**File**: `/server/src/routes/direct-action.ts`
- Add POST endpoint `/api/direct-action/playlist`
- Accept `playlistId` and `action` parameters
- Convert to Spotify URI format: `spotify:playlist:{playlistId}`
- Use `SpotifyControl.playPlaylist()` method
- Include error handling for auth/Spotify connection
- Emit WebSocket events (follow existing `/song` pattern)
- Return appropriate responses

### 2. Frontend - PlaylistCard Component
**File**: `/client/src/components/playlist-search/PlaylistCard.tsx`
- Import `Play` icon from lucide-react
- Add loading state for play action
- Add play button to action buttons section
- Create click handler with:
  - Loading state management
  - Authenticated fetch to new endpoint
  - Success/error handling
  - User feedback

### 3. UI Layout Updates
- Reorganize action buttons:
  - Play button (primary, Spotify green, Play icon)
  - View Details button (existing)
  - Open in Spotify button (existing)
- Ensure responsive design and mobile compatibility

## Technical Approach

### Backend Implementation
1. Examine existing `/song` endpoint pattern in direct-action.ts
2. Create similar structure for playlist endpoint
3. Verify SpotifyControl.playPlaylist() method exists and usage
4. Follow existing WebSocket event emission patterns
5. Implement proper error handling and response formats

### Frontend Implementation  
1. Examine current PlaylistCard component structure
2. Check existing button layout and styling patterns
3. Add play button with appropriate styling (Spotify green)
4. Implement loading states to prevent duplicate requests
5. Use authenticatedFetch utility for API calls
6. Follow existing error handling patterns

## Questions for Clarification

1. **SpotifyControl.playPlaylist() Method**: Does this method already exist in the SpotifyControl class? If not, should I implement it?

2. **Action Parameter**: The requirement mentions accepting `action` (play/queue) - should I implement both play and queue functionality, or just play for now?

3. **WebSocket Events**: What specific WebSocket events should be emitted? Should it follow the exact same pattern as the song endpoint?

4. **Error Feedback**: How should errors be displayed to the user? Toast notifications, inline messages, or console logging?

5. **Button Positioning**: Should the play button be the leftmost button, or in a specific position among the three buttons?

## Success Criteria
- [ ] New API endpoint `/api/direct-action/playlist` successfully plays playlists
- [ ] PlaylistCard component has functional play button
- [ ] Button shows loading state during API calls
- [ ] Proper error handling and user feedback
- [ ] Responsive design works on mobile
- [ ] WebSocket events are emitted correctly
- [ ] No duplicate requests possible during loading

## Implementation Plan
1. First examine existing code patterns and SpotifyControl methods
2. Implement backend API endpoint
3. Update PlaylistCard component with play button
4. Test functionality and error handling
5. Verify responsive design and mobile compatibility

## Potential Risks
- SpotifyControl.playPlaylist() method may not exist and need implementation
- WebSocket event patterns may need adjustment for playlists
- Button layout changes may affect existing responsive design
- API authentication and error handling complexity

---

**Next Steps**: Please review this plan and provide answers to the clarification questions before I proceed with implementation.