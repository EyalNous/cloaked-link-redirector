import IORedis from 'ioredis';
import appConfig from '../config'; // Adjust path
import logger from '../utils/logger'; // Adjust path

const redisClient = new IORedis(appConfig.redisUrl, { /* ... options ... */ });

redisClient.on('connect', () => logger.info('[Redis] Connecting...'));
// ... other event handlers ...

export default redisClient;