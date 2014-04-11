var util = require('util');
var redis = require('then-redis');
var Cache = require('./cache');
module.exports = RedisCache;

/**
 * A concrete cache implementation that stores objects in Redis. Accepts the
 * following options, in addition to those accepted by Cache:
 *
 *   url          The URL of the Redis database to use. See the then-redis docs
 *                for the format of this value.
 *
 * WARNING: It is assumed that the Redis database is dedicated to be used
 * only for this cache and nothing else. For example, when setting keys no
 * check is made to ensure that the key does not already exist. Also, when
 * purging the cache all keys may be dropped from the database.
 */
function RedisCache(options) {
  Cache.call(this, options);

  if (options && options.url) {
    this.redis = redis.createClient(options.url);
  } else {
    this.redis = redis.createClient();
  }
}

util.inherits(RedisCache, Cache);

RedisCache.prototype.get = function (keys) {
  var self = this;
  return this.redis.send('mget', keys).then(function (values) {
    return values.map(function (value) {
      if (value) {
        self.hits++;
        return JSON.parse(value);
      }
    });
  });
};

RedisCache.prototype.set = function (key, value) {
  var ttl = this.filter(value);

  if (typeof ttl === 'number' && ttl > 0)
    return this.redis.psetex(key, ttl, JSON.stringify(value));
};

RedisCache.prototype.purge = function (keys) {
  if (keys === undefined)
    return this.redis.flushdb();

  return this.redis.send('del', keys);
};

RedisCache.prototype.destroy = function () {
  return this.redis.quit();
};
