require('./helper');

describe('uuids', function () {
  describe('when asked for 5 uuids', function () {
    var uuids;
    beforeEach(function () {
      return db.uuids(5).then(function (array) {
        uuids = array;
      });
    });

    it('returns 5 uuids', function () {
      assert.equal(uuids.length, 5);
    });

    describe('and then 20 more', function () {
      beforeEach(function () {
        return db.uuids(20).then(function (array) {
          uuids = array;
        });
      });

      it('returns 20 uuids', function () {
        assert.equal(uuids.length, 20);
      });
    });
  });
});
