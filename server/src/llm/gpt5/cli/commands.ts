import chalk from 'chalk';
// Using any type for Redis client to avoid version conflicts
import { TestConfig } from '../core/config';
import { SessionData } from '../types';

export class CommandHandler {
  private config: TestConfig;
  private sessionData: SessionData;
  private redisClient: any | null;
  private saveSessionFn: () => Promise<void>;

  constructor(
    config: TestConfig,
    sessionData: SessionData,
    redisClient: any | null,
    saveSessionFn: () => Promise<void>
  ) {
    this.config = config;
    this.sessionData = sessionData;
    this.redisClient = redisClient;
    this.saveSessionFn = saveSessionFn;
  }

  async handleCommand(input: string): Promise<boolean> {
    const [command, ...args] = input.split(' ');
    
    switch (command) {
      case '/exit':
        console.log(chalk.yellow('\nGoodbye!'));
        if (this.redisClient) {
          await this.redisClient.quit();
        }
        return true; // Signal exit
        
      case '/clear':
        this.sessionData.lastResponseId = null;
        this.sessionData.conversationHistory = [];
        this.sessionData.metadata = {};
        await this.saveSessionFn();
        console.log(chalk.green('✓ Started new conversation'));
        break;
        
      case '/reset':
        // Just reset the response ID, keep history
        this.sessionData.lastResponseId = null;
        await this.saveSessionFn();
        console.log(chalk.green('✓ Response ID reset (history preserved)'));
        console.log(chalk.dim('Use this if you encounter streaming errors with function calls'));
        break;

      case '/history':
        this.showHistory();
        break;

      case '/session':
        this.showSessionInfo();
        break;

      case '/tools':
        this.config.useTools = !this.config.useTools;
        console.log(chalk.green(`Tools ${this.config.useTools ? 'enabled' : 'disabled'}`));
        break;

      case '/stream':
        this.config.streaming = !this.config.streaming;
        console.log(chalk.green(`Streaming ${this.config.streaming ? 'enabled' : 'disabled'}`));
        break;

      case '/structured':
        this.config.structuredOutput = !this.config.structuredOutput;
        console.log(chalk.green(`Structured output ${this.config.structuredOutput ? 'enabled' : 'disabled'}`));
        break;

      case '/verbose':
        this.config.verbose = !this.config.verbose;
        console.log(chalk.green(`Verbose mode ${this.config.verbose ? 'on' : 'off'}`));
        break;

      case '/model':
        if (args[0] && ['gpt-5', 'gpt-5-mini', 'gpt-5-nano'].includes(args[0])) {
          this.config.model = args[0] as any;
          console.log(chalk.green(`Model set to: ${this.config.model}`));
        } else {
          console.log(chalk.yellow('Usage: /model <gpt-5|gpt-5-mini|gpt-5-nano>'));
        }
        break;

      case '/reasoning':
        if (args[0] && ['low', 'medium', 'high'].includes(args[0])) {
          this.config.reasoning.effort = args[0] as any;
          console.log(chalk.green(`Reasoning effort set to: ${this.config.reasoning.effort}`));
        } else {
          console.log(chalk.yellow('Usage: /reasoning <low|medium|high>'));
        }
        break;

      case '/help':
        this.showHelp();
        break;

      default:
        console.log(chalk.red(`Unknown command: ${command}`));
    }

    return false; // Don't exit
  }

  showHistory(): void {
    if (this.sessionData.conversationHistory.length === 0) {
      console.log(chalk.yellow('No conversation history yet.'));
      return;
    }

    console.log(chalk.bold('\nCONVERSATION HISTORY:'));
    this.sessionData.conversationHistory.forEach((entry, idx) => {
      console.log(chalk.cyan(`\n[${idx + 1}] ${entry.timestamp}`));
      console.log(`  Model: ${entry.model}`);
      console.log(`  Input: ${entry.input.substring(0, 100)}...`);
      console.log(`  Output: ${entry.output.substring(0, 100)}...`);
      if (entry.usage) {
        console.log(`  Tokens: ${entry.usage.total_tokens}`);
      }
    });
  }

  showSessionInfo(): void {
    console.log(chalk.bold('\nSESSION INFO:'));
    console.log(chalk.cyan('Response ID:'), this.sessionData.lastResponseId || 'None');
    console.log(chalk.cyan('History:'), `${this.sessionData.conversationHistory.length} messages`);
    console.log(chalk.cyan('Model:'), this.config.model);
    console.log(chalk.cyan('Reasoning:'), this.config.reasoning.effort);
    console.log(chalk.cyan('Tools:'), this.config.useTools ? 'Enabled' : 'Disabled');
    console.log(chalk.cyan('Streaming:'), this.config.streaming ? 'Enabled' : 'Disabled');
    console.log(chalk.cyan('Structured:'), this.config.structuredOutput ? 'Enabled' : 'Disabled');
    console.log(chalk.cyan('Redis:'), this.redisClient ? 'Connected' : 'Not available');
  }

  showHelp(): void {
    console.log(chalk.bold('\nAVAILABLE OPTIONS:'));
    console.log('\nModels:');
    console.log('  • gpt-5      - Full model with maximum capabilities');
    console.log('  • gpt-5-mini - Balanced performance and cost');
    console.log('  • gpt-5-nano - Fastest, most economical');
    console.log('\nReasoning Levels:');
    console.log('  • low    - Quick responses, minimal reasoning');
    console.log('  • medium - Balanced reasoning (default)');
    console.log('  • high   - Deep reasoning, more thoughtful');
    console.log('\nFeatures:');
    console.log('  • Streaming      - Real-time token streaming');
    console.log('  • Tools          - Function calling and built-in tools');
    console.log('  • Structured     - JSON schema-validated outputs');
    console.log('  • Redis Session  - Persistent conversation storage');
  }
}