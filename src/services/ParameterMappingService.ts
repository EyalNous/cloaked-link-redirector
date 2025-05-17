import crypto from 'crypto';
// Static import of nanoid is REMOVED. We will import it dynamically.

import IORedis from 'ioredis';
import logger from '../utils/logger';
import { AdvancedRetrySystem } from '../lib/resilience/AdvancedRetrySystem';
import { NotFoundError, BadRequestError, InternalServerError } from '../lib/resilience/errors';
import config from '../config';

// Define the type for customAlphabet for clarity, it will be inferred by TS from the dynamic import.
// This interface helps describe what we expect from the 'nanoid' module's customAlphabet.
interface NanoidModule {
    customAlphabet: (alphabet: string, size?: number) => () => string;
    // nanoid: () => string; // If you also needed the default nanoid generator
}

// StoredTripletData and TrafficParams interfaces remain the same
export interface TrafficParams {
    keyword: string;
    src: string;
    creative: string;
}
export interface StoredTripletData extends TrafficParams {}


export class ParameterMappingService {
    private readonly TTP_PREFIX = 'ttp:';
    private readonly PTK_PREFIX = 'ptk:';
    private retrySystem: AdvancedRetrySystem;

    // Cache for the initialized nanoid generator function
    private nanoidGenerator?: () => string;

    constructor(private redis: IORedis) {
        if (!redis) {
            throw new Error("Redis client must be provided to ParameterMappingService");
        }
        this.retrySystem = new AdvancedRetrySystem({
            retry: {
                ...config.redisRetry,
                logger: logger,
                shouldRetry: (error: Error) =>
                    !(error instanceof NotFoundError || error instanceof BadRequestError),
            },
            circuitBreaker: {
                ...config.redisCircuitBreaker,
                logger: logger,
                isFailure: (error: Error) =>
                    !(error instanceof NotFoundError || error instanceof BadRequestError),
            },
            logger: logger,
        });
    }

    private _generateTripletId(params: TrafficParams): string {
        const canonicalString = `keyword:${params.keyword.toLowerCase()}|src:${params.src.toLowerCase()}|creative:${params.creative.toLowerCase()}`;
        return crypto.createHash('sha256').update(canonicalString).digest('hex');
    }

    /**
     * Dynamically imports nanoid and initializes the customAlphabet generator.
     * Caches the generator for subsequent calls.
     */
    private async getInitializedNanoidGenerator(): Promise<() => string> {
        if (!this.nanoidGenerator) {
            try {
                // Dynamically import the nanoid ES Module
                const nanoidModule = await import('nanoid') as NanoidModule;
                // Use the customAlphabet function from the imported module
                this.nanoidGenerator = nanoidModule.customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);
                logger.info('[MappingService] Nanoid customAlphabet generator initialized.');
            } catch (error) {
                logger.error('[MappingService] Failed to dynamically import or initialize nanoid:', error);
                // Depending on how critical nanoid is, you might re-throw or have a fallback
                throw new InternalServerError('Failed to initialize ID generator.');
            }
        }
        return this.nanoidGenerator;
    }

    /**
     * Generates a new our_param using the initialized nanoid generator.
     * This method is now async because it depends on getInitializedNanoidGenerator.
     */
    private async _generateNewOurParam(): Promise<string> {
        const generator = await this.getInitializedNanoidGenerator();
        return generator();
    }

    // Methods calling _generateNewOurParam must now use 'await'

    public async getOrGenerateOurParam(params: TrafficParams): Promise<string> {
        const context = { operation: 'getOrGenerateOurParam', ...params };
        return this.retrySystem.execute(async () => {
            const tripletId = this._generateTripletId(params);
            const tripletKey = `${this.TTP_PREFIX}${tripletId}`;

            let ourParam = await this.redis.get(tripletKey);

            if (ourParam) {
                logger.debug(`[MappingService] Found existing our_param '${ourParam}' for tripletId '${tripletId}'`, context);
                return ourParam;
            }

            ourParam = await this._generateNewOurParam(); // MUST AWAIT
            const ourParamKey = `${this.PTK_PREFIX}${ourParam}`;
            const tripletData: StoredTripletData = { ...params };

            logger.info(`[MappingService] Generating new our_param '${ourParam}' for tripletId '${tripletId}'`, context);

            const pipeline = this.redis.pipeline();
            pipeline.set(tripletKey, ourParam);
            pipeline.set(ourParamKey, JSON.stringify(tripletData));
            const results = await pipeline.exec();

            if (results) {
                for (const result of results) {
                    if (result[0]) {
                        logger.error(`[MappingService] Redis pipeline error in getOrGenerateOurParam: ${result[0].message}`, { context, error: result[0] });
                        throw new InternalServerError('Failed to store mapping due to a database error.');
                    }
                }
            } else {
                 logger.error(`[MappingService] Redis pipeline returned null results in getOrGenerateOurParam`, context);
                 throw new InternalServerError('Failed to store mapping due to an unexpected database issue.');
            }

            logger.info(`[MappingService] Stored new mapping: ${tripletKey} -> ${ourParam}`, context);
            return ourParam;
        }, context);
    }

    public async refreshOurParam(params: TrafficParams): Promise<string> {
        const context = { operation: 'refreshOurParam', ...params };
        return this.retrySystem.execute(async () => {
            const tripletId = this._generateTripletId(params);
            const tripletKey = `${this.TTP_PREFIX}${tripletId}`;

            const oldOurParam = await this.redis.get(tripletKey);
            if (oldOurParam) {
                logger.info(`[MappingService] Refreshing our_param for tripletId '${tripletId}'. Old our_param: '${oldOurParam}'`, context);
            } else {
                logger.info(`[MappingService] Refresh called for a new tripletId '${tripletId}'. Generating initial our_param.`, context);
            }

            const newOurParam = await this._generateNewOurParam(); // MUST AWAIT
            const newOurParamKey = `${this.PTK_PREFIX}${newOurParam}`;
            const tripletData: StoredTripletData = { ...params };

            const pipeline = this.redis.pipeline();
            pipeline.set(tripletKey, newOurParam);
            pipeline.set(newOurParamKey, JSON.stringify(tripletData));
            const results = await pipeline.exec();

            if (results) {
                for (const result of results) {
                    if (result[0]) {
                        logger.error(`[MappingService] Redis pipeline error in refreshOurParam: ${result[0].message}`, { context, error: result[0] });
                        throw new InternalServerError('Failed to refresh mapping due to a database error.');
                    }
                }
            } else {
                 logger.error(`[MappingService] Redis pipeline returned null results in refreshOurParam`, context);
                 throw new InternalServerError('Failed to refresh mapping due to an unexpected database issue.');
            }

            logger.info(`[MappingService] Refreshed mapping: ${tripletKey} -> ${newOurParam}`, context);
            return newOurParam;
        }, context);
    }

    public async getOriginalParams(ourParam: string): Promise<StoredTripletData> {
        // This method does not use nanoid, so no changes related to nanoid are needed here.
        // (Code from previous correct version)
        if (!ourParam || typeof ourParam !== 'string' || ourParam.trim() === '') {
            logger.warn(`[MappingService] Invalid our_param for retrieval: '${ourParam}'`);
            throw new BadRequestError('Invalid our_param provided.');
        }

        const context = { operation: 'getOriginalParams', ourParam };
        return this.retrySystem.execute(async () => {
            const ourParamKey = `${this.PTK_PREFIX}${ourParam}`;
            const tripletDataString = await this.redis.get(ourParamKey);

            if (!tripletDataString) {
                logger.warn(`[MappingService] No original parameters found for our_param: '${ourParam}' (key: ${ourParamKey})`, context);
                throw new NotFoundError(`Original parameters not found for our_param: ${ourParam}`);
            }

            try {
                const tripletData = JSON.parse(tripletDataString) as StoredTripletData;
                logger.debug(`[MappingService] Retrieved original params for our_param '${ourParam}'`, context);
                return tripletData;
            } catch (parseError: any) {
                logger.error(`[MappingService] Failed to parse JSON data for ${ourParamKey}. Data: "${tripletDataString}". Error: ${parseError.message}`, { ...context, parseError: parseError.stack });
                throw new InternalServerError('Failed to parse stored triplet data.');
            }
        }, context);
    }
}