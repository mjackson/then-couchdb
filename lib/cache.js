var FIVE_MINUTES = 1000 * 60 * 5;
module.exports = Cache;

/**
 * Implements a caching mechanism for CouchDB clients. This class is designed
 * to be subclassed by concrete implementations that use various storage
 * strategies to persist the cache. Accepts the following options:
 *
 * - ttl      The amount of time (in ms) after being set when a cached
 *            value is considered stale
 * - filter   A function to use to determine whether or not the cache
 *            should store a value. This function takes one argument, a
 *            value, and should return a truthy value if the cache should
 *            store that value
 */
function Cache(options) {
  options = options || {};
  this.ttl = options.ttl || Cache.defaultTTL;
  this.filter = options.filter || Cache.defaultFilter;
}

/**
 * The default TTL for caches.
 */
Cache.defaultTTL = FIVE_MINUTES;

/**
 * The default filter function for caches.
 */
Cache.defaultFilter = function (value) {
  return true; // Accept any value.
};

/**
 * Returns the value of the given key, or a promise for it, which must be
 * undefined if the cache has no such key. Must not return expired values.
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
