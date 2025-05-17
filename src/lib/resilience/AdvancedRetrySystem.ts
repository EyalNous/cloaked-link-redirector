import winston from 'winston';
import { ExponentialBackoffRetry, RetryOptions, RetryContext } from './ExponentialBackoffRetry';
import { CircuitBreaker, CircuitBreakerOptions, CircuitBreakerContext } from './CircuitBreaker';
import { RetryError, CircuitBreakerOpenError } from './errors';
import appLogger from '../../utils/logger';

export interface AdvancedRetrySystemOptions {
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
    logger?: winston.Logger;
}

export class AdvancedRetrySystem {
    private retrier: ExponentialBackoffRetry;
    private circuitBreaker: CircuitBreaker;
    private logger: winston.Logger;

    constructor(options: AdvancedRetrySystemOptions = {}) {
        this.logger = options.logger || appLogger;

        const defaultRetryOptions: RetryOptions = {
            baseDelay: 200, maxDelay: 15000, maxRetries: 3, jitter: true,
            logger: this.logger,
            shouldRetry: (error: Error) => !(error instanceof CircuitBreakerOpenError)
        };
        const defaultCircuitOptions: CircuitBreakerOptions = {
            failureThreshold: 5, successThreshold: 2, timeout: 10000,
            logger: this.logger,
            isFailure: (error: Error) => !(error instanceof CircuitBreakerOpenError)
        };

        this.retrier = new ExponentialBackoffRetry({ ...defaultRetryOptions, ...(options.retry || {}) });
        this.circuitBreaker = new CircuitBreaker({ ...defaultCircuitOptions, ...(options.circuitBreaker || {}) });
    }

    public async execute<T>(
        fn: () => Promise<T>,
        context: RetryContext & CircuitBreakerContext = {}
    ): Promise<T> {
        const operationName = context.operation || 'unspecified_operation';
        const startTime = Date.now();

        try {
            const result = await this.circuitBreaker.execute(async () => {
                return await this.retrier.execute(async () => {
                    return await fn();
                }, { ...context, operation: `${operationName}_retry_attempt` });
            }, { ...context, operation: `${operationName}_cb_attempt` });

            this.logger.info({
                event: 'advanced_retry_success',
                message: `Operation ${operationName} succeeded.`,
                context,
                duration: Date.now() - startTime
            });
            return result;

        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.logger.error({
                event: 'advanced_retry_failure',
                message: `Operation ${operationName} failed after all resilience checks.`,
                context,
                duration,
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack
            });

            if (!(error instanceof CircuitBreakerOpenError) && !(error instanceof RetryError)) {
                throw new RetryError(
                    `Operation ${operationName} failed: ${error.message}`,
                    error,
                    undefined, // Attempts managed by retrier's own logs
                    duration
                );
            }
            throw error;
        }
    }
}