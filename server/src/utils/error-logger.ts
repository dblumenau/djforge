/**
 * Utility for clean error logging without massive stack traces
 */

/**
 * Extract a clean error message from various error types
 */
export function getErrorMessage(error: any): string {
  // Handle Axios errors specifically
  if (error.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.status) {
    return `HTTP ${error.response.status}: ${error.response.statusText || 'Request failed'}`;
  }
  
  // Handle standard Error objects
  if (error.message) {
    return error.message;
  }
  
  // Fallback
  return 'Unknown error';
}

/**
 * Log an error with clean, concise output
 */
export function logError(context: string, error: any): void {
  const message = getErrorMessage(error);
  console.log(`[ERROR] ${context}: ${message}`);
}

/**
 * Log an error with debug context (includes status code if available)
 */
export function logDebugError(context: string, error: any): void {
  const message = getErrorMessage(error);
  const status = error.response?.status ? ` (${error.response.status})` : '';
  console.log(`[DEBUG] ${context}: ${message}${status}`);
}