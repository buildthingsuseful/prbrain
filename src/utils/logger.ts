import * as core from '@actions/core';

export class Logger {
  private context: string;

  constructor(context: string = 'PRBrain') {
    this.context = context;
  }

  info(message: string, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage('INFO', message, args);
    core.info(formattedMessage);
  }

  warning(message: string, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage('WARN', message, args);
    core.warning(formattedMessage);
  }

  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage('ERROR', message, args);
    if (error instanceof Error) {
      core.error(`${formattedMessage}: ${error.message}`);
      if (error.stack) {
        core.error(error.stack);
      }
    } else if (error) {
      core.error(`${formattedMessage}: ${String(error)}`);
    } else {
      core.error(formattedMessage);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage('DEBUG', message, args);
    core.debug(formattedMessage);
  }

  group<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return core.group(`[${this.context}] ${name}`, fn);
  }

  private formatMessage(level: string, message: string, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` | ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ')}` : '';
    
    return `[${timestamp}] [${this.context}] [${level}] ${message}${formattedArgs}`;
  }

  createChild(childContext: string): Logger {
    return new Logger(`${this.context}:${childContext}`);
  }
}

export const logger = new Logger();