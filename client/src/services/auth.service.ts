import { apiEndpoint } from '../config/api';

export class AuthService {
  private sessionId: string | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private refreshPromise: Promise<string> | null = null;
  
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
    
    // If a refresh is already in progress, return its promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    // If no session, we can't refresh
    if (!this.sessionId) {
      throw new Error('No active session');
    }
    
    // Start a new refresh process
    this.refreshPromise = this.performRefresh();
    
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      // Clear the promise once it's resolved or rejected
      this.refreshPromise = null;
    }
  }
  
  private async performRefresh(): Promise<string> {
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
      if (error.requiresReauth) {
        this.logout();
        window.location.href = '/landing';
      }
      throw new Error('Token refresh failed');
    }
    
    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    this.saveToStorage();
    
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
  }
}

export const authService = new AuthService();