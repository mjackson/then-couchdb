require('./helper');

describe('view', function () {
  describe('a non-existent view', function () {
    it('throws', function () {
      return db.view('spec/does-not-exist').then(function () {
        assert(false, 'viewing a non-existent view succeeded');
      }, function (error) {
        assert(error);
      });
    });
  });

  describe('when there are no documents in a view', function () {
    it('returns no rows', function () {
      return db.view('spec/by-id').then(function (view) {
        assert(view);
        expect(view.total_rows).toEqual(0);
        expect(view.rows).toEqual([]);
      });
    });
  });
});
