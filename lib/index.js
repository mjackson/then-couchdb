var Cache = require('./cache');
var Client = require('./client');
var MemoryCache = require('./memory-cache');
var utils = require('./utils');

exports.Cache = Cache;
exports.Client = Client;
exports.MemoryCache = MemoryCache;
exports.utils = utils;

exports.createClient = createClient;
function createClient(options) {
  return new Client(options);
}

exports.createCache = createCache;
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
exports.docsAreEqual = utils.docsAreEqual;
exports.docToJson = utils.docToJson;
