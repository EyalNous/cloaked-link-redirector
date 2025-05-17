import express, { Router } from 'express';
import { TrafficController } from '../controllers/traffic.controller';
import { ParameterMappingService } from '../services/ParameterMappingService';
import { validateTripletParams } from '../middleware/validateTripletParams';
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger';
import IORedis from 'ioredis';

// Specific rate limiter for more sensitive or costly operations (e.g., /refresh)
const refreshLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 refresh requests per hour (adjust as needed)
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'error',
        statusCode: 429,
        message: 'Too many refresh requests from this IP, please try again after an hour.'
    },
    handler: (req, res, next, options) => {
        logger.warn(`Refresh rate limit exceeded for IP ${req.ip}. Limit: ${options.max} per ${options.windowMs / (60 * 1000 * 60)}hr.`);
        res.status(options.statusCode).json(options.message); // Ensure this is called
    }
});


export const createTrafficRouter = (redisClient: IORedis): Router => {
    const router = express.Router();

    const parameterMappingService = new ParameterMappingService(redisClient);
    const trafficController = new TrafficController(parameterMappingService);

    /**
     * @openapi
     * /redirect:
     *   get:
     *     summary: Redirects to affiliate link with our_param.
     *     parameters:
     *       - in: query
     *         name: keyword
     *         required: true
     *         schema: { type: string }
     *       - in: query
     *         name: src
     *         required: true
     *         schema: { type: string }
     *       - in: query
     *         name: creative
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       302: { description: Redirects to affiliate link }
     *       400: { description: Missing or invalid parameters }
     *       503: { description: Service temporarily unavailable }
     */
    router.get('/redirect', validateTripletParams, trafficController.handleRedirect);

    /**
     * @openapi
     * /refresh:
     *   post:
     *     summary: Forces a new our_param for an existing parameter combination.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               keyword: { type: string }
     *               src: { type: string }
     *               creative: { type: string }
     *             required: [keyword, src, creative]
     *     responses:
     *       200: { description: Successfully refreshed our_param }
     *       400: { description: Missing or invalid parameters }
     *       429: { description: Too many requests }
     *       503: { description: Service temporarily unavailable }
     */
    router.post('/refresh', refreshLimiter, validateTripletParams, trafficController.handleRefresh);

    /**
     * @openapi
     * /retrieve_original:
     *   get:
     *     summary: Retrieves original traffic source values from our_param.
     *     parameters:
     *       - in: query
     *         name: our_param
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200: { description: Original parameters }
     *       400: { description: Missing or invalid our_param }
     *       404: { description: Parameters not found }
     *       503: { description: Service temporarily unavailable }
     */
    router.get('/retrieve_original', trafficController.handleRetrieveOriginal);

    return router;
};