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

MemoryCache.prototype.get = function (keys) {
  var self = this;
  return keys.map(function (key) {
    var etime = self.etimes[key];
    if (etime && etime > Date.now()) {
      var value = self.store[key];
      if (value) {
        self.hits++;
        return value;
      }
    }
  });
};

MemoryCache.prototype.set = function (key, value) {
  var ttl = this.filter(value);

  if (typeof ttl === 'number' && ttl > 0) {
    this.store[key] = value;
    this.etimes[key] = Date.now() + ttl;
  }
};

MemoryCache.prototype.purge = function (keys) {
  if (keys === undefined) {
    this.store = {};
    this.etimes = {};
  } else {
    var store = this.store, etimes = this.etimes;
    keys.forEach(function (key) {
      delete store[key];
      delete etimes[key];
    });
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
  interval = interval || 30000;

  var timer = setInterval(function () {
    purgeBefore(cache, Date.now());
  }, interval);

  // Don't let this timer keep the event loop running.
  timer.unref();

  return timer;
}

function purgeBefore(cache, time) {
  var expiredKeys = Object.keys(cache.store).filter(function (key) {
    return !cache.etimes[key] || cache.etimes[key] < time;
  });

  if (expiredKeys.length)
    cache.purge(expiredKeys);
}
