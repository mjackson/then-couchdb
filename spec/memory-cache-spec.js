require('./helper');
var describeCache = require('./describe-cache');

describe('MemoryCache', function () {
  describeCache(couchdb.MemoryCache);
});
