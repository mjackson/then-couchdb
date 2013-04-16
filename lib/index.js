var Cache = require('./cache');
var Client = require('./client');
var MemoryCache = require('./memory-cache');
var RedisCache = require('./redis-cache');
var utils = require('./utils');
var couchdb = module.exports;

couchdb.Cache = Cache;
couchdb.Client = Client;
couchdb.MemoryCache = MemoryCache;
couchdb.RedisCache = RedisCache;
couchdb.utils = utils;

couchdb.createClient = createClient;
function createClient(options) {
  return new Client(options);
}

couchdb.createCache = createCache;
function createCache(options) {
  options = options || {};

  var type = options.type || 'memory';
  delete options.type;

  if (type === 'memory') {
    return new MemoryCache(options);
  }

  throw new Error('Unknown cache type: ' + type);
}

// These are also very useful.
couchdb.docsAreEqual = utils.docsAreEqual;
couchdb.docToJson = utils.docToJson;
