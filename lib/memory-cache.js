var util = require('util');
var Cache = require('./cache');
module.exports = MemoryCache;

/**
 * A concrete cache implementation that stores objects in memory. Accepts the
 * following options, in addition to those accepted by Cache:
 *
 *   interval     The interval at which the cache prunes expired entries.
 *                Defaults to 5000, or once every five seconds.
 */
function MemoryCache(options) {
  Cache.call(this, options);

  this.store = {};
  this.etimes = {};

  if (options && typeof options.interval === 'number') {
    this.timer = pruneCache(this, options.interval);
  } else {
    this.timer = pruneCache(this);
  }
}

util.inherits(MemoryCache, Cache);

MemoryCache.prototype.get = function (key) {
  var etime = this.etimes[key];

  if (!etime || etime < Date.now()) {
    return undefined;
  }

  return this.store[key];
};

MemoryCache.prototype.set = function (key, value) {
  var ttl = this.filter(value);

  if (typeof ttl === 'number' && ttl > 0) {
    this.store[key] = value;
    this.etimes[key] = Date.now() + ttl;
  }
};

MemoryCache.prototype.purge = function (key) {
  if (key) {
    delete this.store[key];
    delete this.etimes[key];
  } else {
    this.store = {};
    this.etimes = {};
  }
};

MemoryCache.prototype.destroy = function () {
  delete this.store;
  delete this.etimes;

  if (this.timer) {
    clearInterval(this.timer);
    delete this.timer;
  }
};

function pruneCache(cache, interval) {
  interval = interval || 5000;

  return setInterval(function () {
    var now = Date.now();

    var etime;
    for (var key in cache.store) {
      etime = cache.etimes[key];
      if (!etime || etime < now) {
        cache.purge(key);
      }
    }
  }, interval);
}
