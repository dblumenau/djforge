import chalk from 'chalk';
import * as util from 'util';
import OpenAI from 'openai';
import { 
  ResponseCreateParams, 
  ResponseStreamEvent, 
  ResponseTextDeltaEvent, 
  ResponseErrorEvent 
} from 'openai/resources/responses/responses';
import { SessionData } from '../types';

export class StreamHandler {
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  async handleStreamingResponse(
    openai: OpenAI,
    params: ResponseCreateParams, 
    startTime: number,
    sessionData: SessionData,
    saveSessionFn: () => Promise<void>
  ): Promise<void> {
    console.log(chalk.yellow('\n⏳ Streaming from OpenAI Responses API...'));
    
    const stream = await openai.responses.create({
      ...params,
      stream: true
    });

    console.log(chalk.green('\n' + '═'.repeat(80)));
    console.log(chalk.bold('STREAMING RESPONSE'));
    console.log(chalk.green('═'.repeat(80) + '\n'));

    let fullText = '';
    let responseId = '';
    let toolCalls: any[] = [];
    let functionCalls: any[] = [];

    for await (const event of stream) {
      this.handleStreamEvent(event as ResponseStreamEvent);
      
      // Collect text for session
      if ('output_text' in event && event.output_text) {
        fullText += event.output_text;
      }
      if ('id' in event && typeof event.id === 'string') {
        responseId = event.id;
      }
      
      // Collect tool calls if present
      if ('tool_calls' in event && event.tool_calls) {
        toolCalls = Array.isArray(event.tool_calls) ? event.tool_calls : [event.tool_calls];
      }
      
      // Collect function calls from completion event
      if ('response' in event && event.response?.output) {
        const output = event.response.output;
        if (Array.isArray(output)) {
          output.forEach((item: any) => {
            if (item.type === 'function_call' || (item.content && Array.isArray(item.content))) {
              item.content?.forEach((content: any) => {
                if (content.type === 'tool_use') {
                  functionCalls.push(content);
                }
              });
            }
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(chalk.green(`\n\nStream completed (${duration}ms)`));
    
    // Display tool calls if any were made
    if (toolCalls.length > 0) {
      console.log(chalk.cyan('\n📦 Tool Calls Made:'));
      console.log(this.formatJSON(toolCalls));
    }
    
    // Display function calls if any were made
    if (functionCalls.length > 0) {
      console.log(chalk.cyan('\n🔧 Function Calls Made:'));
      console.log(this.formatJSON(functionCalls));
    }

    // Update session for streaming
    if (responseId) {
      sessionData.lastResponseId = responseId;
      
      // Add to conversation history
      if (!sessionData.conversationHistory) {
        sessionData.conversationHistory = [];
      }
      
      sessionData.conversationHistory.push({
        responseId: responseId,
        input: '', // We don't have input here, would need to pass it in
        output: fullText || '',
        timestamp: new Date().toISOString(),
        model: 'gpt-5', // Would need to get from params
        usage: undefined, // Not available in streaming
        hadFunctionCall: false  // Hardcoded for testing
      });
      
      await saveSessionFn();
    }
  }

  handleStreamEvent(event: ResponseStreamEvent): void {
    // Log all events in verbose mode to debug
    if (this.verbose) {
      console.log(chalk.dim('\n[Event Debug]:'), this.formatJSON(event));
    }
    
    // Handle different event types based on their structure
    // Note: The actual events don't have a 'type' field, they are different interfaces
    if ('delta' in event && 'content_index' in event) {
      // This is a text delta event
      const textEvent = event as ResponseTextDeltaEvent;
      process.stdout.write(textEvent.delta || '');
    } else if ('function_tool_call' in event) {
      // Function tool call event - ALWAYS show these
      console.log(chalk.cyan('\n📦 Function Call:'));
      console.log(this.formatJSON(event));
    } else if ('tool_calls' in event) {
      // Tool calls event - ALWAYS show these
      console.log(chalk.cyan('\n🔧 Tool Calls:'));
      console.log(this.formatJSON(event));
    } else if ('status' in event) {
      // This is a completion event
      if (this.verbose) {
        console.log(chalk.dim('\n[Status Update]'));
      }
    } else if ('error' in event || (event as any).type === 'error') {
      // This is an error event - ALWAYS show errors
      const errorEvent = event as ResponseErrorEvent;
      console.error(chalk.red('[Error]'), errorEvent.message || errorEvent);
    } else if ((event as any).type === 'response.content_part.done') {
      // Check if this is a tool use
      const part = (event as any).part;
      if (part?.type === 'tool_use') {
        console.log(chalk.cyan('\n🔧 Tool Use:'));
        console.log(chalk.cyan(`  Tool: ${part.name}`));
        console.log(chalk.cyan(`  Input:`), this.formatJSON(part.input));
      }
    } else if ((event as any).type === 'response.completed') {
      // Response completed - check for function calls in output
      const response = (event as any).response;
      if (response?.output) {
        response.output.forEach((item: any) => {
          if (item.type === 'message' && item.content) {
            item.content.forEach((content: any) => {
              if (content.type === 'tool_use') {
                console.log(chalk.cyan('\n📦 Function Call in Response:'));
                console.log(chalk.cyan(`  Function: ${content.name}`));
                console.log(chalk.cyan(`  ID: ${content.id}`));
                console.log(chalk.cyan(`  Input:`), this.formatJSON(content.input));
              }
            });
          }
        });
      }
    } else {
      // Unknown event type - handle specific cases
      const eventType = (event as any).type;
      
      // Show function/tool completion events but NOT deltas (unless verbose)
      if (eventType === 'response.function_call_arguments.done') {
        // Function call arguments complete - show this
        const args = (event as any).arguments;
        console.log(chalk.cyan('\n🔧 Function Call Complete:'));
        try {
          const parsed = JSON.parse(args);
          console.log(chalk.cyan(`  Function: ${parsed.responseMessage ? 'provide_music_alternatives' : 'unknown'}`));
          console.log(chalk.cyan('  Arguments:'), this.formatJSON(parsed));
        } catch (e) {
          console.log(chalk.cyan('  Raw Arguments:'), args);
        }
      } else if (eventType === 'response.function_call_arguments.delta') {
        // Skip deltas unless verbose mode
        if (this.verbose) {
          console.log(chalk.dim(`[${eventType}]:`), this.formatJSON(event));
        }
      } else if (eventType?.includes('tool') || (eventType?.includes('function') && !eventType.includes('delta'))) {
        // Show other tool/function events that aren't deltas
        console.log(chalk.yellow(`\n[${eventType}]:`), this.formatJSON(event));
      } else if (this.verbose) {
        console.log(chalk.dim('[Unknown Event]:'), this.formatJSON(event));
      }
    }
  }

  /**
   * Format JSON with beautiful colors for console output
   */
  private formatJSON(obj: any): string {
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