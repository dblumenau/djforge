import { authService } from './auth.service';
import { apiEndpoint } from '../config/api';

// Interface for queued requests waiting for token refresh
interface QueuedRequest {
  endpoint: string;
  options: RequestInit;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
}

export class SpotifyClient {
  // Request queue for handling 401s during token refresh
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue: boolean = false;
  // Direct Spotify API call (for high-frequency endpoints)
  async spotifyRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await authService.getAccessToken();
    
    try {
      const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      // Handle 401 by queueing the request instead of immediate retry
      if (response.status === 401) {
        console.log('🔄 Got 401, queueing request for retry after refresh:', endpoint);
        return this.queueRequestForRetry(endpoint, options);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Queue a request for retry after token refresh completes.
   * This prevents race conditions when multiple requests get 401s simultaneously.
   */
  private async queueRequestForRetry(endpoint: string, options: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
      // Add request to queue
      this.requestQueue.push({
        endpoint,
        options,
        resolve,
        reject
      });

      // Process queue if not already processing
      if (!this.isProcessingQueue) {
        this.processRequestQueue();
      }
    });
  }

  /**
   * Process all queued requests after token refresh completes.
   * Coordinates with AuthService - let it handle all refresh logic.
   */
  private async processRequestQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`🔄 Processing ${this.requestQueue.length} queued requests after token refresh`);

    try {
      // Get fresh token (this will handle refresh if needed via AuthService)
      const newToken = await authService.getAccessToken();
      
      // Process all queued requests with the fresh token
      const queueToProcess = [...this.requestQueue];
      this.requestQueue = []; // Clear queue immediately to prevent new additions during processing

      await Promise.allSettled(
        queueToProcess.map(async (queuedRequest) => {
          try {
            const response = await fetch(`https://api.spotify.com/v1${queuedRequest.endpoint}`, {
              ...queuedRequest.options,
              headers: {
                'Authorization': `Bearer ${newToken}`,
                'Content-Type': 'application/json',
                ...queuedRequest.options.headers
              }
            });
            
            queuedRequest.resolve(response);
          } catch (error) {
            queuedRequest.reject(error as Error);
          }
        })
      );

      console.log(`✅ Successfully processed ${queueToProcess.length} queued requests`);
    } catch (error) {
      console.error('❌ Failed to refresh token, rejecting all queued requests:', error);
      
      // Reject all queued requests if refresh failed
      const queueToReject = [...this.requestQueue];
      this.requestQueue = [];
      
      queueToReject.forEach(queuedRequest => {
        queuedRequest.reject(error as Error);
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }
  
  // Server API call (for proxied endpoints)
  async serverRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const sessionId = authService.getSessionId();
    
    if (!sessionId) {
      throw new Error('No active session');
    }
    
    return fetch(apiEndpoint(`/api${endpoint}`), {
      ...options,
      credentials: 'include',
      headers: {
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }
  
  // High-frequency direct calls
  async getCurrentPlayback() {
    const response = await this.spotifyRequest('/me/player');
    return response.status === 204 ? null : response.json();
  }
  
  async getDevices() {
    const response = await this.spotifyRequest('/me/player/devices');
    return response.json();
  }
  
  async getQueue() {
    const response = await this.spotifyRequest('/me/player/queue');
    return response.json();
  }
  
  // Server-proxied calls
  async sendCommand(command: string) {
    const response = await this.serverRequest('/llm/command', {
      method: 'POST',
      body: JSON.stringify({ command })
    });
    return response.json();
  }
  
  async play() {
    const response = await this.serverRequest('/control/play', {
      method: 'POST'
    });
    return response.json();
  }
  
  async pause() {
    const response = await this.serverRequest('/control/pause', {
      method: 'POST'
    });
    return response.json();
  }
  
  async queueTrack(uri: string) {
    const response = await this.serverRequest('/control/queue', {
      method: 'POST',
      body: JSON.stringify({ uri })
    });
    return response.json();
  }
}

export const spotifyClient = new SpotifyClient();