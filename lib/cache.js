var FIVE_MINUTES = 1000 * 60 * 5;
module.exports = Cache;

/**
 * Implements a caching mechanism for CouchDB clients. This class is designed
 * to be subclassed by concrete implementations that use various storage
 * strategies to persist the cache. Accepts the following options:
 *
 *   filter       A filter function for this cache. Defaults to
 *                the value of Cache.defaultFilter.
 */
function Cache(options) {
  options = options || {};
  this.filter = options.filter || Cache.defaultFilter;
}

/**
 * The default filter function for caches. This function is used to determine
 * whether or not values should be cached. It should return a positive integer
 * to indicate the TTL for values in the cache. If it doesn't, that value is
 * not added to the cache.
 */
Cache.defaultFilter = function (value) {
  return FIVE_MINUTES; // Default behavior is to cache all values.
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
 * determine the TTL for the value. If the TTL is not a positive integer the
 * value must not be cached.
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
