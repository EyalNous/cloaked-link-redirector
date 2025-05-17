import winston from 'winston';
import logger from '../../utils/logger'; // Use global logger

export interface RetryOptions {
    baseDelay?: number;
    maxDelay?: number;
    maxRetries?: number;
    jitter?: boolean;
    shouldRetry?: (error: Error) => boolean;
    logger?: winston.Logger; // Allow passing a custom logger
}

export interface RetryContext {
    operation?: string;
    [key: string]: any; // For additional context
}

export class ExponentialBackoffRetry {
    private baseDelay: number;
    private maxDelay: number;
    private maxRetries: number;
    private jitter: boolean;
    private shouldRetry: (error: Error) => boolean;
    private logger: winston.Logger;

    constructor(options: RetryOptions = {}) {
        this.baseDelay = options.baseDelay ?? 200;
        this.maxDelay = options.maxDelay ?? 15000;
        this.maxRetries = options.maxRetries ?? 5;
        this.jitter = options.jitter ?? true;
        this.shouldRetry = options.shouldRetry ?? ((error: Error) => true);
        this.logger = options.logger ?? logger;
    }

    private _calculateDelay(attempt: number): number {
        let delay = Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay);
        if (this.jitter) {
            const jitterAmount = delay * 0.1;
            delay += Math.random() * (jitterAmount * 2) - jitterAmount;
        }
        return Math.max(0, Math.round(delay));
    }

    public async execute<T>(fn: () => Promise<T>, context: RetryContext = {}): Promise<T> {
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                this.logger.warn(
                    `[ExponentialBackoffRetry] Attempt ${attempt + 1} failed for ${context.operation || 'operation'}. Error: ${error.message}`,
                    { context, error: error.stack }
                );

                if (!this.shouldRetry(error) || attempt === this.maxRetries) {
                    this.logger.error(
                        `[ExponentialBackoffRetry] All retries failed or retry condition not met for ${context.operation || 'operation'} after ${attempt + 1} attempts.`,
                        { context }
                    );
                    throw error;
                }

                const delayMs = this._calculateDelay(attempt);
                this.logger.info(
                    `[ExponentialBackoffRetry] Retrying ${context.operation || 'operation'} in ${delayMs}ms (attempt ${attempt + 2}/${this.maxRetries + 1})`,
                    { context }
                );
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        // This line should technically be unreachable due to the throw in the loop
        throw new Error('Exhausted retries but error was not re-thrown.');
    }
}