require('./helper');

describe('get', function () {
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
      return db.get(doc._id).then(function (newDoc) {
        assert(newDoc);
        compareDocs(newDoc, doc);
      });
    });
  });

  describe('when a document with the given key does not exist', function () {
    it('returns null', function () {
      return db.get('does-not-exist').then(function (doc) {
        assert.strictEqual(doc, null);
      });
    });
  });
});
