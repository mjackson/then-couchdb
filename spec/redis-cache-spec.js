require('./helper');
var describeCache = require('./describe-cache');
var RedisCache = couchdb.RedisCache;

describe('RedisCache', function () {
  describeCache(new RedisCache);
});
