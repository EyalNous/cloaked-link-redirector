import { Response, NextFunction } from 'express';
import { ValidatedTripletRequest } from '../controllers/traffic.controller'; // Import the extended Request type
import { BadRequestError } from '../lib/resilience/errors';
import logger from '../utils/logger';

export const validateTripletParams = (req: ValidatedTripletRequest, res: Response, next: NextFunction): void => {
    // Determine if params are in query (GET) or body (POST)
    const source = (req.method === 'GET' || req.method === 'DELETE') ? req.query : req.body;
    const { keyword, src, creative } = source;

    if (!keyword || !src || !creative) {
        const missing: string[] = [];
        if (!keyword) missing.push('keyword');
        if (!src) missing.push('src');
        if (!creative) missing.push('creative');
        const errorMessage = `Missing required parameters: ${missing.join(', ')}.`;
        logger.warn(`[ValidateTriplet] ${errorMessage} Received: k=${keyword},s=${src},c=${creative}`);
        return next(new BadRequestError(errorMessage));
    }

    if (typeof keyword !== 'string' || typeof src !== 'string' || typeof creative !== 'string') {
        const errorMessage = 'Parameters keyword, src, and creative must be strings.';
        logger.warn(`[ValidateTriplet] ${errorMessage} Received types: k=${typeof keyword},s=${typeof src},c=${typeof creative}`);
        return next(new BadRequestError(errorMessage));
    }
    
    if (keyword.length > 255 || src.length > 255 || creative.length > 255) {
        const errorMessage = 'Parameters keyword, src, and creative exceed maximum length of 255 characters.';
        logger.warn(`[ValidateTriplet] ${errorMessage}`);
        return next(new BadRequestError(errorMessage));
    }

    // Attach validated params to the request object for the controller
    req.tripletParams = { keyword, src, creative };
    next();
};