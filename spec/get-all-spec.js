require('./helper');
var when = require('when');
var MemoryCache = couchdb.MemoryCache;

describe('getAll', function () {
  describe('when all documents with the given keys exist', function () {
    var docs, keys;
    beforeEach(function () {
      return db.saveAll([
        { name: 'one' },
        { name: 'two' }
      ]).then(function (newDocs) {
        docs = newDocs;
        keys = docs.map(function (doc) {
          return doc._id;
        });
      });
    });

    it('finds all documents', function () {
      return db.getAll(keys).then(function (newDocs) {
        newDocs.forEach(function (newDoc, index) {
          compareDocs(newDoc, docs[index]);
        });
      });
    });
  });

  describe('when a key is missing', function () {
    it('returns null', function () {
      return db.getAll([ 'does-not-exist' ]).then(function (newDocs) {
        assert.equal(newDocs.length, 1);
        assert.strictEqual(newDocs[0], null);
      });
    });
  });

  describe('when using a cache', function () {
    beforeEach(function () {
      return db.useCache(new MemoryCache);
    });

    afterEach(function () {
      return db.stopCaching();
    });

    describe('when all documents with the given keys exist', function () {
      var docs, keys;
      beforeEach(function () {
        // This call warms the cache.
        return db.saveAll([
          { name: 'one' },
          { name: 'two' }
        ]).then(function (newDocs) {
          docs = newDocs;
          keys = docs.map(function (doc) {
            return doc._id;
          });
        });
      });

      it('finds all documents', function () {
        return db.getAll(keys).then(function (newDocs) {
          newDocs.forEach(function (newDoc, index) {
            compareDocs(newDoc, docs[index]);
          });
        });
      });

      it('hits the cache', function () {
        assert.equal(db.cacheHits, 0);
        return db.getAll(keys).then(function (newDocs) {
          assert.equal(db.cacheHits, keys.length);
        });
      });
    });

    describe('when a key is missing', function () {
      var docs, keys;
      beforeEach(function () {
        return db.saveAll([ { name: 'one' } ]).then(function (newDocs) {
          docs = newDocs;
          keys = docs.map(function (doc) {
            return doc._id;
          }).concat([ 'does-not-exist' ]);
        });
      });

      it('returns the existing documents and null for the missing document', function () {
        return db.getAll(keys).then(function (newDocs) {
          assert.equal(newDocs.length, 2);
          compareDocs(newDocs[0], docs[0]);
          assert.strictEqual(newDocs[1], null);
        });
      });

      it('hits the cache for existing documents', function () {
        assert.equal(db.cacheHits, 0);
        return db.getAll(keys).then(function (newDocs) {
          assert.equal(db.cacheHits, 1);
        });
      });
    });
  }); // when using a cache

});
