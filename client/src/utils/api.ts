import { apiEndpoint } from '../config/api';

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
  
  return fetch(apiEndpoint(endpoint), {
    credentials: 'include',
    ...options,
    headers
  });
};

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
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

// API object with feedback methods
export const api = {
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