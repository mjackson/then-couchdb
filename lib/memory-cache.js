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
}

util.inherits(MemoryCache, Cache);

MemoryCache.prototype.get = function (key) {
  var expiry = Date.now() - this.ttl;
  var mtime = this.mtimes[key];

  if (mtime && mtime < expiry) {
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

MemoryCache.prototype.prune = function (before) {
  before = before || Date.now() - this.ttl;

  if (before instanceof Date) {
    before = before.getTime();
  }

  var mtime;
  for (var key in this.store) {
    mtime = this.mtimes[key];
    if (!mtime || mtime < before) {
      this.purge(key);
    }
  }
};
