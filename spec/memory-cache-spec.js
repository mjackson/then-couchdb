require('./helper');
var describeCache = require('./describe-cache');
var MemoryCache = couchdb.MemoryCache;

describe('MemoryCache', function () {
  describeCache(new MemoryCache);
});
