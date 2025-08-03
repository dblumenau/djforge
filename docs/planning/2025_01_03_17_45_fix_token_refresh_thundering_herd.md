# Fix Token Refresh Thundering Herd Problem

## Task Description
Fix a critical token refresh issue where multiple components simultaneously attempt to refresh Spotify OAuth tokens, causing Spotify to revoke refresh tokens as a security measure.

## Problem Analysis
- Multiple React components detect token expiry simultaneously
- Each component triggers its own token refresh request
- Spotify receives multiple refresh attempts with the same token
- Spotify revokes the refresh token as a security measure (anti-replay protection)
- Users get logged out and must re-authenticate

## Current State Assessment
Need to examine:
1. `client/src/services/auth.service.ts` - Current refresh mechanism
2. `client/src/services/spotify-client.ts` - HTTP client with 401 handling
3. How components currently handle token refresh

## Required Fixes

### 1. Client-Side Token Refresh Lock (`auth.service.ts`)
- **Problem**: Current `refreshPromise` mechanism insufficient
- **Solution**: Implement robust global lock that ensures single refresh across ALL components
- **Requirements**:
  - Share refresh promise across all callers
  - Wait for in-progress refresh instead of creating new ones
  - Proper error handling that doesn't immediately clear promise on failure

### 2. Request Queue (`spotify-client.ts`)
- **Problem**: 401 responses immediately trigger new refresh attempts
- **Solution**: Queue requests during refresh, process after completion
- **Requirements**:
  - Queue failed requests when 401 received
  - Wait for any in-progress refresh to complete
  - Process queued requests only after refresh completes
  - Prevent multiple 401s from triggering multiple refreshes

### 3. Refresh Debouncing
- **Problem**: Multiple components detect expiry within milliseconds
- **Solution**: Debounce refresh requests within 100ms window
- **Requirements**:
  - Batch refresh requests within 100ms
  - Share single refresh promise across batched requests
  - Only trigger one actual refresh per batch

### 4. Improved Error Handling
- **Problem**: Session destroyed on first "Refresh token revoked" error
- **Solution**: Implement retry logic with backoff
- **Requirements**:
  - Don't destroy session on first revoked token error
  - Exponential backoff for temporary failures
  - Only destroy session after multiple permanent failures

## Implementation Approach
1. Examine current implementation
2. Implement global refresh lock in auth.service.ts
3. Add request queueing to spotify-client.ts
4. Add debouncing mechanism
5. Improve error handling and retry logic
6. Test with multiple simultaneous requests

## Success Criteria
- Multiple simultaneous 401 errors trigger only ONE refresh attempt
- Queued requests wait for refresh completion before retrying
- No more "refresh token revoked" errors from thundering herd
- Backward compatibility maintained
- Clear documentation of locking mechanism

## Constraints
- Server code already has proper locking - don't modify
- Focus ONLY on client-side fixes
- Maintain backward compatibility
- Don't break existing authentication flows

## DETAILED IMPLEMENTATION PLAN

### Phase 1: Fix AuthService Global Lock (`auth.service.ts`)

**Current Problem**: `refreshPromise` is cleared in `finally` block, preventing proper sharing
**Solution**: Implement robust global refresh lock with proper cleanup

**Changes**:
- Add `refreshInProgress` boolean flag
- Add `refreshDebounceTimer` for 100ms debouncing
- Share refresh promise across ALL callers until completion
- Only clear promise after successful completion OR permanent failure
- Add retry logic with exponential backoff

### Phase 2: Add Request Queue (`spotify-client.ts`)

**Current Problem**: 401 immediately triggers new refresh attempt
**Solution**: Queue requests during refresh, process after completion

**Changes**:
- Add `requestQueue` array to store failed requests
- Add `isRefreshInProgress` flag
- When 401 occurs, queue request instead of immediate retry
- Process all queued requests after refresh completes
- Handle both success and failure scenarios for queued requests

### Phase 3: Update Other Services

**Services to Update**:
- `webPlayer.service.ts`: Lines 148, 155, 433 (getAccessToken calls)
- `spotifyWebApi.service.ts`: All direct Spotify API calls

**Changes**:
- Ensure all services use the same refresh-aware pattern
- No direct token refresh logic in individual services
- Let AuthService handle all refresh coordination

### Phase 4: Enhanced Error Handling

**Current Problem**: Session destroyed on first "refresh token revoked"
**Solution**: Implement graduated error handling

**Changes**:
- Don't destroy session on first revoked token error
- Add retry attempts with exponential backoff (1s, 2s, 4s)
- Only destroy session after 3 consecutive permanent failures
- Distinguish between temporary and permanent failures

## Success Criteria Verification
- ✅ Multiple simultaneous 401s trigger only ONE refresh
- ✅ Queued requests wait for refresh completion 
- ✅ No "refresh token revoked" errors from thundering herd
- ✅ Backward compatibility maintained
- ✅ Clear documentation of locking mechanism
- ✅ Proper error handling with graduated responses

## Risk Assessment
- **Low Risk**: Changes isolated to client-side auth handling
- **Medium Risk**: Auth flows are critical - thorough testing needed  
- **Mitigation**: Implement with backward compatibility and clear rollback path
- **Testing**: Will test with multiple simultaneous requests to verify fix