require('./helper');

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
});
