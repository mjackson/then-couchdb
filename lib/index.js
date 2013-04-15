var Client = require('./client');
var MemoryCache = require('./cache/memory');
var utils = require('./utils');

exports.Client = Client;
exports.MemoryCache = MemoryCache;
exports.utils = utils;

// These are very useful.
exports.docsAreEqual = utils.docsAreEqual;
exports.docToJson = utils.docToJson;

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

exports.createClient = createClient;
function createClient(options) {
  return new Client(options);
}
