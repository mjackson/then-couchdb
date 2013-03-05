assert = require('assert');
q = require('q');
couchdb = require('../lib');

// Override mocha's built-in methods with promise-aware versions.
require('mocha-as-promised')();

// A global client instance to use in tests.
db = null;

beforeEach(function () {
  db = couchdb.createClient('http://localhost:5984/test-' + Date.now());
  return db.create();
});

afterEach(function () {
  return db.destroy();
});

compareDocs = function (existingDoc, doc, message) {
  assert(couchdb.utils.docsAreEqual(existingDoc, doc), message);
};
