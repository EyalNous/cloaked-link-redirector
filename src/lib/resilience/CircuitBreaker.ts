import winston from 'winston';
import { CircuitBreakerOpenError } from './errors';
import logger from '../../utils/logger';

enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
    failureThreshold?: number;
    successThreshold?: number;
    timeout?: number; // ms
    isFailure?: (error: Error) => boolean;
    logger?: winston.Logger;
}

export interface CircuitBreakerContext {
    operation?: string;
    [key: string]: any;
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private successCount: number = 0;
    private lastFailureTime: number | null = null;

    private failureThreshold: number;
    private successThreshold: number;
    private timeout: number;
    private isFailure: (error: Error) => boolean;
    private logger: winston.Logger;

    constructor(options: CircuitBreakerOptions = {}) {
        this.failureThreshold = options.failureThreshold ?? 5;
        this.successThreshold = options.successThreshold ?? 2;
        this.timeout = options.timeout ?? 10000;
        this.isFailure = options.isFailure ?? ((error: Error) => true);
        this.logger = options.logger ?? logger;

        this.logger.info(`[CircuitBreaker] Initialized: state=${this.state}, failureThreshold=${this.failureThreshold}, successThreshold=${this.successThreshold}, timeout=${this.timeout}ms`);
    }

    public async execute<T>(fn: () => Promise<T>, context: CircuitBreakerContext = {}): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (this.lastFailureTime && (Date.now() - this.lastFailureTime > this.timeout)) {
                this._transitionTo(CircuitState.HALF_OPEN, context);
            } else {
                this.logger.warn(`[CircuitBreaker] Circuit is OPEN for ${context.operation || 'operation'}. Request blocked.`, { context });
                throw new CircuitBreakerOpenError(`Circuit breaker is OPEN for ${context.operation || 'operation'}. Try again later.`);
            }
        }

        try {
            const result = await fn();
            this._handleSuccess(context);
            return result;
        } catch (error: any) {
            if (this.isFailure(error)) {
                this._handleFailure(error, context);
            } else {
                this.logger.info(`[CircuitBreaker] Operation ${context.operation || 'operation'} failed but not considered a breaker failure. Error: ${error.message}`, { context });
            }
            throw error;
        }
    }

    private _handleSuccess(context: CircuitBreakerContext): void {
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            this.logger.info(`[CircuitBreaker] Success in HALF_OPEN state for ${context.operation || 'operation'}. Successes: ${this.successCount}/${this.successThreshold}`, { context });
            if (this.successCount >= this.successThreshold) {
                this._transitionTo(CircuitState.CLOSED, context);
            }
        } else if (this.state === CircuitState.CLOSED && this.failureCount > 0) {
            this.logger.info(`[CircuitBreaker] Success in CLOSED state for ${context.operation || 'operation'} resets failure count.`, { context });
            this.failureCount = 0;
        }
    }

    private _handleFailure(error: Error, context: CircuitBreakerContext): void {
        this.failureCount++;
        this.logger.warn(`[CircuitBreaker] Failure for ${context.operation || 'operation'}. Current state: ${this.state}. Failures: ${this.failureCount}/${this.failureThreshold}. Error: ${error.message}`, { context, error: error.stack });

        if (this.state === CircuitState.HALF_OPEN) {
            this._transitionTo(CircuitState.OPEN, context);
        } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.failureThreshold) {
            this._transitionTo(CircuitState.OPEN, context);
        }
    }

    private _transitionTo(newState: CircuitState, context: CircuitBreakerContext): void {
        if (this.state === newState) return;

        this.logger.info(`[CircuitBreaker] Transitioning from ${this.state} to ${newState} for ${context.operation || 'operation'}.`, { context });
        this.state = newState;

        switch (newState) {
            case CircuitState.CLOSED:
                this.failureCount = 0;
                this.successCount = 0;
                break;
            case CircuitState.OPEN:
                this.lastFailureTime = Date.now();
                this.successCount = 0;
                break;
            case CircuitState.HALF_OPEN:
                this.failureCount = 0;
                this.successCount = 0;
                break;
        }
    }

    public reset(): void {
        this.logger.info('[CircuitBreaker] Circuit breaker manually reset to CLOSED.');
        this._transitionTo(CircuitState.CLOSED, { operation: 'manualReset' });
    }

    public getState(): CircuitState {
        return this.state;
    }
}