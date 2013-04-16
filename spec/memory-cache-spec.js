require('./helper');
var when = require('when');
var delay = require('when/delay');
var MemoryCache = couchdb.MemoryCache;

describe('MemoryCache', function () {
  var cache;
  beforeEach(function () {
    cache = new MemoryCache;
  });

  describe('when it does not contain a given key', function () {
    it('returns undefined', function () {
      return when(cache.get('a-key'), function (value) {
        assert.strictEqual(value, undefined);
      });
    });
  });

  describe('when it does contain a given key', function () {
    var value;
    beforeEach(function () {
      value = 'a value';
      return when(cache.set('a-key', value));
    });

    it('returns the value of that key', function () {
      return when(cache.get('a-key'), function (newValue) {
        assert.strictEqual(newValue, value);
      });
    });
  });

  describe('when it contains a key that is expired', function () {
    beforeEach(function () {
      cache.ttl = 1; // expire after 1ms
      return when(cache.set('a-key', 'a value')).then(function () {
        return delay(5);
      });
    });

    it('returns undefined', function () {
      return when(cache.get('a-key'), function (value) {
        assert.strictEqual(value, undefined);
      });
    });
  });
});
