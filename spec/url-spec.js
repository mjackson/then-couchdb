require('./helper');

describe('url', function () {
  var url, client;
  beforeEach(function () {
    url = 'http://localhost:5984';
    client = couchdb.createClient(url);
  });

  describe('when not using a database', function () {
    it('does not have a path', function () {
      assert.equal(client.url, url);
    });
  });

  describe('when using a database', function () {
    var database;
    beforeEach(function () {
      database = 'my-db';
      client.use(database);
    });

    it('includes the database in the path', function () {
      assert.equal(client.url, url + '/' + database);
    });
  });
});
