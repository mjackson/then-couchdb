require('./helper');
var when = require('when');
var MemoryCache = couchdb.MemoryCache;

describe('getKey', function () {
  describe('when a document with the given key exists', function () {
    var doc;
    beforeEach(function () {
      return db.save({ name: 'a test' }).then(function (newDoc) {
        doc = newDoc;
        assert(doc);
      });
    });

    it('returns the document', function () {
      assert(doc._id);
      return db.getKey(doc._id).then(function (newDoc) {
        assert(newDoc);
        compareDocs(newDoc, doc);
      });
    });
  });

  describe('when a document with the given key does not exist', function () {
    it('returns null', function () {
      return db.getKey('does-not-exist').then(function (doc) {
        assert.strictEqual(doc, null);
      });
    });
  });

  describe('when using a cache', function () {
    beforeEach(function () {
      db.useCache(new MemoryCache);
    });

    afterEach(function () {
      db.stopCaching();
    });

    describe('when a document with the given key exists', function () {
      var doc;
      beforeEach(function () {
        // This call warms the cache.
        return db.save({ name: 'a test' }).then(function (newDoc) {
          doc = newDoc;
          assert(doc);
        });
      });

      it('returns the document', function () {
        return db.getKey(doc._id).then(function (newDoc) {
          assert(newDoc);
          compareDocs(newDoc, doc);
        });
      });

      it('hits the cache', function () {
        assert.equal(db.cacheHits, 0);
        return db.getKey(doc._id).then(function (newDoc) {
          assert.equal(db.cacheHits, 1);
        });
      });
    });

    describe('when a document with the given key does not exist', function () {
      it('returns null', function () {
        return db.getKey('does-not-exist').then(function (doc) {
          assert.strictEqual(doc, null);
        });
      });
    });
  }); // when using a cache

});
