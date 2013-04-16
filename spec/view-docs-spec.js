require('./helper');

describe('viewDocs', function () {
  describe('when there are no docs that match the given query', function () {
    it('returns an empty array', function () {
      return db.viewDocs('spec/by-id', { keys: [ 'a', 'b', 'c' ] }).then(function (docs) {
        assert(docs);
        assert(Array.isArray(docs));
        assert.equal(docs.length, 0);
      });
    });
  });

  describe('when there are docs that match the given query', function () {
    var docs;
    beforeEach(function () {
      return db.saveAll([
        { message: 'a' },
        { message: 'b' },
        { message: 'c' }
      ]).then(function (newDocs) {
        docs = newDocs;
      });
    });

    it('returns them in order', function () {
      var keys = docs.map(function (doc) {
        return doc._id;
      });

      return db.viewDocs('spec/by-id', { keys: keys }).then(function (newDocs) {
        assert(newDocs);
        assert(Array.isArray(newDocs));
        newDocs.forEach(function (newDoc, i) {
          compareDocs(newDoc, docs[i]);
        });
      });
    });
  });
});
