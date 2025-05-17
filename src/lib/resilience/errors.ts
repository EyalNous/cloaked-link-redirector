export class BaseCustomError extends Error {
    public readonly statusCode: number;

    constructor(message: string, statusCode: number, name: string) {
        super(message);
        this.statusCode = statusCode;
        this.name = name;
        Object.setPrototypeOf(this, new.target.prototype); // Preserve prototype chain
    }
}

export class RetryError extends BaseCustomError {
    public readonly originalError?: Error;
    public readonly attempts?: number;
    public readonly duration?: number;

    constructor(message: string, originalError?: Error, attempts?: number, duration?: number) {
        super(message, 503, 'RetryError');
        this.originalError = originalError;
        this.attempts = attempts;
        this.duration = duration;
    }
}

export class CircuitBreakerOpenError extends BaseCustomError {
    constructor(message: string = 'Circuit breaker is open. The service is temporarily unavailable.') {
        super(message, 503, 'CircuitBreakerOpenError');
    }
}

export class NotFoundError extends BaseCustomError {
    constructor(message: string = 'Resource not found.') {
        super(message, 404, 'NotFoundError');
    }
}

export class BadRequestError extends BaseCustomError {
    constructor(message: string = 'Bad request due to invalid input.') {
        super(message, 400, 'BadRequestError');
    }
}

export class InternalServerError extends BaseCustomError {
    constructor(message: string = 'An unexpected internal server error occurred.') {
        super(message, 500, 'InternalServerError');
    }
}