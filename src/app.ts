import express, { Application } from 'express';
import IORedis from 'ioredis'; // Only for type information here

// ... other imports (rateLimit, config, logger, createAppRouter, middleware)
import appConfig from './config';
import logger from './utils/logger';
import { createAppRouter } from './routes';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './lib/resilience/errors';
import rateLimit from 'express-rate-limit'; // Make sure this is imported

// The function now accepts the redisClient as an argument
export const createApp = (redisClient: IORedis): Application => {
    const app: Application = express();

    // --- Global Middlewares ---
    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    const apiLimiter = rateLimit({
        // ... your rate limit config
        windowMs: 15 * 60 * 1000,
        max: appConfig.env === 'development' ? 5000 : 1000,
        standardHeaders: true,
        legacyHeaders: false,
        message: { status: 'error', statusCode: 429, message: 'Too many requests...' },
        handler: (req, res, next, options) => {
            logger.warn(`Rate limit exceeded for IP ${req.ip}...`);
            res.status(options.statusCode).json(options.message);
        },
        skip: (req, res) => appConfig.env === 'test',
    });
    app.use('/api/v1', apiLimiter);
    app.use(requestLogger);

    // --- Mount Main Router ---
    // createAppRouter now receives the redisClient
    const mainAppRouter = createAppRouter(redisClient);
    app.use('/api/v1', mainAppRouter);

    // --- Root Path Handler ---
    app.get('/', (req, res) => {
        res.send('Traffic Redirector Service (TypeScript) is running. Try /api/v1/health');
    });

    // --- 404 Handler ---
    app.use((req, res, next) => {
        logger.warn(`404 Not Found - ${req.method} ${req.originalUrl}`);
        next(new NotFoundError(`The requested URL ${req.originalUrl} was not found.`));
    });

    // --- Global Error Handler ---
    app.use(errorHandler);

    return app;
};