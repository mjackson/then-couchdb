module.exports = Cache;

var ONE_MINUTE = 1000 * 60;

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
  this.hits = 0;
}

/**
 * The default filter function for caches. This function is used to determine
 * whether or not values should be cached. It should return a positive integer
 * to indicate the TTL for values in the cache. If it doesn't, that value is
 * not added to the cache.
 */
Cache.defaultFilter = function (value) {
  return ONE_MINUTE; // Default behavior is to cache all values.
};

/**
 * Returns an array of values of the given keys, or a promise for one. Values
 * must be undefined if the key does not exist or is expired.
 */
Cache.prototype.get = function (keys) {
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
 * Removes all given keys from the cache. If none are given (i.e. the argument
 * is undefined) all keys are removed.
 */
Cache.prototype.purge = function (keys) {
  throw new Error('Cache subclass must implement purge');
};

/**
 * Frees up any resources used by this cache.
 */
Cache.prototype.destroy = function () {};
