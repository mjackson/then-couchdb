var Client = require('./client');
var utils = require('./utils');

exports.Client = Client;
exports.utils = utils;

exports.createClient = createClient;
function createClient(options) {
  return new Client(options);
}
