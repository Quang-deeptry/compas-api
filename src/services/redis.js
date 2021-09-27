const redis = require('redis');
const { promisify } = require('util');

const client = redis.createClient({
  port: '6379',
  host: 'localhost',
});

const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const delAsync = promisify(client.del).bind(client);
const incrAsync = promisify(client.incr).bind(client);
const expireAsync = promisify(client.expire).bind(client);
const ttlAsync = promisify(client.ttl).bind(client);

const Redis = {
  set: (key, value, expired) => {
    if (expired) {
      return setAsync(key, value, 'EX', expired);
    }
    return setAsync(key, value);
  },

  get: getAsync,

  delete: delAsync,

  incr: incrAsync,

  expire: expireAsync,

  ttl: ttlAsync,
};

module.exports = Redis;
