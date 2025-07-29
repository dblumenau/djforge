// Backward compatibility layer for old API interface
// This re-exports the compatibility functions during the auth migration

export { api, authenticatedFetch, getAuthStatus } from './temp-auth';