import chalk from 'chalk';
import * as util from 'util';
import { z } from 'zod';
import { 
  Response, 
  ResponseCreateParams, 
  ResponseOutputItem, 
  ResponseOutputMessage, 
  ResponseReasoningItem 
} from 'openai/resources/responses/responses';
import { SessionData } from '../types';
import OpenAI from 'openai';

export class ResponseHandler {
  private toolValidators: Record<string, z.ZodSchema<any>>;

  constructor(toolValidators: Record<string, z.ZodSchema<any>>) {
    this.toolValidators = toolValidators;
  }

  async handleStandardResponse(
    openai: OpenAI,
    params: ResponseCreateParams, 
    startTime: number,
    input: string,
    sessionData: SessionData,
    saveSessionFn: () => Promise<void>
  ): Promise<void> {
    console.log(chalk.yellow('\n⏳ Calling OpenAI Responses API...'));
    
    const response = await openai.responses.create(params) as Response;
    const duration = Date.now() - startTime;

    console.log(chalk.green('\n' + '═'.repeat(80)));
    console.log(chalk.bold(`RESPONSE RECEIVED (${duration}ms)`));
    console.log(chalk.green('═'.repeat(80)));

    this.parseResponse(response);

    // Update session
    sessionData.lastResponseId = response.id;
    
    // Ensure conversationHistory exists
    if (!sessionData.conversationHistory) {
      sessionData.conversationHistory = [];
    }
    
    sessionData.conversationHistory.push({
      responseId: response.id,
      input: input,
      output: response.output_text || '',
      timestamp: new Date().toISOString(),
      model: response.model,
      usage: response.usage,
      hadFunctionCall: false  // Hardcoded for testing
    });
    
    await saveSessionFn();
    console.log(chalk.green(`\n✓ Session saved with ID: ${response.id}`));
  }

  parseResponse(response: Response): void {
    console.log(chalk.bold('\nRESPONSE DETAILS:'));
    console.log(chalk.cyan('ID:'), response.id);
    console.log(chalk.cyan('Model:'), response.model);
    console.log(chalk.cyan('Status:'), response.status);
    
    // Parse usage with proper types
    if (response.usage) {
      console.log(chalk.bold('\nTOKEN USAGE:'));
      console.log(`  Input tokens: ${response.usage.input_tokens || 0}`);
      console.log(`  Output tokens: ${response.usage.output_tokens || 0}`);
      console.log(`  Total tokens: ${response.usage.total_tokens || 0}`);
      
      // Detailed breakdown
      if (response.usage.input_tokens_details?.cached_tokens) {
        console.log(`  Cached tokens: ${response.usage.input_tokens_details.cached_tokens}`);
      }
      
      if (response.usage.output_tokens_details?.reasoning_tokens) {
        console.log(chalk.magenta(`  Reasoning tokens: ${response.usage.output_tokens_details.reasoning_tokens}`));
      }
    }

    // Parse output items
    if (response.output && Array.isArray(response.output)) {
      console.log(chalk.bold(`\nOUTPUT ITEMS (${response.output.length}):`));
      
      response.output.forEach((item: ResponseOutputItem, index: number) => {
        if (item.type === 'reasoning') {
          const reasoning = item as ResponseReasoningItem;
          console.log(chalk.magenta(`\n[${index + 1}] Reasoning:`));
          if (reasoning.summary && reasoning.summary.length > 0) {
            console.log(`  Summary: ${reasoning.summary.join(' ')}`);
          } else {
            console.log(chalk.dim(`  (Internal reasoning: ${response.usage?.output_tokens_details?.reasoning_tokens || 0} tokens)`));
          }
        } else if (item.type === 'message') {
          const message = item as ResponseOutputMessage;
          console.log(chalk.yellow(`\n[${index + 1}] Message:`));
          console.log(`  Role: ${message.role}`);
          console.log(`  Status: ${message.status}`);
          
          if (message.content) {
            message.content.forEach(content => {
              if ('text' in content && content.text) {
                console.log(`  Text: ${content.text}`);
              }
            });
          }
        }
      });
    }

    // Display the main output text
    if (response.output_text) {
      console.log(chalk.bold('\nASSISTANT RESPONSE:'));
      console.log(response.output_text);
    }

    // Handle tool calls
    this.parseToolCalls(response);
  }

  parseToolCalls(response: Response): void {
    if (!response.output) return;

    const toolCalls = response.output.filter(item => 
      item.type === 'function_call' || 
      item.type === 'file_search_call' || 
      item.type === 'web_search_call' ||
      item.type === 'computer_call' ||
      item.type === 'code_interpreter_call'
    );

    if (toolCalls.length === 0) return;

    console.log(chalk.bold('\nTOOL CALLS:'));
    
    toolCalls.forEach((toolCall, idx) => {
      console.log(chalk.cyan(`\n[${idx + 1}] ${toolCall.type}`));
      
      // Handle function calls specifically
      if (toolCall.type === 'function_call') {
        const functionCall = toolCall as any; // Type assertion since ResponseFunctionToolCall is complex
        console.log(`  Function: ${functionCall.name}`);
        console.log(`  Arguments: ${functionCall.arguments}`);
        
        try {
          const args = JSON.parse(functionCall.arguments);
          console.log(`  Parsed:`, args);
          
          // Runtime validation with Zod
          const validator = this.toolValidators[functionCall.name];
          if (validator) {
            try {
              const validated = validator.parse(args);
              console.log(chalk.green('  ✓ Validated successfully'));
              console.log(`  Validated args:`, validated);
            } catch (validationError) {
              if (validationError instanceof z.ZodError) {
                console.log(chalk.red('  ✗ Validation failed:'));
                validationError.errors.forEach(err => {
                  console.log(chalk.red(`    - ${err.path.join('.')}: ${err.message}`));
                });
              }
            }
          } else {
            console.log(chalk.dim('  No validator available for this function'));
          }
        } catch (e) {
          console.log(chalk.red('  Failed to parse arguments as JSON'));
        }
      }
    });
  }

  /**
   * Format JSON with beautiful colors for console output
   */
  formatJSON(obj: any): string {
    // Use util.inspect for deep, colorful output
    return util.inspect(obj, {
      colors: true,
      depth: null,
      maxArrayLength: null,
      breakLength: 80,
      compact: false,
      sorted: true
    });
  }
}