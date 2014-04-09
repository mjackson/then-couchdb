var RSVP = require('rsvp');
module.exports = describeCache;

function describeCache(cache) {
  beforeEach(function () {
    return cache.purge();
  });

  after(function () {
    return cache.destroy();
  });

  describe('when it does not contain a given key', function () {
    it('returns undefined', function () {
      return RSVP.resolve(cache.get([ 'a-key' ])).then(function (values) {
        expect(values).toEqual([ undefined ]);
      });
    });
  });

  describe('when it does contain a given key', function () {
    var value;
    beforeEach(function () {
      value = 'a value';
      return RSVP.resolve(cache.set('a-key', value));
    });

    it('returns the value of that key', function () {
      return RSVP.resolve(cache.get([ 'a-key' ])).then(function (values) {
        expect(values).toEqual([ value ]);
      });
    });
  });

  describe('when it contains many keys', function () {
    beforeEach(function () {
      return RSVP.all([
        cache.set('a', 'a'),
        cache.set('b', 'b'),
        cache.set('c', 'c')
      ]);
    });

    it('returns values for those that are defined and undefined for those that are not', function () {
      return RSVP.resolve(cache.get([ 'a', 'b', 'd' ])).then(function (values) {
        expect(values).toEqual([ 'a', 'b', undefined ]);
      });
    });
  });

  describe('when it contains a key that is expired', function () {
    beforeEach(function () {
      cache.filter = function (value) {
        return 1; // expire all values after 1ms
      };

      return RSVP.resolve(cache.set({ 'a-key': 'a value' })).then(function () {
        return wait(5);
      });
    });

    it('returns undefined', function () {
      return RSVP.resolve(cache.get([ 'a-key' ])).then(function (values) {
        expect(values).toEqual([ undefined ]);
      });
    });
  });
}
