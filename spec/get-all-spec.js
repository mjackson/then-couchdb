require('./helper');
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
        expect(newDocs.length).toEqual(1);
        expect(newDocs[0]).toBe(null);
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
        expect(cache.hits).toEqual(0);
        return db.getAll(keys).then(function (newDocs) {
          expect(cache.hits).toEqual(keys.length);
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
          expect(newDocs.length).toEqual(2);
          compareDocs(newDocs[0], docs[0]);
          expect(newDocs[1]).toBe(null);
        });
      });

      it('hits the cache for existing documents', function () {
        expect(cache.hits).toEqual(0);
        return db.getAll(keys).then(function (newDocs) {
          expect(cache.hits).toEqual(1);
        });
      });
    });
  }); // when using a cache

});
