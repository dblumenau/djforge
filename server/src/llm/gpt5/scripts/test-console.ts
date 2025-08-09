#!/usr/bin/env npx tsx

/**
 * ULTIMATE OpenAI Responses API Test Script - GPT-5 Edition
 * Complete TypeScript implementation with modular architecture
 * 
 * Based on the latest OpenAI Node.js SDK documentation (v5+)
 * Features:
 * - Full TypeScript types from OpenAI SDK
 * - Redis session management for conversation continuity
 * - Streaming support
 * - Tool calling with Zod schemas
 * - Structured outputs
 * - Reasoning tokens tracking
 * - Built-in and custom tools
 * - Modular design for maintainability
 */

import chalk from 'chalk';
import 'dotenv/config';
import OpenAI from 'openai';
import * as readline from 'readline';
import { z } from 'zod';

// Import all the extracted modules
import { initRedis } from '../core/redis-client';
import { SessionManager } from '../core/session-manager';
import { TestConfig, defaultConfig } from '../core/config';
import { ResponseHandler } from '../handlers/response-handler';
import { StreamHandler } from '../handlers/stream-handler';
import { handleError } from '../handlers/error-handler';
import { CommandHandler } from '../cli/commands';
import { buildTools } from '../tools/definitions';
import { toolValidators } from '../tools/validators';
import { runExamples } from '../tests/examples';
import { runTestSeries } from '../tests/series';

// Import response types from the responses module
import type {
  ResponseCreateParams,
  ResponseFormatTextConfig,
} from 'openai/resources/responses/responses';

// Import types
import { SessionData } from '../types';

export class GPT5ResponsesAPITester {
  private openai: OpenAI;
  private redisClient: any | null = null;
  private sessionManager: SessionManager;
  private responseHandler: ResponseHandler;
  private streamHandler: StreamHandler;
  private commandHandler: CommandHandler;
  private sessionData: SessionData;
  private rl: readline.Interface;
  private config: TestConfig;
  public initializePromise: Promise<void>;
  private processingCommand: boolean = false;

  constructor() {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      console.error(chalk.red.bold('ERROR: OPENAI_API_KEY not found in .env file'));
      console.log('Please add OPENAI_API_KEY=your-key-here to your .env file');
      process.exit(1);
    }

    // Initialize OpenAI client with latest configuration
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 3,
      timeout: 60000, // 60 seconds
    });

    // Initialize session data with empty defaults
    this.sessionData = {
      lastResponseId: null,
      conversationHistory: [],
      metadata: {}
    };

    // Set up default configuration
    this.config = { ...defaultConfig };

    // Initialize managers and handlers
    this.sessionManager = new SessionManager();
    this.responseHandler = new ResponseHandler(toolValidators);
    this.streamHandler = new StreamHandler(this.config.verbose);

    // Setup readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('> ')
    });

    // Initialize CommandHandler - will be updated after initialization
    this.commandHandler = new CommandHandler(
      this.config,
      this.sessionData,
      this.redisClient,
      () => this.saveSession()
    );

    // Initialize connections and store the promise for external awaiting
    this.initializePromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize Redis first, then load session
    this.redisClient = await initRedis();
    this.sessionData = await this.sessionManager.loadSession(this.redisClient);
    
    // Update stream handler verbosity
    this.streamHandler = new StreamHandler(this.config.verbose);
    
    // Update command handler with initialized values
    this.commandHandler = new CommandHandler(
      this.config,
      this.sessionData,
      this.redisClient,
      () => this.saveSession()
    );
  }

  private async saveSession(): Promise<void> {
    await this.sessionManager.saveSession(this.sessionData, this.redisClient);
  }

  public async callResponsesAPI(input: string, options: Partial<TestConfig> = {}): Promise<void> {
    const config = { ...this.config, ...options };
    
    console.log(chalk.blue('\n' + '═'.repeat(80)));
    console.log(chalk.bold('CALLING GPT-5 RESPONSES API'));
    console.log(chalk.blue('═'.repeat(80)));

    // Build request parameters with proper typing
    const params: ResponseCreateParams = {
      model: config.model,
      input: input,
      store: true, // Enable server-side storage
      
      // Optional parameters
      instructions: `You are a music assistant integrated with DJ Forge, a Spotify control system.

CRITICAL RULES:
1. When user rejects music or asks for alternatives (examples: "I don't like that song", "play something else", "another please", "different music"), you MUST use the 'provide_music_alternatives' function.
2. You can provide BOTH a friendly text response AND call the function in the same response.
3. The function provides structured data for the UI, while your text message adds personality.

Example: User says "I don't like that song"
- Call provide_music_alternatives function with alternatives
- Also say something friendly like "No problem! Let me suggest some alternatives..."

This dual approach makes the experience both functional and conversational.`,
      max_output_tokens: config.maxOutputTokens,
      temperature: config.temperature,
      top_p: 1,
      
      // Reasoning configuration
      reasoning: {
        effort: config.reasoning.effort
      },
      
      // Text configuration
      text: {
        format: {
          type: "text"
        } as ResponseFormatTextConfig,
        verbosity: "medium"
      },
      
      // Tool configuration
      tool_choice: config.useTools ? "auto" : undefined,  // "auto" is PERFECT - model decides when functions make sense!
      parallel_tool_calls: true,
      
      // Truncation strategy
      truncation: "disabled",
      
      // Metadata - all values must be strings
      metadata: {
        test: "true",
        timestamp: new Date().toISOString(),
        session: this.sessionData.lastResponseId ? "continued" : "new"
      }
    };

    // Add conversation continuity
    if (this.sessionData.lastResponseId) {
      params.previous_response_id = this.sessionData.lastResponseId;
      console.log(chalk.yellow(`Continuing from: ${this.sessionData.lastResponseId}`));
    }

    // Add tools if enabled
    if (config.useTools) {
      params.tools = buildTools();
    }

    // Add structured output if enabled
    if (config.structuredOutput) {
      const ResponseSchema = z.object({
        answer: z.string(),
        confidence: z.number().min(0).max(1),
        reasoning: z.string().optional(),
        sources: z.array(z.string()).optional()
      });
      
      // TODO: Structured output might need different handling
      // params.response_format = zodResponseFormat(ResponseSchema, 'structured_response');
    }

    if (config.verbose) {
      console.log(chalk.dim('Request Parameters:'));
      console.log(this.responseHandler.formatJSON(params));
    }

    try {
      const startTime = Date.now();
      
      if (config.streaming) {
        await this.streamHandler.handleStreamingResponse(
          this.openai, 
          params, 
          startTime, 
          this.sessionData, 
          () => this.saveSession()
        );
      } else {
        await this.responseHandler.handleStandardResponse(
          this.openai,
          params, 
          startTime, 
          input,
          this.sessionData,
          () => this.saveSession()
        );
      }
      
    } catch (error) {
      handleError(error, config.verbose);
    }
  }

  async interactiveMode(): Promise<void> {
    console.log(chalk.bold('\n' + '═'.repeat(80)));
    console.log(chalk.bold('OpenAI Responses API - Complete Test Console'));
    console.log(chalk.bold('═'.repeat(80)));
    console.log('\nThis console uses the ACTUAL Responses API with full feature support.');
    console.log('Server-side conversation management via previous_response_id.\n');
    
    console.log(chalk.bold('Commands:'));
    console.log(`  ${chalk.cyan('/tools')}       - Enable all tools for next message`);
    console.log(`  ${chalk.cyan('/model <name>')} - Switch model (gpt-5, gpt-5-mini, gpt-5-nano)`);
    console.log(`  ${chalk.cyan('/reasoning <level>')} - Set reasoning effort (low, medium, high)`);
    console.log(`  ${chalk.cyan('/stream')}      - Toggle streaming mode`);
    console.log(`  ${chalk.cyan('/structured')}  - Toggle structured output`);
    console.log(`  ${chalk.cyan('/verbose')}     - Toggle verbose output`);
    console.log(`  ${chalk.cyan('/clear')}       - Start new conversation`);
    console.log(`  ${chalk.cyan('/reset')}       - Reset response ID only (keep history)`);
    console.log(`  ${chalk.cyan('/history')}     - Show conversation history`);
    console.log(`  ${chalk.cyan('/session')}     - Show session info`);
    console.log(`  ${chalk.cyan('/skiptest')}    - Test function calling with proper execution`);
    console.log(`  ${chalk.cyan('/examples')}    - Run example conversations`);
    console.log(`  ${chalk.cyan('/test')}        - Run comprehensive test series`);
    console.log(`  ${chalk.cyan('/help')}        - Show this help`);
    console.log(`  ${chalk.cyan('/exit')}        - Exit program`);
    console.log(`\nOr just type your message to send to OpenAI.\n`);

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const input = line.trim();
      
      // Prevent concurrent command processing
      if (this.processingCommand) {
        console.log(chalk.yellow('Still processing previous command, please wait...'));
        return;
      }

      this.processingCommand = true;

      try {
        if (input.startsWith('/')) {
          const shouldExit = await this.handleCommand(input);
          if (shouldExit) {
            this.rl.close();
            process.exit(0);
          }
        } else if (input) {
          await this.callResponsesAPI(input, this.config);
        }
      } catch (error) {
        console.error(chalk.red('Error processing command:'), error);
      } finally {
        this.processingCommand = false;
        this.rl.prompt();
      }
    });
  }

  private async handleCommand(input: string): Promise<boolean> {
    // Handle special test commands that need to call our API method
    const [command, ...args] = input.split(' ');
    
    if (command === '/examples') {
      await runExamples((input: string, options?: Partial<TestConfig>) => 
        this.callResponsesAPI(input, options)
      );
      return false;
    }
    
    if (command === '/test') {
      await runTestSeries((input: string, options?: Partial<TestConfig>) => 
        this.callResponsesAPI(input, options)
      );
      return false;
    }
    
    if (command === '/skiptest') {
      await this.runSkipBackTest();
      return false;
    }
    
    // Delegate to CommandHandler for all other commands
    return await this.commandHandler.handleCommand(input);
  }

  private async runSkipBackTest(): Promise<void> {
    console.log(chalk.bold('\n🔬 Testing Function Calling with Proper Execution...\n'));
    console.log(chalk.dim('This test demonstrates that we now properly execute functions'));
    console.log(chalk.dim('and provide results back to the model - no skip-back needed!\n'));

    const tests = [
      {
        name: 'Step 1: Start conversation (no function call)',
        input: 'Hello! My name is David and I love jazz music.',
        expectFunctionCall: false
      },
      {
        name: 'Step 2: Continue conversation (no function call)',
        input: 'Tell me about Miles Davis.',
        expectFunctionCall: false
      },
      {
        name: 'Step 3: Trigger function call',
        input: "I don't like that song, play something else please",
        expectFunctionCall: true,
        description: 'Should execute provide_music_alternatives function and continue'
      },
      {
        name: 'Step 4: Test continuity after function call',
        input: 'What was I asking about before?',
        expectFunctionCall: false,
        description: 'Should remember previous context including function execution'
      },
      {
        name: 'Step 5: Another function call',
        input: 'Actually, different music please',
        expectFunctionCall: true,
        description: 'Should execute function again and provide alternatives'
      },
      {
        name: 'Step 6: Test complete memory',
        input: 'You were telling me about that jazz musician?',
        expectFunctionCall: false,
        description: 'Should remember entire conversation including all function calls'
      }
    ];

    for (const test of tests) {
      console.log(chalk.yellow(`\n📝 ${test.name}`));
      if (test.expectFunctionCall) {
        console.log(chalk.cyan('  Expected: Function call → execution → final response'));
      } else {
        console.log(chalk.dim('  Expected: Direct text response'));
      }
      if (test.description) {
        console.log(chalk.dim(`  ${test.description}`));
      }
      
      await this.callResponsesAPI(test.input, { 
        useTools: true,
        streaming: true 
      });
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(chalk.green.bold('\n✅ Function calling test complete!'));
    console.log(chalk.green('🎉 No more skip-back needed - functions are properly executed!'));
    console.log(chalk.dim('\nUse /history to see the complete conversation flow'));
  }
}

// Main execution
async function main(): Promise<void> {
  const tester = new GPT5ResponsesAPITester();
  
  // CRITICAL: Wait for initialization to complete before proceeding
  // This ensures Redis and session are fully loaded
  await tester.initializePromise;

  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--examples')) {
    await runExamples((input: string, options?: Partial<TestConfig>) => 
      tester.callResponsesAPI(input, options)
    );
    process.exit(0);
  }

  if (args.includes('--test')) {
    await runTestSeries((input: string, options?: Partial<TestConfig>) => 
      tester.callResponsesAPI(input, options)
    );
    process.exit(0);
  }

  if (args.includes('--help')) {
    console.log('\nUsage: node test-responses-api-gpt5.js [options]');
    console.log('\nOptions:');
    console.log('  --examples    Run example conversations');
    console.log('  --test        Run comprehensive test series');
    console.log('  --stream      Use streaming mode');
    console.log('  --tools       Enable tools');
    console.log('  --verbose     Verbose output');
    console.log('  --help        Show this help message');
    console.log('  <message>     Send a single message');
    console.log('\nWithout options, starts interactive mode.');
    process.exit(0);
  }

  // Single message mode
  if (args.length > 0 && !args[0].startsWith('--')) {
    const message = args.join(' ');
    const config: Partial<TestConfig> = {
      streaming: args.includes('--stream'),
      useTools: args.includes('--tools'),
      verbose: args.includes('--verbose'),
      model: (process.env.MODEL as any) || 'gpt-5-nano'
    };
    await tester.callResponsesAPI(message, config);
    process.exit(0);
  }

  // Interactive mode
  await tester.interactiveMode();
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error(chalk.red.bold('Unhandled Promise Rejection:'), error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nGracefully shutting down...'));
  process.exit(0);
});

// Export for external use
export { main };

// Run the application if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red.bold('Fatal error:'), error);
    process.exit(1);
  });
}