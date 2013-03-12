require('./helper');

describe('viewDoc', function () {
  describe('when a document that matches the given query does not exist', function () {
    it('returns null', function () {
      return db.viewDoc('spec/by-id', { key: 'does-not-exist' }).then(function (doc) {
        assert.strictEqual(doc, null);
      });
    });
  });

  describe('when a document that matches the given query exists', function () {
    var doc;
    beforeEach(function () {
      return db.save({ message: 'hello world' }).then(function (newDoc) {
        doc = newDoc;
      });
    });

    it('returns the document', function () {
      return db.viewDoc('spec/by-id', { key: doc._id }).then(function (newDoc) {
        compareDocs(newDoc, doc);
      });
    });
  });
});
