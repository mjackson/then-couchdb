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
      expect(uuids.length).toEqual(5);
    });

    describe('and then 20 more', function () {
      beforeEach(function () {
        return db.uuids(20).then(function (array) {
          uuids = array;
        });
      });

      it('returns 20 uuids', function () {
        expect(uuids.length).toEqual(20);
      });
    });
  });
});

describe('uuid', function () {
  it('returns a new UUID', function () {
    return db.uuid().then(function (uuid) {
      expect(typeof uuid).toEqual('string');
    });
  });
});
