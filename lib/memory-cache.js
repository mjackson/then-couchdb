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
    var self = this;
    keys.forEach(function (key) {
      delete self.store[key];
      delete self.etimes[key];
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
  interval = interval || 5000;

  var timer = setInterval(function () {
    var now = Date.now();

    var etime;
    for (var key in cache.store) {
      etime = cache.etimes[key];
      if (!etime || etime < now) {
        cache.purge(key);
      }
    }
  }, interval);

  // Don't let this timer keep the event loop running.
  timer.unref();

  return timer;
}
