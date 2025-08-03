import { useCallback, useRef } from 'react';
import { useError } from '../contexts/ErrorContext';
import { authService } from '../services/auth.service';
import { apiEndpoint } from '../config/api';

interface RetryState {
  errorId?: string;
  retryCount: number;
  maxRetries: number;
}

export const useApiWithErrorHandling = () => {
  const { addError, updateError, removeError } = useError();
  const retryStates = useRef<Map<string, RetryState>>(new Map());

  const handleApiCall = useCallback(async <T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const sessionId = authService.getSessionId();
    const requestKey = `${options.method || 'GET'}-${url}`;
    
    if (!sessionId) {
      addError({
        type: 'error',
        title: 'Authentication Required',
        message: 'Please log in to continue',
        autoHide: true,
        duration: 5000
      });
      throw new Error('No active session');
    }

    try {
      const response = await fetch(url.startsWith('http') ? url : apiEndpoint(url), {
        ...options,
        credentials: 'include',
        headers: {
          'X-Session-ID': sessionId,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      // Clear any retry notifications on success
      const retryState = retryStates.current.get(requestKey);
      if (retryState?.errorId) {
        removeError(retryState.errorId);
        retryStates.current.delete(requestKey);
      }

      if (!response.ok) {
        // Handle token refresh errors
        if (response.status === 401) {
          const errorText = await response.text();
          
          if (errorText.includes('Token refresh') || errorText.includes('Spotify service')) {
            // Parse retry information if available
            const retryMatch = errorText.match(/attempt (\d+)\/(\d+)/);
            
            if (retryMatch) {
              const [, currentAttempt, maxAttempts] = retryMatch;
              const retryState = retryStates.current.get(requestKey) || {
                retryCount: 0,
                maxRetries: parseInt(maxAttempts)
              };
              
              if (!retryState.errorId) {
                // Create new retry notification
                const errorId = addError({
                  type: 'retry',
                  title: 'Refreshing Authentication',
                  message: 'Spotify is having issues. Retrying authentication...',
                  retryCount: parseInt(currentAttempt),
                  maxRetries: retryState.maxRetries,
                  autoHide: false
                }) as unknown as string;
                
                retryState.errorId = errorId;
                retryStates.current.set(requestKey, retryState);
              } else {
                // Update existing notification
                updateError(retryState.errorId, {
                  retryCount: parseInt(currentAttempt),
                  message: `Spotify service is experiencing issues. Retrying...`
                });
              }
              
              // Wait and retry
              await new Promise(resolve => setTimeout(resolve, 2000));
              return handleApiCall(url, options);
            } else if (errorText.includes('Maximum retries exceeded')) {
              addError({
                type: 'error',
                title: 'Authentication Failed',
                message: 'Unable to refresh your Spotify session. Please try logging out and back in.',
                autoHide: false
              });
              throw new Error('Authentication failed after multiple retries');
            }
          }
          
          // Generic 401 error
          addError({
            type: 'warning',
            title: 'Session Expired',
            message: 'Your session has expired. Please log in again.',
            autoHide: true,
            duration: 5000
          });
          throw new Error('Unauthorized');
        }
        
        // Handle 500 errors
        if (response.status >= 500) {
          const retryState = retryStates.current.get(requestKey) || {
            retryCount: 0,
            maxRetries: 6
          };
          
          if (retryState.retryCount < retryState.maxRetries) {
            retryState.retryCount++;
            
            if (!retryState.errorId) {
              const errorId = addError({
                type: 'retry',
                title: 'Server Error',
                message: 'The server encountered an error. Retrying...',
                retryCount: retryState.retryCount,
                maxRetries: retryState.maxRetries,
                autoHide: false
              }) as unknown as string;
              
              retryState.errorId = errorId;
            } else {
              updateError(retryState.errorId, {
                retryCount: retryState.retryCount
              });
            }
            
            retryStates.current.set(requestKey, retryState);
            
            // Exponential backoff (1s, 2s, 4s, 8s, 16s, 16s)
            const delay = Math.min(1000 * Math.pow(2, retryState.retryCount - 1), 16000);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            return handleApiCall(url, options);
          } else {
            addError({
              type: 'error',
              title: 'Server Error',
              message: 'The server is temporarily unavailable. Please try again later.',
              autoHide: true,
              duration: 8000
            });
            throw new Error(`Server error: ${response.status}`);
          }
        }
        
        throw new Error(`Request failed: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        addError({
          type: 'error',
          title: 'Connection Error',
          message: 'Unable to connect to the server. Please check your internet connection.',
          autoHide: true,
          duration: 5000
        });
      }
      
      throw error;
    }
  }, [addError, updateError, removeError]);

  return { apiCall: handleApiCall };
};