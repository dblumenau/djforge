import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Check if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Determine logs directory based on environment
const logsDir = isProduction ? '/tmp/logs' : path.join(process.cwd(), 'logs');

// Try to ensure logs directory exists, but don't fail if it doesn't
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  console.warn(`Failed to create logs directory at ${logsDir}:`, error);
}

// Define custom format for log messages
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      msg += `\n${stack}`;
    }
    
    return msg;
  })
);

// Create transport for all logs
const allLogsTransport: DailyRotateFile = new DailyRotateFile({
  filename: path.join(logsDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // Keep logs for 30 days
  format: logFormat
});

// Create transport for error logs only
const errorLogsTransport: DailyRotateFile = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: logFormat
});

// Create transport for warning logs
const warnLogsTransport: DailyRotateFile = new DailyRotateFile({
  filename: path.join(logsDir, 'warn-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'warn',
  format: logFormat
});

// Console transport - use JSON in production, colorized in development
const consoleTransport = new winston.transports.Console({
  format: isProduction 
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
});

// Build transports array based on environment and capabilities
const transports: winston.transport[] = [consoleTransport];

// Only add file transports if the logs directory exists and is writable
if (fs.existsSync(logsDir)) {
  try {
    // Test if we can write to the directory
    const testFile = path.join(logsDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    // If we can write, add file transports
    transports.push(allLogsTransport, errorLogsTransport, warnLogsTransport);
  } catch (error) {
    console.warn('Logs directory exists but is not writable, using console only');
  }
}

// Create the logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: fs.existsSync(logsDir) ? [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: !isProduction,
      maxSize: isProduction ? '10m' : '20m',
      maxFiles: isProduction ? '3d' : '30d',
      format: logFormat
    })
  ] : [consoleTransport],
  rejectionHandlers: fs.existsSync(logsDir) ? [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: !isProduction,
      maxSize: isProduction ? '10m' : '20m',
      maxFiles: isProduction ? '3d' : '30d',
      format: logFormat
    })
  ] : [consoleTransport]
});

// Log rotation events
allLogsTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info(`Log rotation: ${oldFilename} -> ${newFilename}`);
});

// Log when new file is created
allLogsTransport.on('new', (filename) => {
  // Only log in development to avoid confusion during tsx restarts
  if (!isProduction) {
    logger.debug(`Log file opened: ${filename}`);
  }
});

export default logger;