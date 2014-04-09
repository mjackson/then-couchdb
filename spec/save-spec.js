require('./helper');
var RSVP = require('rsvp');
var MemoryCache = couchdb.MemoryCache;

describe('save', function () {
  describe('saving a document', function () {
    var doc;
    beforeEach(function () {
      return db.save({ message: 'hello' }).then(function (newDoc) {
        doc = newDoc;
      });
    });

    it('updates the _rev', function () {
      assert(doc);
      var rev = doc._rev;
      assert(rev);
      return db.save(doc).then(function () {
        assert(doc._rev != rev);
      });
    });
  });

  describe('saving a deleted document', function () {
    var doc;
    beforeEach(function () {
      return db.save({ message: 'hello', _deleted: true }).then(function (newDoc) {
        doc = newDoc;
      });
    });

    it('updates the _rev', function () {
      assert(doc);
      var rev = doc._rev;
      assert(rev);
      return db.save(doc).then(function () {
        assert(doc._rev != rev);
      });
    });
  });

  describe('when using a cache', function () {
    var cache;
    beforeEach(function () {
      cache = new MemoryCache;
      return db.useCache(cache);
    });

    afterEach(function () {
      return db.stopCaching();
    });

    describe('saving a document', function () {
      var doc;
      beforeEach(function () {
        return db.save({ message: 'hello' }).then(function (newDoc) {
          doc = newDoc;
        });
      });

      it('stores the document in cache', function () {
        return RSVP.resolve(cache.get([ doc._id ])).then(function (values) {
          compareDocs(values[0], doc);
        });
      });
    });

    describe('saving a deleted document', function () {
      var doc;
      beforeEach(function () {
        return db.save({ message: 'hello', _deleted: true }).then(function (newDoc) {
          doc = newDoc;
        });
      });

      it('does not store the document in cache', function () {
        return RSVP.resolve(cache.get([ doc._id ])).then(function (values) {
          expect(values).toEqual([ undefined ]);
        });
      });
    });
  });

});
