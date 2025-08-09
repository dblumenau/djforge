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
import { extractFunctionCalls, continueAfterFunctions } from '../tools/function-executor';

export class StreamHandler {
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  /**
   * Recursively handle function calls in streaming mode until we get a final response
   */
  private async handleFunctionCallsRecursively(
    openai: OpenAI,
    response: any,
    originalParams: ResponseCreateParams,
    depth: number
  ): Promise<{ response: any; responseId: string; fullText: string }> {
    // Safety check to prevent infinite recursion
    const MAX_DEPTH = 10;
    if (depth >= MAX_DEPTH) {
      console.log(chalk.yellow(`\n⚠️ Maximum function call depth (${MAX_DEPTH}) reached, stopping recursion`));
      return {
        response,
        responseId: response.id || '',
        fullText: response.output_text || ''
      };
    }

    // Check if we need to execute functions and continue
    const functionCalls = extractFunctionCalls(response);
    if (functionCalls.length === 0) {
      // No function calls, this is our final response
      return {
        response,
        responseId: response.id || '',
        fullText: response.output_text || ''
      };
    }

    console.log(chalk.yellow(`\n📦 Found ${functionCalls.length} function call(s) to execute at depth ${depth}...`));
    
    // Get continuation parameters after executing functions
    const continuationParams = await continueAfterFunctions(openai, response, originalParams);
    
    if (!continuationParams) {
      // No continuation needed, return current response
      return {
        response,
        responseId: response.id || '',
        fullText: response.output_text || ''
      };
    }

    // Make the continuation call with streaming
    console.log(chalk.yellow(`\n⏳ Streaming continuation response at depth ${depth + 1}...`));
    
    const continuationStream = await openai.responses.create({
      ...continuationParams,
      stream: true
    });
    
    console.log(chalk.green('\n' + '═'.repeat(80)));
    console.log(chalk.bold(`CONTINUATION RESPONSE (DEPTH ${depth + 1})`));
    console.log(chalk.green('═'.repeat(80) + '\n'));
    
    let continuationResponse: any = null;
    let continuationResponseId = '';
    let continuationFullText = '';
    
    // Process the continuation stream
    for await (const event of continuationStream) {
      this.handleStreamEvent(event as ResponseStreamEvent);
      
      // Collect text for session
      if ('output_text' in event && event.output_text) {
        continuationFullText += event.output_text;
      }
      if ('id' in event && typeof event.id === 'string') {
        continuationResponseId = event.id;
      }
      
      // Store the complete response when we get it
      if (event.type === 'response.completed' && event.response) {
        continuationResponse = event.response;
        if (event.response.id) {
          continuationResponseId = event.response.id;
        }
        if (event.response.output_text) {
          continuationFullText = event.response.output_text;
        }
      }
    }
    
    console.log(chalk.green(`\n\nContinuation stream completed at depth ${depth + 1}`));
    
    // Recursively handle any function calls in the continuation response
    return await this.handleFunctionCallsRecursively(
      openai,
      continuationResponse,
      originalParams,
      depth + 1
    );
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
    let completeResponse: any = null; // Store the complete response for function execution

    for await (const event of stream) {
      this.handleStreamEvent(event as ResponseStreamEvent);
      
      // Collect text for session
      if ('output_text' in event && event.output_text) {
        fullText += event.output_text;
      }
      if ('id' in event && typeof event.id === 'string') {
        responseId = event.id;
      }
      
      // Store the complete response when we get it
      if (event.type === 'response.completed' && event.response) {
        completeResponse = event.response;
        if (event.response.id) {
          responseId = event.response.id;
        }
        if (event.response.output_text) {
          fullText = event.response.output_text;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(chalk.green(`\n\nStream completed (${duration}ms)`));
    
    // Handle function calls recursively
    if (completeResponse) {
      const finalResponse = await this.handleFunctionCallsRecursively(
        openai, 
        completeResponse, 
        params,
        0
      );
      
      // Update with final response data
      completeResponse = finalResponse.response;
      responseId = finalResponse.responseId;
      fullText = finalResponse.fullText;
    }

    // Update session for streaming
    if (responseId) {
      sessionData.lastResponseId = responseId;
      
      // Add to conversation history
      if (!sessionData.conversationHistory) {
        sessionData.conversationHistory = [];
      }
      
      // Get input from params - it's the raw input string or object
      const input = typeof params.input === 'string' ? params.input : JSON.stringify(params.input);
      
      sessionData.conversationHistory.push({
        responseId: responseId,
        input: input,
        output: fullText || '',
        timestamp: new Date().toISOString(),
        model: params.model || 'gpt-5-nano',
        usage: undefined // Not available in streaming
      });
      
      await saveSessionFn();
      console.log(chalk.green(`\n✓ Session saved with ID: ${responseId}`));
    } else {
      console.log(chalk.yellow('\n⚠️ Warning: No response ID received from stream'));
      console.log(chalk.dim('This may prevent conversation continuity'));
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