import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
// Using any type for Redis client to avoid version conflicts
import { SessionData } from '../types';

// Session validation schema - runtime validation for loaded sessions
const SessionDataSchema = z.object({
  lastResponseId: z.string().nullable(),
  conversationHistory: z.array(z.object({
    responseId: z.string(),
    input: z.string(),
    output: z.string(),
    timestamp: z.string(),
    model: z.string(),
    usage: z.any().optional() // ResponseUsage type is complex, using any for now
  })),
  metadata: z.record(z.any())
});

export class SessionManager {
  private sessionFile: string;
  private savingSession: boolean = false;
  private pendingSave: boolean = false;

  constructor() {
    this.sessionFile = path.join(process.cwd(), '.responses-session-real.json');
  }

  async loadSession(redisClient: any | null): Promise<SessionData> {
    try {
      // Try Redis first
      if (redisClient) {
        const redisData = await redisClient.get('gpt5-test-session');
        if (redisData) {
          const loadedData = JSON.parse(redisData as string);
          
          // Validate with Zod
          try {
            SessionDataSchema.parse(loadedData);
            const sessionData = loadedData as SessionData;
            console.log(chalk.green('✓ Loaded and validated session from Redis'));
            this.displaySessionInfo(sessionData);
            return sessionData;
          } catch (validationError) {
            if (validationError instanceof z.ZodError) {
              console.log(chalk.yellow('Session validation failed:'));
              validationError.errors.forEach(err => {
                console.log(chalk.yellow(`  - ${err.path.join('.')}: ${err.message}`));
              });
              console.log(chalk.yellow('Starting with fresh session'));
              
              // Reset to valid empty session
              const freshSession = {
                lastResponseId: null,
                conversationHistory: [],
                metadata: {}
              };
              return freshSession;
            } else {
              throw validationError;
            }
          }
        }
      }

      // Fallback to file
      const fileData = await fs.readFile(this.sessionFile, 'utf8');
      const loadedData = JSON.parse(fileData);
      
      // Validate with Zod
      try {
        SessionDataSchema.parse(loadedData);
        const sessionData = loadedData as SessionData;
        console.log(chalk.green('✓ Loaded and validated session from file'));
        this.displaySessionInfo(sessionData);
        return sessionData;
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.log(chalk.yellow('Session validation failed:'));
          validationError.errors.forEach(err => {
            console.log(chalk.yellow(`  - ${err.path.join('.')}: ${err.message}`));
          });
          console.log(chalk.yellow('Starting with fresh session'));
          
          // Reset to valid empty session
          const freshSession = {
            lastResponseId: null,
            conversationHistory: [],
            metadata: {}
          };
          return freshSession;
        } else {
          throw validationError;
        }
      }
    } catch (error) {
      console.log(chalk.yellow('Starting fresh session'));
      return {
        lastResponseId: null,
        conversationHistory: [],
        metadata: {}
      };
    }
  }

  async saveSession(sessionData: SessionData, redisClient: any | null): Promise<void> {
    // Prevent concurrent saves to avoid race conditions
    if (this.savingSession) {
      this.pendingSave = true;
      return;
    }

    this.savingSession = true;

    try {
      // Save to Redis if available
      if (redisClient) {
        await redisClient.set(
          'gpt5-test-session',
          JSON.stringify(sessionData),
          { EX: 86400 } // Expire after 24 hours
        );
      }

      // Always save to file as backup
      await fs.writeFile(
        this.sessionFile,
        JSON.stringify(sessionData, null, 2)
      );
    } catch (error) {
      console.error(chalk.red('Failed to save session:'), error);
    } finally {
      this.savingSession = false;
      
      // If there was a pending save request, execute it now
      if (this.pendingSave) {
        this.pendingSave = false;
        await this.saveSession(sessionData, redisClient);
      }
    }
  }

  displaySessionInfo(sessionData: SessionData): void {
    if (sessionData.lastResponseId) {
      console.log(chalk.dim(`  Last Response ID: ${sessionData.lastResponseId}`));
      const historyCount = sessionData.conversationHistory?.length || 0;
      console.log(chalk.dim(`  History: ${historyCount} messages`));
    }
  }
}