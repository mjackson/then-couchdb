var util = require('util');
var redis = require('then-redis');
var Cache = require('./cache');
module.exports = RedisCache;

/**
 * A concrete cache implementation that stores objects in Redis. The
 * constructor accepts all the normal options for a cache, plus a `url`
 * option that specifies the URL of the Redis database to use.
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

RedisCache.prototype.get = function (key) {
  return this.redis.get(key).then(function (json) {
    if (json) return JSON.parse(json);
  });
};

RedisCache.prototype.set = function (key, value) {
  if (this.filter(value)) {
    var json = JSON.stringify(value);
    return this.redis.psetex(key, this.ttl, json);
  }
};

RedisCache.prototype.purge = function (key) {
  if (key) {
    return this.redis.del(key);
  }

  return this.redis.flushdb();
};

RedisCache.prototype.prune = function () {
  // no-op, Redis automatically expires keys that were set using PSETEX
};
