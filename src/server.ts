import http from 'http';
import IORedis from 'ioredis'; // Or your redisClient module

import appConfig from './config';
import logger from './utils/logger';
import { createApp } from './app';
// Import the shutdown utilities
import { setupProcessEventListeners, gracefulShutdown } from './lib/shutdown'; // Adjust path

// This variable will hold the server instance once it's created
let serverInstance: http.Server | undefined;

// --- Initialize Redis Client ---
const redisClient = new IORedis(appConfig.redisUrl, { /* ... your options ... */ });
redisClient.on('connect', () => logger.info('[Redis] Initiating connection...'));
redisClient.on('ready', () => logger.info('[Redis] Redis client ready.'));
redisClient.on('error', (err: Error) => logger.error('[Redis] Client error:', { message: err.message }));
// ... other redis event listeners

// --- Create Express App ---
const app = createApp(redisClient);

// --- Start Server ---
const startHttpServer = () => {
    serverInstance = http.createServer(app).listen(appConfig.port, () => {
        logger.info(`Server running in ${appConfig.env} mode on port ${appConfig.port}`);
        // Now that serverInstance is defined, set up process event listeners
        // This ensures that the shutdown logic has the correct server instance.
        setupProcessEventListeners(serverInstance, redisClient);
    });

    serverInstance.on('error', (error: NodeJS.ErrnoException) => {
        logger.error(`[Server] Failed to start server on port ${appConfig.port}:`, error);
        // If server fails to start, a graceful shutdown might still be needed for Redis
        // or other resources. However, setupProcessEventListeners might not have been called.
        // A simple exit might be okay here, or a more direct shutdown call if Redis is up.
        if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
            gracefulShutdown('serverStartupError', undefined, redisClient); // Attempt to close redis
        }
        process.exit(1); // Or handle differently
    });
};

// --- Initialize and Start ---
startHttpServer();