import { Request, Response, NextFunction } from 'express';
import { ParameterMappingService, TrafficParams } from '../services/ParameterMappingService';
import { BadRequestError } from '../lib/resilience/errors';
import appConfig from '../config'; // Renamed to avoid conflict with 'config' variable name
import logger from '../utils/logger';

export interface ValidatedTripletRequest extends Request {
    tripletParams?: TrafficParams; // Populated by middleware
}

export class TrafficController {
    constructor(private parameterMappingService: ParameterMappingService) {}

    // Using arrow functions to automatically bind 'this'
    public handleRedirect = async (req: ValidatedTripletRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.tripletParams) {
            // This should ideally be caught by middleware, but as a safeguard:
            return next(new BadRequestError('Required triplet parameters are missing from the request.'));
        }
        const { keyword, src, creative } = req.tripletParams;
        try {
            const ourParam = await this.parameterMappingService.getOrGenerateOurParam({ keyword, src, creative });
            
            const redirectUrl = new URL(appConfig.affiliateBaseUrl);
            redirectUrl.searchParams.set('our_param', ourParam);

            logger.info(`[TrafficController] Redirecting to: ${redirectUrl.toString()}`);
            res.redirect(302, redirectUrl.toString());
        } catch (error) {
            logger.warn(`[TrafficController] Error in handleRedirect for (${keyword},${src},${creative}): ${(error as Error).message}`);
            next(error);
        }
    };

    public handleRefresh = async (req: ValidatedTripletRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.tripletParams) {
            return next(new BadRequestError('Required triplet parameters are missing from the request.'));
        }
        const { keyword, src, creative } = req.tripletParams;
        try {
            const newOurParam = await this.parameterMappingService.refreshOurParam({ keyword, src, creative });
            res.json({ message: 'Parameter refreshed successfully', our_param: newOurParam });
        } catch (error) {
            logger.warn(`[TrafficController] Error in handleRefresh for (${keyword},${src},${creative}): ${(error as Error).message}`);
            next(error);
        }
    };

    public handleRetrieveOriginal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const our_param = req.query.our_param as string | undefined; // Type assertion
        
        // Validation moved here, as it's specific to this endpoint's query param
        if (!our_param || typeof our_param !== 'string' || our_param.trim() === '') {
            return next(new BadRequestError('Missing or invalid our_param query parameter.'));
        }

        try {
            const originalParams = await this.parameterMappingService.getOriginalParams(our_param);
            res.json(originalParams);
        } catch (error) {
            logger.warn(`[TrafficController] Error in handleRetrieveOriginal for our_param (${our_param}): ${(error as Error).message}`);
            next(error);
        }
    };
}