exports.Client = require('./client');
exports.Cache = require('./cache');
exports.MemoryCache = require('./memory-cache');
exports.RedisCache = require('./redis-cache');

exports.createClient = function (options) {
  return new exports.Client(options);
};

var utils = require('./utils');

exports.utils = utils;
exports.docsAreEqual = utils.docsAreEqual;
exports.docToJson = utils.docToJson;
