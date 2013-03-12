var Client = require('./client');
var utils = require('./utils');

exports.Client = Client;
exports.utils = utils;

// These are very useful.
exports.docsAreEqual = utils.docsAreEqual;
exports.docToJson = utils.docToJson;

exports.createClient = createClient;
function createClient(options) {
  return new Client(options);
}
