import http from 'http';
import IORedis from 'ioredis';
import logger from '../utils/logger'; // Adjust path

export const gracefulShutdown = async (signal: string, server: http.Server | undefined, redisClient: IORedis) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    // ... (rest of the shutdown logic)
};

export const setupProcessEventListeners = (server: http.Server | undefined, redisClient: IORedis) => {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    signals.forEach(signal => {
        process.on(signal, () => gracefulShutdown(signal, server, redisClient));
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
        logger.error('Unhandled Rejection at:', { promise, reason: reason?.stack || reason });
        // Consider calling gracefulShutdown here too before exiting
    });

    process.on('uncaughtException', (error: Error) => {
        logger.error('Uncaught Exception:', { message: error.message, stack: error.stack });
        // Critical: call gracefulShutdown before exiting
        if (server && server.listening) {
            gracefulShutdown('uncaughtException', server, redisClient).then(() => process.exit(1));
        } else {
             // ... logic to quit redis if server not started ...
            process.exit(1);
        }
    });
};