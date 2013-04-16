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

// These are also very useful.
couchdb.docsAreEqual = utils.docsAreEqual;
couchdb.docToJson = utils.docToJson;
