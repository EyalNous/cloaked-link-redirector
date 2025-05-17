import express, { Router, Request, Response } from 'express';
import IORedis from 'ioredis';
import { createTrafficRouter } from './traffic.routes'; // Note the .js for compiled output if not using path aliases
import appConfig from '../config';
import logger from '../utils/logger';

export const createAppRouter = (redisClient: IORedis): Router => {
    const router = express.Router();

    // Mount specific routers
    router.use('/', createTrafficRouter(redisClient)); // Or a prefix like /traffic

    // Health check endpoint
    router.get('/health', (req: Request, res: Response) => {
        const healthStatus = {
            status: 'UP',
            timestamp: new Date().toISOString(),
            redis: 'disconnected' // Default
        };
        if (redisClient && redisClient.status === 'ready') {
            healthStatus.redis = 'connected';
        } else if (redisClient) {
            healthStatus.redis = redisClient.status;
        }
        res.status(200).json(healthStatus);
    });

    return router;
};