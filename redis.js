const redis = require('redis');
require('dotenv').config();

// Construct URL based on host/port
const redisUrl = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;

const client = redis.createClient({
    url: redisUrl
});

client.on('error', (err) => console.log('Redis Error', err));

(async () => {
    await client.connect();
    console.log(`Connected to Redis at ${process.env.REDIS_HOST}...`);
})();

module.exports = client;