/**
 * GPT-5 Responses API Testing Suite
 * 
 * Main export file that provides easy access to the GPT-5 testing infrastructure
 * Built with modular architecture for maintainability and reusability
 */

// Export the main class
export { GPT5ResponsesAPITester, main } from './scripts/test-console';

// Export core components for external use
export { SessionManager } from './core/session-manager';
export { initRedis } from './core/redis-client';
export { TestConfig, TestConfigSchema, defaultConfig } from './core/config';

// Export handlers
export { ResponseHandler } from './handlers/response-handler';
export { StreamHandler } from './handlers/stream-handler';
export { handleError } from './handlers/error-handler';

// Export CLI components
export { CommandHandler } from './cli/commands';

// Export tools
export { buildTools } from './tools/definitions';
export { toolValidators } from './tools/validators';
export * from './tools/schemas';

// Export test functions
export { runExamples } from './tests/examples';
export { runTestSeries } from './tests/series';

// Export types
export * from './types';

// Export formatters if needed
export * from './utils/formatters';