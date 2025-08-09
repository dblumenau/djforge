import chalk from 'chalk';
import OpenAI from 'openai';
import { ResponseCreateParams } from 'openai/resources/responses/responses';
import { functionImplementations } from './functions';

/**
 * Function Executor for OpenAI Responses API
 * 
 * This module handles the execution of functions called by the model
 * and the submission of results back to the API, following the
 * Responses API function calling pattern.
 */

export interface FunctionCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Extract function calls from a response
 */
export function extractFunctionCalls(response: any): FunctionCall[] {
  const functionCalls: FunctionCall[] = [];
  
  if (!response.output || !Array.isArray(response.output)) {
    return functionCalls;
  }

  // Look through output items for function calls
  response.output.forEach((item: any) => {
    if (item.type === 'function_call') {
      functionCalls.push({
        id: item.call_id,
        name: item.name,
        arguments: item.arguments
      });
    }
    
    // Also check message content for tool_use
    if (item.type === 'message' && item.content && Array.isArray(item.content)) {
      item.content.forEach((content: any) => {
        if (content.type === 'tool_use') {
          functionCalls.push({
            id: content.id,
            name: content.name,
            arguments: JSON.stringify(content.input)
          });
        }
      });
    }
  });

  return functionCalls;
}

/**
 * Execute a function and return the result
 */
export async function executeFunction(functionCall: FunctionCall): Promise<any> {
  const { name, arguments: argsString } = functionCall;
  
  console.log(chalk.cyan(`\n🔧 Executing function: ${name}`));
  
  // Parse arguments
  let args: any;
  try {
    args = JSON.parse(argsString);
    console.log(chalk.dim('Arguments:'), args);
  } catch (error) {
    console.error(chalk.red(`Failed to parse arguments: ${error}`));
    return {
      error: `Failed to parse function arguments: ${error}`
    };
  }

  // Check if we have an implementation for this function
  const implementation = functionImplementations[name as keyof typeof functionImplementations];
  
  if (!implementation) {
    console.error(chalk.red(`No implementation found for function: ${name}`));
    return {
      error: `Function ${name} is not implemented`
    };
  }

  // Execute the function
  try {
    const result = await implementation(args);
    console.log(chalk.green('✓ Function executed successfully'));
    console.log(chalk.dim('Result:'), result);
    return result;
  } catch (error) {
    console.error(chalk.red(`Function execution failed: ${error}`));
    return {
      error: `Function execution failed: ${error}`
    };
  }
}

/**
 * Execute all function calls from a response and prepare the continuation input
 */
export async function executeFunctionCalls(
  response: any,
  originalInput: string | any[]
): Promise<any[]> {
  const functionCalls = extractFunctionCalls(response);
  
  if (functionCalls.length === 0) {
    return [];
  }

  console.log(chalk.yellow(`\n📦 Processing ${functionCalls.length} function call(s)...`));

  // Build the input array for the continuation
  const continuationInput: any[] = [];
  
  // Add the original input (could be string or array)
  if (typeof originalInput === 'string') {
    continuationInput.push({
      role: "user",
      content: originalInput
    });
  } else if (Array.isArray(originalInput)) {
    continuationInput.push(...originalInput);
  }

  // Add the assistant's response that contained the function calls
  if (response.output) {
    response.output.forEach((item: any) => {
      if (item.type === 'message' && item.role === 'assistant') {
        continuationInput.push({
          role: "assistant",
          content: item.content
        });
      }
    });
  }

  // Execute each function and add the results
  for (const functionCall of functionCalls) {
    const result = await executeFunction(functionCall);
    
    // Add function output to the continuation
    continuationInput.push({
      type: "function_call_output",
      call_id: functionCall.id,
      output: JSON.stringify(result)
    });
  }

  return continuationInput;
}

/**
 * Continue a conversation after function execution
 * Returns the parameters for the follow-up API call
 */
export async function continueAfterFunctions(
  openai: OpenAI,
  response: any,
  originalParams: ResponseCreateParams
): Promise<ResponseCreateParams | null> {
  const functionCalls = extractFunctionCalls(response);
  
  if (functionCalls.length === 0) {
    return null; // No functions to execute
  }

  // Execute functions and build continuation input
  const continuationInput = await executeFunctionCalls(response, originalParams.input);
  
  if (continuationInput.length === 0) {
    return null;
  }

  // Build parameters for the continuation call
  const continuationParams: ResponseCreateParams = {
    ...originalParams,
    input: continuationInput,
    // Use the response ID from the function call as previous_response_id
    previous_response_id: response.id,
    // MUST store the response so we can reference it later
    store: true
  };

  console.log(chalk.yellow('\n⏳ Continuing conversation after function execution...'));
  
  return continuationParams;
}