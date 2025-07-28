import { apiEndpoint } from '../config/api';

// Track if we're already refreshing to avoid loops
let isRefreshingToken = false;

// Refresh the JWT token
const refreshJWT = async (): Promise<boolean> => {
  if (isRefreshingToken) {
    console.log('🔄 Token refresh already in progress, skipping...');
    return false;
  }

  const jwtToken = localStorage.getItem('spotify_jwt');
  if (!jwtToken) {
    console.log('❌ No JWT token to refresh');
    return false;
  }

  isRefreshingToken = true;
  
  try {
    console.log('🔄 Refreshing JWT token due to X-Token-Refreshed header...');
    const response = await fetch(apiEndpoint('/api/auth/refresh'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    
    if (data.success && data.newJwtToken) {
      // Update localStorage with new JWT
      localStorage.setItem('spotify_jwt', data.newJwtToken);
      console.log('✅ JWT token refreshed successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Failed to refresh JWT token:', error);
    return false;
  } finally {
    isRefreshingToken = false;
  }
};

// Helper function to make authenticated API requests
export const authenticatedFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const jwtToken = localStorage.getItem('spotify_jwt');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };
  
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }
  
  const response = await fetch(apiEndpoint(endpoint), {
    credentials: 'include',
    ...options,
    headers
  });

  // Check if server signals that tokens were refreshed
  if (response.headers.get('X-Token-Refreshed') === 'true') {
    console.log('🚨 Server refreshed tokens - updating JWT...');
    await refreshJWT();
  }

  return response;
};

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
  // Check for token refresh header BEFORE processing response
  if (response.headers.get('X-Token-Refreshed') === 'true') {
    console.log('🚨 Server refreshed tokens - updating JWT...');
    await refreshJWT();
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
};

// Helper function to get auth headers
const getAuthHeaders = (): Record<string, string> => {
  const jwtToken = localStorage.getItem('spotify_jwt');
  return {
    'Content-Type': 'application/json',
    ...(jwtToken && { 'Authorization': `Bearer ${jwtToken}` })
  };
};

// API object with feedback methods and generic HTTP methods
export const api = {
  // Generic HTTP methods
  get: async (endpoint: string) => {
    const response = await fetch(apiEndpoint(endpoint), {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    // Check for token refresh header
    if (response.headers.get('X-Token-Refreshed') === 'true') {
      console.log('🚨 Server refreshed tokens - updating JWT...');
      await refreshJWT();
    }
    
    return response;
  },

  post: async (endpoint: string, data: any) => {
    const response = await fetch(apiEndpoint(endpoint), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    // Check for token refresh header
    if (response.headers.get('X-Token-Refreshed') === 'true') {
      console.log('🚨 Server refreshed tokens - updating JWT...');
      await refreshJWT();
    }
    
    return response;
  },

  put: async (endpoint: string, data: any) => {
    const response = await fetch(apiEndpoint(endpoint), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    // Check for token refresh header
    if (response.headers.get('X-Token-Refreshed') === 'true') {
      console.log('🚨 Server refreshed tokens - updating JWT...');
      await refreshJWT();
    }
    
    return response;
  },

  delete: async (endpoint: string, data: any) => {
    const response = await fetch(apiEndpoint(endpoint), {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    // Check for token refresh header
    if (response.headers.get('X-Token-Refreshed') === 'true') {
      console.log('🚨 Server refreshed tokens - updating JWT...');
      await refreshJWT();
    }
    
    return response;
  },

  // Record feedback for a track
  recordFeedback: async (trackUri: string, feedback: 'loved' | 'disliked' | 'remove') => {
    const response = await fetch(apiEndpoint('/api/feedback/ai-discovery'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ trackUri, feedback })
    });
    return handleResponse(response);
  },

  // Get all AI discoveries with feedback
  getAIDiscoveries: async () => {
    const response = await fetch(apiEndpoint('/api/feedback/ai-discoveries'), {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Get AI feedback dashboard data
  getAIFeedbackDashboard: async () => {
    const response = await fetch(apiEndpoint('/api/feedback/dashboard'), {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};