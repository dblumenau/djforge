# Update PlaylistDiscovery Component with Real-time Progress

## Task Description
Update the PlaylistDiscovery component to use the new `usePlaylistDiscoveryProgress` hook for showing real-time progress instead of the current static loading steps.

## Requirements Analysis
1. **Import new hook and icons**:
   - Add `usePlaylistDiscoveryProgress` from '../../hooks/usePlaylistDiscoveryProgress'
   - Add icons: `Brain`, `Download`, `FileText` from 'lucide-react'

2. **Integrate the hook**:
   - Use session ID from localStorage to connect to WebSocket progress updates
   - Replace static loading with dynamic progress

3. **Replace loading UI**:
   - Remove static `LOADING_STEPS` constant and related state
   - Replace with dynamic progress bar showing percentage
   - Show current step text from hook
   - Display phase-specific animated icons
   - Show item counts when available

4. **Clean up old implementation**:
   - Remove `LOADING_STEPS` constant
   - Remove `loadingStep` state
   - Remove interval logic for step progression

## Scope Assessment
- **File to modify**: `/Users/david/Sites/djforge/client/src/components/dashboard/PlaylistDiscovery.tsx`
- **Complexity**: Medium - involves UI replacement and state management changes
- **Risk level**: Low - well-defined requirements with existing working hook

## Implementation Approach
1. First read the current file to understand the structure
2. Add the new imports
3. Add the hook usage with session ID
4. Replace the loading UI section (lines 304-320 approximately)
5. Remove the old loading-related code (LOADING_STEPS, loadingStep state, interval logic)

## Success Criteria
- ✅ New hook is properly imported and used
- ✅ Progress bar shows real-time percentage
- ✅ Current step text displays from hook
- ✅ Phase-specific icons animate correctly
- ✅ Item counts show when available
- ✅ Old static loading code is removed
- ✅ All other functionality preserved

## Implementation Completed

### Changes Made:
✅ **Added new imports**:
   - Added `Brain`, `Download`, `FileText` icons from 'lucide-react'
   - Added `usePlaylistDiscoveryProgress` hook (corrected to default import)

✅ **Integrated the hook**:
   - Added session ID retrieval from localStorage
   - Added hook usage with session ID

✅ **Replaced loading UI**:
   - Removed static `LOADING_STEPS` constant
   - Removed `loadingStep` state
   - Removed interval logic for step progression  
   - Replaced with dynamic progress bar showing percentage
   - Added current step text from hook
   - Added phase-specific animated icons
   - Added item counts display when available

✅ **Clean up completed**:
   - Removed all old static loading implementation
   - Preserved all other functionality

### Verification Complete
- All requirements implemented exactly as specified
- File successfully updated: `/Users/david/Sites/djforge/client/src/components/dashboard/PlaylistDiscovery.tsx`
- Ready for testing in browser