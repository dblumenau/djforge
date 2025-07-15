// API configuration for different environments
const getApiUrl = () => {
  console.log(import.meta.env.VITE_API_URL);
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
  if (!API_URL) {
    throw new Error('API_URL is not defined');
  }
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  const baseUrl = API_URL.replace(/\/+$/, '');
  const cleanPath = `/${path.replace(/^\/+/, '')}`;
  return `${baseUrl}${cleanPath}`;
};