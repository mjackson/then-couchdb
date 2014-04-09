require('./helper');
var RSVP = require('rsvp');
var MemoryCache = couchdb.MemoryCache;

describe('saveAll', function () {
  describe('saving many documents', function () {
    var docs;
    beforeEach(function () {
      return db.saveAll([
        { name: 'one' },
        { name: 'two' }
      ]).then(function (newDocs) {
        docs = newDocs;
      });
    });

    it('updates the _rev of all documents', function () {
      var revs = docs.map(getRev);
      return db.saveAll(docs).then(function (newDocs) {
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
      return db.saveAll([
        { name: 'one', _deleted: true },
        { name: 'two', _deleted: true }
      ]).then(function (newDocs) {
        docs = newDocs;
      });
    });

    it('updates the _rev of all documents', function () {
      var revs = docs.map(getRev);
      return db.saveAll(docs).then(function (newDocs) {
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
      return db.useCache(cache);
    });

    afterEach(function () {
      return db.stopCaching();
    });

    describe('saving documents', function () {
      var docs;
      beforeEach(function () {
        return db.saveAll([
          { name: 'one' },
          { name: 'two' }
        ]).then(function (newDocs) {
          docs = newDocs;
        });
      });

      it('stores them in cache', function () {
        var keys = docs.map(function (doc) {
          return doc._id;
        });

        return RSVP.resolve(cache.get(keys)).then(function (values) {
          values.forEach(function (value, i) {
            compareDocs(value, docs[i]);
          });
        });
      });
    });

    describe('saving deleted documents', function () {
      var docs;
      beforeEach(function () {
        return db.saveAll([
          { name: 'one', _deleted: true },
          { name: 'two', _deleted: true }
        ]).then(function (newDocs) {
          docs = newDocs;
        });
      });

      it('does not store them in cache', function () {
        var keys = docs.map(function (doc) {
          return doc._id;
        });

        return RSVP.resolve(cache.get(keys)).then(function (values) {
          values.forEach(function (value) {
            assert.equal(value, undefined);
          });
        });
      });
    });

  }); // when using a cache
});

function getRev(doc) {
  assert(doc);
  assert(doc._rev);
  return doc._rev;
}
