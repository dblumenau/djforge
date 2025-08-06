// Build version generated at build time
export const BUILD_VERSION = import.meta.env.VITE_BUILD_VERSION || 'dev';
export const BUILD_TIME = import.meta.env.VITE_BUILD_TIME || new Date().toISOString();

// Display version string
export const getVersionString = () => {
  if (BUILD_VERSION === 'dev') {
    return 'Development Build';
  }
  return `v${BUILD_VERSION}`;
};

// Check if running in development
export const isDevelopment = () => {
  return import.meta.env.DEV;
};

// Get full version info
export const getVersionInfo = () => {
  return {
    version: BUILD_VERSION,
    buildTime: BUILD_TIME,
    environment: import.meta.env.MODE,
    isDev: isDevelopment()
  };
};