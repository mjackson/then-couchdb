var util = require('util');
var Cache = require('./cache');
module.exports = MemoryCache;

/**
 * A concrete cache implementation that stores objects in memory.
 */
function MemoryCache(options) {
  Cache.call(this, options);
  this.store = {};
  this.mtimes = {};
  this.timer = pruneCache(this);
}

util.inherits(MemoryCache, Cache);

MemoryCache.prototype.get = function (key) {
  var expiry = Date.now() - this.ttl;
  var mtime = this.mtimes[key];

  if (!mtime || mtime < expiry) {
    return undefined;
  }

  return this.store[key];
};

MemoryCache.prototype.set = function (key, value) {
  if (this.filter(value)) {
    this.store[key] = value;
    this.mtimes[key] = Date.now();
  }
};

MemoryCache.prototype.purge = function (key) {
  if (key) {
    delete this.store[key];
    delete this.mtimes[key];
  } else {
    this.store = {};
    this.mtimes = {};
  }
};

MemoryCache.prototype.destroy = function () {
  delete this.store;
  delete this.mtimes;

  if (this.timer) {
    clearInterval(this.timer);
    delete this.timer;
  }
};

function pruneCache(cache, interval) {
  interval = interval || 1000;

  return setInterval(function () {
    var expiry = Date.now() - cache.ttl;

    var mtime;
    for (var key in cache.store) {
      mtime = cache.mtimes[key];
      if (!mtime || mtime < expiry) {
        cache.purge(key);
      }
    }
  }, interval);
}
