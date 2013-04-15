var util = require('util');
var Cache = require('../cache');
module.exports = MemoryCache;

/**
 * A concrete cache implementation that stores objects in memory.
 */
function MemoryCache(options) {
  Cache.call(this, options);
  this.store = {};
  this.atimes = {};
}

util.inherits(MemoryCache, Cache);

MemoryCache.prototype.get = function (key) {
  var expired = new Date(Date.now() - this.expiry);
  var atime = this.atimes[key];

  if (atime && atime < expired) {
    return undefined;
  }

  if (key in this.store) {
    this.atimes[key] = new Date;
    return this.store[key];
  }

  return this.store[key];
};

MemoryCache.prototype.set = function (key, value) {
  if (this.filter(value)) {
    this.store[key] = value;
    this.atimes[key] = new Date;
  }
};

MemoryCache.prototype.purge = function (key) {
  if (key) {
    delete this.store[key];
    delete this.atimes[key];
  } else {
    this.store = {};
    this.atimes = {};
  }
};

MemoryCache.prototype.prune = function (before) {
  before = before || new Date(Date.now() - this.expiry);

  var atime;
  for (var key in this.store) {
    atime = this.atimes[key];
    if (!atime || atime < before) {
      this.purge(key);
    }
  }
};
