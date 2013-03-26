then-couchdb
============

[then-couchdb](https://github.com/mjijackson/then-couchdb) is a small, promise-based [CouchDB](http://couchdb.apache.org) client for [node.js](http://nodejs.org). It supports all the features of CouchDB in a simple, user-friendly package.

```js
var couchdb = require('then-couchdb');
var db = couchdb.createClient('http://localhost:5984/my-database');

db.get('a-key').then(function (doc) {
  console.log(doc);
});
```
