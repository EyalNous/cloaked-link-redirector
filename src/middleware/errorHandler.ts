import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import appConfig from '../config';
import { BaseCustomError, RetryError, CircuitBreakerOpenError, NotFoundError, BadRequestError } from '../lib/resilience/errors';

export const errorHandler = (err: Error | BaseCustomError, req: Request, res: Response, next: NextFunction): void => {
    // If headers already sent, delegate to default Express error handler
    if (res.headersSent) {
        return next(err);
    }

    let statusCode = 500;
    let message = 'An unexpected internal server error occurred.';
    const errorName = err.name;

    if (err instanceof BaseCustomError) {
        statusCode = err.statusCode;
        message = err.message;
    } else if (err.name === 'SyntaxError' && 'body' in err && err.message.includes('JSON')) { // Express JSON parsing error
        statusCode = 400;
        message = 'Invalid JSON payload.';
    }
    // Add more specific error checks if needed

    logger.error(`Error processing request ${req.method} ${req.originalUrl}: ${err.message}`, {
        errorName,
        errorMessage: err.message,
        statusCode,
        stack: err.stack, // Log full stack regardless of environment for debugging
        requestBody: req.body,
        requestQuery: req.query,
        ip: req.ip
    });
    
    // For 500 errors in production, don't send stack trace or overly detailed messages to client
    if (statusCode === 500 && appConfig.env === 'production') {
        message = 'An unexpected internal server error occurred.';
    }

    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message,
        ...(appConfig.env === 'development' && { stack: err.stack }),
    });
};