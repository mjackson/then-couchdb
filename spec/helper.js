assert = require('assert');
couchdb = require('../lib');

// Override mocha's built-in methods with promise-aware versions.
require('mocha-as-promised')();

// A global client instance to use in tests.
db = couchdb.createClient();

// A design document that is added to the database before each spec runs.
_design = {
  _id: '_design/spec',
  views: {
    // Find a document by its _id.
    'by-id': {
      map: function (doc) {
        if (doc._id) emit(doc._id, null);
      }
    }
  }
};

beforeEach(function () {
  db.use('test-' + Date.now());
  return db.create().then(function (doc) {
    assert(doc.ok);
    // Since this same doc is used in many tests, we need to purge the _rev
    // each time to prevent a conflict.
    delete _design._rev;
    return db.save(_design);
  });
});

afterEach(function () {
  return db.destroy();
});

compareDocs = function (existingDoc, doc, message) {
  assert(couchdb.docsAreEqual(existingDoc, doc), message);
};
