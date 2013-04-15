module.exports = Cache;

/**
 * Implements a caching mechanism for CouchDB clients. This class is designed
 * to be subclassed by concrete implementations that use various storage
 * strategies to persist the cache.
 */
function Cache(options) {
  options = options || {};
  this.expiry = options.expiry || Cache.defaultExpiry;
  this.filter = options.filter || Cache.defaultFilter;
}

/**
 * The default amount of time (in ms) after which a document is considered
 * stale and purged from the cache.
 */
Cache.defaultExpiry = 1000 * 60 * 5; // Five minutes

/**
 * The default filter function that caches use to determine whether or not they
 * should cache a given value.
 */
Cache.defaultFilter = function (value) {
  return true;
};

/**
 * Retrieves the value with the given key from the cache. Returns undefined
 * if the cache has no such key. Must not return expired values.
 */
Cache.prototype.get = function (key) {
  throw new Error('Cache subclass must implement get');
};

/**
 * Stores the given value at the given key. Must use the filter function to
 * determine if a value should be stored or not.
 */
Cache.prototype.set = function (key, value) {
  throw new Error('Cache subclass must implement set');
};

/**
 * Removes the element with the given key from the cache. If no key is given,
 * the entire cache should be emptied.
 */
Cache.prototype.purge = function (key) {
  throw new Error('Cache subclass must implement purge');
};

/**
 * Removes all entries in the cache before the given date. If no date is given,
 * it should default to the current time less this cache's expiry.
 */
Cache.prototype.prune = function (before) {
  throw new Error('Cache subclass must implement prune');
};
