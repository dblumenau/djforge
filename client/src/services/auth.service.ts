import { apiEndpoint } from '../config/api';

export class AuthService {
  private sessionId: string | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private refreshPromise: Promise<string> | null = null;
  private refreshPromiseExpiry: number = 0; // When the current refresh promise expires
  private refreshRetryCount: number = 0; // Track retry attempts for revoked tokens
  
  constructor() {
    this.loadFromStorage();
  }
  
  private loadFromStorage() {
    this.sessionId = localStorage.getItem('spotify_session_id');
    this.accessToken = localStorage.getItem('spotify_access_token');
    const expiry = localStorage.getItem('spotify_token_expiry');
    this.tokenExpiry = expiry ? parseInt(expiry) : 0;
    
    console.log('🔄 AuthService loadFromStorage:', {
      sessionId: this.sessionId,
      hasAccessToken: !!this.accessToken,
      tokenExpiry: this.tokenExpiry,
      tokenValid: this.tokenExpiry > Date.now()
    });
  }
  
  private saveToStorage() {
    if (this.sessionId) {
      localStorage.setItem('spotify_session_id', this.sessionId);
    }
    if (this.accessToken) {
      localStorage.setItem('spotify_access_token', this.accessToken);
      localStorage.setItem('spotify_token_expiry', this.tokenExpiry.toString());
    }
  }
  
  // Handle auth callback - now fetches token securely
  async handleAuthCallback(params: URLSearchParams) {
    console.log('🔄 Auth callback handling started:', window.location.href);
    
    const sessionId = params.get('sessionId');
    console.log('📋 Session ID from URL:', sessionId);
    
    if (!sessionId) {
      throw new Error('Invalid auth callback parameters');
    }
    
    this.sessionId = sessionId;
    this.saveToStorage();
    console.log('💾 Session ID saved to localStorage');
    
    // Fetch the initial token from the server
    console.log('🔄 Fetching initial token from server...');
    const response = await fetch(apiEndpoint('/api/auth/initial-token'), {
      headers: {
        'X-Session-ID': sessionId
      }
    });
    
    console.log('📡 Initial token response:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Initial token fetch failed:', errorText);
      throw new Error(`Failed to retrieve initial token: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ Initial token data received:', { expires_in: data.expires_in });
    
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    this.saveToStorage();
    
    console.log('✅ Auth callback completed successfully');
  }
  
  // Get current session ID
  getSessionId(): string | null {
    return this.sessionId;
  }
  
  // Get valid access token (refreshes if needed)
  async getAccessToken(): Promise<string> {
    // Check if token is still valid (5 min buffer)
    if (this.accessToken && this.tokenExpiry > Date.now() + 300000) {
      return this.accessToken;
    }
    
    const now = Date.now();
    
    // If a refresh is already in progress and hasn't expired, return its promise
    // This implements the 2000ms debouncing window to prevent thundering herd
    if (this.refreshPromise && this.refreshPromiseExpiry > now) {
      console.log('🔄 Reusing existing refresh promise (thundering herd protection)');
      return this.refreshPromise;
    }
    
    // If no session, we can't refresh
    if (!this.sessionId) {
      throw new Error('No active session');
    }
    
    // Clear any expired promise
    if (this.refreshPromise && this.refreshPromiseExpiry <= now) {
      console.log('🧹 Clearing expired refresh promise');
      this.refreshPromise = null;
      this.refreshPromiseExpiry = 0;
    }
    
    // Start a new refresh process with 2000ms debounce window
    console.log('🔄 Starting new token refresh process');
    this.refreshPromiseExpiry = now + 2000; // 2000ms debounce window
    this.refreshPromise = this.performRefreshWithRetry();
    
    try {
      const token = await this.refreshPromise;
      // Only clear the promise after successful completion AND debounce window expires
      setTimeout(() => {
        if (this.refreshPromiseExpiry <= Date.now()) {
          console.log('🧹 Clearing successful refresh promise after debounce window');
          this.refreshPromise = null;
          this.refreshPromiseExpiry = 0;
          this.refreshRetryCount = 0; // Reset retry count on success
        }
      }, Math.max(0, this.refreshPromiseExpiry - Date.now()));
      
      return token;
    } catch (error) {
      // Only clear the promise after failure AND debounce window expires
      setTimeout(() => {
        if (this.refreshPromiseExpiry <= Date.now()) {
          console.log('🧹 Clearing failed refresh promise after debounce window');
          this.refreshPromise = null;
          this.refreshPromiseExpiry = 0;
        }
      }, Math.max(0, this.refreshPromiseExpiry - Date.now()));
      
      throw error;
    }
  }
  
  // New wrapper method with enhanced retry logic for revoked tokens
  private async performRefreshWithRetry(): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.performRefresh(attempt);
        console.log(`✅ Token refresh succeeded on attempt ${attempt + 1}`);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.log(`❌ Token refresh failed on attempt ${attempt + 1}:`, lastError.message);
        
        // If it's a revoked token error, don't retry immediately - use exponential backoff
        if (lastError.message.includes('revoked') || lastError.message.includes('invalid_grant')) {
          this.refreshRetryCount++;
          
          // After 3 revoked token failures, force logout
          if (this.refreshRetryCount >= 3) {
            console.log('🚪 Too many revoked token failures, forcing logout');
            this.logout();
            window.location.href = '/landing';
            throw new Error('Token permanently revoked');
          }
          
          // Exponential backoff for revoked tokens: 2s, 4s, 8s
          if (attempt < maxRetries) {
            const backoffMs = Math.pow(2, attempt + 1) * 1000;
            console.log(`⏱️ Revoked token retry ${this.refreshRetryCount}/3, waiting ${backoffMs}ms before retry`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        } else if (lastError.message.includes('temporarily failed')) {
          // For temporary failures, use shorter delays: 1s, 2s, 3s
          if (attempt < maxRetries) {
            const delayMs = (attempt + 1) * 1000;
            console.log(`⏱️ Temporary failure, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        } else {
          // For other errors, don't retry
          break;
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Token refresh failed after all retries');
  }

  private async performRefresh(retryCount: number = 0): Promise<string> {
    if (!this.sessionId) throw new Error('No session ID to perform refresh');
    
    const response = await fetch(apiEndpoint('/api/auth/refresh'), {
      method: 'POST',
      headers: {
        'X-Session-ID': this.sessionId,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      
      // Check for immediate re-auth requirements (server says session is invalid)
      if (error.requiresReauth) {
        console.log('🚪 Server requires re-authentication');
        this.logout();
        window.location.href = '/landing';
        throw new Error('Re-authentication required');
      }
      
      // Throw the error with details for the retry wrapper to handle
      const errorMessage = error.error || 'Token refresh failed';
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    this.saveToStorage();
    
    console.log('✅ Token refreshed successfully, expires at:', new Date(this.tokenExpiry));
    return this.accessToken!;
  }
  
  // Check if authenticated
  isAuthenticated(): boolean {
    return !!this.sessionId;
  }
  
  // Logout
  logout() {
    localStorage.removeItem('spotify_session_id');
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expiry');
    
    this.sessionId = null;
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.refreshPromise = null;
    this.refreshPromiseExpiry = 0;
    this.refreshRetryCount = 0;
    
    console.log('🚪 Logged out and cleared all auth state');
  }
}

export const authService = new AuthService();