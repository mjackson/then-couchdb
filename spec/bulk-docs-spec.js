require('./helper');
var when = require('when');
var MemoryCache = couchdb.MemoryCache;

describe('bulkDocs', function () {
  describe('saving many documents', function () {
    var docs;
    beforeEach(function () {
      return db.bulkDocs([
        { name: 'one' },
        { name: 'two' }
      ]).then(function (newDocs) {
        docs = newDocs;
      });
    });

    it('updates the _rev of all documents', function () {
      var revs = docs.map(getRev);
      return db.bulkDocs(docs).then(function (newDocs) {
        var newRevs = newDocs.map(getRev);
        newRevs.forEach(function (rev, i) {
          assert.notEqual(rev, revs[i]);
        });
      });
    });
  });

  describe('saving deleted documents', function () {
    var docs;
    beforeEach(function () {
      return db.bulkDocs([
        { name: 'one', _deleted: true },
        { name: 'two', _deleted: true }
      ]).then(function (newDocs) {
        docs = newDocs;
      });
    });

    it('updates the _rev of all documents', function () {
      var revs = docs.map(getRev);
      return db.bulkDocs(docs).then(function (newDocs) {
        var newRevs = newDocs.map(getRev);
        newRevs.forEach(function (rev, i) {
          assert.notEqual(rev, revs[i]);
        });
      });
    });
  });

  describe('when using a cache', function () {
    var cache;
    beforeEach(function () {
      cache = new MemoryCache;
      db.useCache(cache);
    });

    afterEach(function () {
      db.stopCaching();
    });

    describe('saving documents', function () {
      var docs;
      beforeEach(function () {
        return db.bulkDocs([
          { name: 'one' },
          { name: 'two' }
        ]).then(function (newDocs) {
          docs = newDocs;
        });
      });

      it('stores them in cache', function () {
        var promises = docs.map(function (doc) {
          return cache.get(doc._id);
        });

        return when.all(promises).then(function (values) {
          values.forEach(function (value, i) {
            compareDocs(value, docs[i]);
          });
        });
      });
    });

    describe('saving deleted documents', function () {
      it('does not store them in cache');
    });

  }); // when using a cache
});

function getRev(doc) {
  assert(doc);
  assert(doc._rev);
  return doc._rev;
}
