var couchdb = module.exports;

couchdb.Client = require('./client');
couchdb.Cache = require('./cache');
couchdb.MemoryCache = require('./memory-cache');
couchdb.RedisCache = require('./redis-cache');

couchdb.createClient = createClient;
function createClient(options) {
  return new couchdb.Client(options);
}

var utils = require('./utils');
couchdb.utils = utils;
couchdb.docsAreEqual = utils.docsAreEqual;
couchdb.docToJson = utils.docToJson;
