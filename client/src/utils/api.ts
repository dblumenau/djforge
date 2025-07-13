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