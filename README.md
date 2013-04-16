then-couchdb
============

[then-couchdb](https://github.com/mjijackson/then-couchdb) is a promise-based [CouchDB](http://couchdb.apache.org) client for [node.js](http://nodejs.org). It supports all the features of CouchDB in a simple, user-friendly package.

### Usage

Creating a client.

```js
var couchdb = require('then-couchdb');
var db = couchdb.createClient('http://localhost:5984/my-database');
```

Save and fetch a single document.

```js
db.save({ name: 'one' }).then(function (doc) {
  assert(doc);
  assert(doc._id);
  assert(doc._rev);

  db.get(doc._id).then(function (doc) {
    assert(doc);
    assert.equal(doc.name, 'one');
  });
});
```

Save and fetch many documents in bulk.

```js
db.saveAll([
  { name: 'one' },
  { name: 'two' },
  { name: 'three' }
]).then(function (docs) {
  assert(Array.isArray(docs));
  assert.equal(docs.length, 3);

  var keys = docs.map(function (doc) {
    return doc._id;
  });

  db.getAll(keys).then(function (docs) {
    assert(Array.isArray(docs));
    assert.equal(docs.length, 3);
  });
});
```
