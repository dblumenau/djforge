// API configuration for different environments
const getApiUrl = () => {
  // Check if we have a Vite environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Default to localhost for development
  return 'http://127.0.0.1:3001';
};

export const API_URL = getApiUrl();

// Helper to ensure URLs are properly formatted
export const apiEndpoint = (path: string) => {
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};