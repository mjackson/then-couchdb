require('./helper');

describe('head', function () {
  describe('when a document with the given id exists', function () {
    var doc;
    beforeEach(function () {
      return db.save({ name: 'a test' }).then(function (newDoc) {
        doc = newDoc;
        assert(doc);
      });
    });

    it('returns the document headers', function () {
      return db.head(doc._id).then(function (headers) {
        assert(headers);
        expect(headers.etag).toEqual('"' + doc._rev + '"');
      });
    });
  });

  describe('when a document with the given id does not exist', function () {
    it('returns null', function () {
      return db.head('does-not-exist').then(function (doc) {
        expect(doc).toBe(null);
      });
    });
  });
});
