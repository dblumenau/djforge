# Spotify Authentication Issue - Comprehensive Report

## Problem Statement
Users are frequently forced to re-authenticate with Spotify despite implementing a refresh token stampede fix. The issue manifests as "Refresh token revoked" errors in production logs, forcing users to log in again.

## Root Cause Analysis

### Key Discovery: Spotify Implements Refresh Token Rotation
- When refreshing an access token, Spotify returns a NEW refresh_token
- The old refresh_token becomes invalid immediately
- Using an old refresh_token results in "invalid_grant: Refresh token revoked"
- This is NOT Spotify revoking tokens for security - it's normal OAuth 2.0 token rotation

### The Authentication Flow Problem
1. **JWT Contains Spotify Tokens**: Server issues JWT (30-day expiry) containing Spotify tokens
2. **Middleware Refreshes Silently**: When access token expires (1 hour), `ensureValidToken` middleware refreshes tokens
3. **Client Unaware**: Middleware gets new tokens but client's JWT still contains OLD refresh_token
4. **Cascade Failure**: Next refresh attempt uses old token → "Refresh token revoked"

## Fixes Implemented

### 1. Token Storage Fix (Commits: f738e94, 1284798, others)
- Updated `auth.ts` and `api.ts` to explicitly store new refresh_token when Spotify rotates
- Added logging to verify Spotify's refresh response
- Ensured all token storage locations are updated atomically

### 2. Refresh Token Stampede Prevention
- In-memory Promise cache in `refreshAccessToken()` to deduplicate concurrent refresh attempts
- Token-based cache key using first 20 chars of refresh_token
- Cache cleared after 1 second to allow subsequent refreshes

### 3. Client-Server JWT Synchronization (Commit: 4568c21)
**Server Side (`auth.ts`)**:
- Added `X-Token-Refreshed` header when middleware refreshes tokens
- Ensures middleware uses NEW refresh_token from Spotify response

**Client Side (`api.ts`)**:
- Enhanced all API wrappers to check for `X-Token-Refreshed` header
- Automatically calls `/api/auth/refresh` to get new JWT when header detected
- Prevents refresh loops with `isRefreshingToken` flag

## Current Status
- All fixes are committed and deployed to production
- Waiting to observe if tokens remain valid after the 1-hour expiry
- Initial logs after fresh login show no token errors

## Remaining Issues & Concerns

### 1. Multiple Simultaneous Refresh Attempts
- Dashboard loads trigger multiple API endpoints simultaneously
- Each endpoint hits `ensureValidToken` middleware
- Despite deduplication cache, race conditions may still occur
- The double-check pattern in `refreshAccessToken` helps but isn't perfect

### 2. Why Tokens Expire So Frequently
- Spotify access tokens should last 1 hour
- Logs sometimes show refreshes after just minutes
- Root cause of frequent refreshes still unknown

## What to Monitor

1. **Check for X-Token-Refreshed Headers**:
   ```bash
   fly logs | grep "Token refreshed - client needs new JWT"
   ```

2. **Verify Client Responds to Header**:
   ```bash
   fly logs | grep "Refreshing JWT token due to X-Token-Refreshed"
   ```

3. **Watch for Refresh Token Rotation**:
   ```bash
   fly logs | grep "Spotify rotated refresh token"
   ```

4. **Monitor for "Revoked" Errors**:
   ```bash
   fly logs | grep "Refresh token revoked"
   ```

## Potential Additional Fixes

### 1. Redis-Based Refresh Coordination
- Current in-memory cache only works on single instance
- Redis would provide cross-instance coordination
- Implementation stub exists but not completed

### 2. Batch API Endpoints
- Create composite endpoints to reduce concurrent auth checks
- E.g., single `/api/dashboard-data` instead of multiple calls

### 4. More Defensive Token Handling
- Add retry logic with exponential backoff
- Better error messages distinguishing rotation from true revocation
- Consider token refresh preemption (refresh at 45 min instead of 50)

## Testing Recommendations

1. **Fresh Session Test**: Monitor a completely new login session through its lifecycle
2. **Multi-Tab Test**: Open multiple browser tabs to test concurrent access
3. **Load Test**: Simulate dashboard with many simultaneous API calls
4. **Token Expiry Test**: Wait for natural 1-hour expiry and observe behavior

## Code Locations

- **Server Auth**: `/server/src/spotify/auth.ts` - Core authentication and refresh logic
- **Client Hook**: `/client/src/hooks/useSpotifyAuth.ts` - Client-side auth state management
- **API Wrapper**: `/client/src/utils/api.ts` - API call wrapper with header checking
- **JWT Utils**: `/server/src/utils/jwt.ts` - JWT generation and verification

## Summary

The core issue is Spotify's refresh token rotation combined with JWT-based authentication creating a synchronization problem. The implemented fixes address this by notifying the client when tokens are refreshed server-side. The solution is deployed but needs observation to confirm it resolves the issue completely. Additional improvements around connection management and API design could further enhance reliability.