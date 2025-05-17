import dotenv from 'dotenv';

dotenv.config();

interface AppConfig {
    env: string;
    port: number;
    redisUrl: string;
    affiliateBaseUrl: string;
    logLevel: string;
    redisRetry: {
        baseDelay: number;
        maxDelay: number;
        maxRetries: number;
    };
    redisCircuitBreaker: {
        failureThreshold: number;
        successThreshold: number;
        timeout: number;
    };
}

const config: AppConfig = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    affiliateBaseUrl: process.env.AFFILIATE_BASE_URL || 'https://affiliate-network.com',
    logLevel: process.env.LOG_LEVEL || 'info',
    redisRetry: {
        baseDelay: parseInt(process.env.REDIS_RETRY_BASE_DELAY || '250', 10),
        maxDelay: parseInt(process.env.REDIS_RETRY_MAX_DELAY || '5000', 10),
        maxRetries: parseInt(process.env.REDIS_RETRY_MAX_RETRIES || '3', 10),
    },
    redisCircuitBreaker: {
        failureThreshold: parseInt(process.env.REDIS_CB_FAILURE_THRESHOLD || '5', 10),
        successThreshold: parseInt(process.env.REDIS_CB_SUCCESS_THRESHOLD || '2', 10),
        timeout: parseInt(process.env.REDIS_CB_TIMEOUT || '15000', 10),
    }
};

export default config;