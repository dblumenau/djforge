import chalk from 'chalk';
import * as util from 'util';

/**
 * Format JSON with beautiful colors for console output
 */
export function formatJSON(obj: any): string {
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

/**
 * Alternative JSON formatter with custom colors
 */
export function formatJSONCustom(obj: any): string {
  const json = JSON.stringify(obj, null, 2);
  return json
    .replace(/(".*?")\s*:/g, chalk.cyan('$1:'))  // Keys in cyan
    .replace(/:\s*"(.*?)"/g, ': ' + chalk.green('"$1"'))  // String values in green
    .replace(/:\s*(\d+)/g, ': ' + chalk.yellow('$1'))  // Numbers in yellow
    .replace(/:\s*(true|false)/g, ': ' + chalk.magenta('$1'))  // Booleans in magenta
    .replace(/:\s*(null)/g, ': ' + chalk.red('$1'))  // Null in red
    .replace(/(\[|\])/g, chalk.blue('$1'))  // Arrays in blue
    .replace(/(\{|\})/g, chalk.white('$1'));  // Objects in white
}