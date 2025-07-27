import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Production logger configuration for Fly.io deployment
const isProduction = process.env.NODE_ENV === 'production';

// In production on Fly.io, we should primarily use console output
// since filesystem logs are ephemeral
const createProductionLogger = () => {
  const transports: winston.transport[] = [];

  // Always log to console in production
  transports.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json() // JSON format for better parsing in Fly.io logs
    )
  }));

  // Optionally write to files if LOG_TO_FILE is enabled
  // This can be useful for debugging but remember files are ephemeral
  if (process.env.LOG_TO_FILE === 'true') {
    try {
      // Use /tmp directory which is writable in most containers
      const logsDir = '/tmp/logs';
      
      // Try to create logs directory
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Only add file transports if directory creation succeeded
      const fileFormat = winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
          let msg = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
          
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          
          if (stack) {
            msg += `\n${stack}`;
          }
          
          return msg;
        })
      );

      transports.push(new DailyRotateFile({
        filename: path.join(logsDir, 'app-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m', // Smaller size for production
        maxFiles: '3d', // Keep fewer days in production
        format: fileFormat
      }));

      transports.push(new DailyRotateFile({
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: '3d',
        level: 'error',
        format: fileFormat
      }));
    } catch (error) {
      // If file logging fails, just log to console
      console.warn('Failed to set up file logging:', error);
    }
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports
  });
};

// Development logger configuration (existing functionality)
const createDevelopmentLogger = () => {
  // Your existing logger configuration
  const logsDir = path.join(process.cwd(), 'logs');
  
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (error) {
    console.warn('Failed to create logs directory:', error);
  }

  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
      let msg = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
      }
      
      if (stack) {
        msg += `\n${stack}`;
      }
      
      return msg;
    })
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ];

  // Only add file transports if directory exists
  if (fs.existsSync(logsDir)) {
    transports.push(
      new DailyRotateFile({
        filename: path.join(logsDir, 'app-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: logFormat
      }),
      new DailyRotateFile({
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: logFormat
      }),
      new DailyRotateFile({
        filename: path.join(logsDir, 'warn-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'warn',
        format: logFormat
      })
    );
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports
  });
};

// Export the appropriate logger based on environment
export const logger = isProduction ? createProductionLogger() : createDevelopmentLogger();

export default logger;