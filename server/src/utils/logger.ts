import { logger } from '../config/logger';

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

// Override console methods to use Winston logger
export function overrideConsole(): void {
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    logger.info(message);
  };

  console.error = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    logger.error(message);
  };

  console.warn = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    logger.warn(message);
  };

  console.info = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    logger.info(message);
  };

  console.debug = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    logger.debug(message);
  };
}

// Restore original console methods (useful for testing)
export function restoreConsole(): void {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
}

// Export the logger instance for direct use if needed
export { logger };

// Helper function to log with metadata
export function logWithMetadata(level: string, message: string, metadata?: any): void {
  const logLevel = level.toLowerCase();
  if (metadata) {
    (logger as any)[logLevel](message, metadata);
  } else {
    (logger as any)[logLevel](message);
  }
}

// Specialized logging functions
export const logRequest = (method: string, path: string, duration?: number) => {
  const message = `${method} ${path}${duration ? ` - ${duration}ms` : ''}`;
  logger.info(message, { type: 'request', method, path, duration });
};

export const logLLMRequest = (model: string, provider: string, latency: number) => {
  logger.info(`LLM Request: ${model} via ${provider}`, { 
    type: 'llm_request', 
    model, 
    provider, 
    latency 
  });
};

export const logSpotifyAPI = (endpoint: string, method: string, success: boolean) => {
  const level = success ? 'info' : 'error';
  const message = `Spotify API: ${method} ${endpoint} - ${success ? 'Success' : 'Failed'}`;
  (logger as any)[level](message, { 
    type: 'spotify_api', 
    endpoint, 
    method, 
    success 
  });
};

export const logRedisOperation = (operation: string, key: string, success: boolean) => {
  const level = success ? 'debug' : 'warn';
  const message = `Redis: ${operation} ${key} - ${success ? 'Success' : 'Failed'}`;
  (logger as any)[level](message, { 
    type: 'redis', 
    operation, 
    key, 
    success 
  });
};