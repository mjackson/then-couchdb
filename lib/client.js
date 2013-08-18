var url = require('url');
var http = require('http');
var https = require('https');
var qs = require('querystring');
var when = require('when');
var Cache = require('./cache');
var MemoryCache = require('./memory-cache');
var utils = require('./utils');
var _slice = Array.prototype.slice;
module.exports = Client;

// CouchDB currently has a URL length limit of 8k.
// https://issues.apache.org/jira/browse/COUCHDB-243
var MAX_URL_LENGTH = 1024 * 8;

// Use this value as a guide to determine if a query string
// is too long. Reserve 1k for the rest of the URL.
var MAX_QUERY_STRING_LENGTH = MAX_URL_LENGTH - 1024;

function Client(options) {
  addMethods(this);

  options = options || process.env.COUCHDB_URL || 'http://127.0.0.1:5984';

  if (typeof options === 'string') {
    var parsed = url.parse(options);

    options = {
      protocol: parsed.protocol,
      auth: parsed.auth,
      host: parsed.hostname,
      port: parsed.port
    };

    var match = parsed.pathname.match(/^\/([^\/]+)/);
    if (match) {
      options.database = match[1];
    }
  }

  this.protocol = options.protocol || 'http:';
  this.auth = options.auth;
  this.host = options.host || 'localhost';
  this.port = parseInt(options.port, 10) || (this.isSecure ? 443 : 5984);
  this.transport = this.isSecure ? https : http;

  var Agent = this.transport.Agent;
  this.agent = new Agent({
    host: this.host,
    port: this.port,
    maxSockets: options.maxSockets || 20
  });

  this.defaultHeaders = options.headers || { Accept: 'application/json' };
  this.debug = options.debug || false;
  this.uuidCacheSize = options.uuidCacheSize || 100;
  this.uuidCache = [];

  if (options.database) {
    this.useDatabase(options.database);
  }

  if (options.cache) {
    this.useCache(options.cache);
  }
}

var methods = {};
function addMethods(client) {
  client.__defineGetter__('url', function () {
    return getUrl(this);
  });

  client.__defineGetter__('isSecure', function () {
    return isSecure(this);
  });

  Object.keys(methods).forEach(function (methodName) {
    var method = methods[methodName];
    client[methodName] = function () {
      return method.apply(this, [ this ].concat(_slice.call(arguments, 0)));
    };
  });
}

/**
 * Returns the URL this client is currently using.
 */
function getUrl(client) {
  var options = {
    protocol: client.protocol,
    auth: client.auth,
    hostname: client.host,
    port: client.port
  };

  if (client.database) {
    options.pathname = client.database;
  }

  return url.format(options);
}

/**
 * Returns true if this client uses TLS to encrypt data.
 */
function isSecure(client) {
  return client.protocol === 'https:';
}

/**
 * Sets the name of the database to use for database-level requests.
 */
methods.use = useDatabase;
methods.useDatabase = useDatabase;
function useDatabase(client, database) {
  client.database = database;

  if (client.cache) {
    client.cache.purge();
  }
}

/**
 * Sets the cache for this client to use.
 */
methods.useCache = useCache;
function useCache(client, cache) {
  cache = cache || new MemoryCache;

  if (!(cache instanceof Cache)) {
    throw new Error('Cache must be an instance of couchdb.Cache');
  }

  client.cache = cache;
}

/**
 * Tells this client to stop using the cache. Returns the result of calling
 * `destroy` on the cache, if present.
 */
methods.stopCaching = stopCaching;
function stopCaching(client) {
  var cache = client.cache;
  delete client.cache;

  if (cache && typeof cache.destroy === 'function') {
    return cache.destroy();
  }
}

/**
 * Returns a promise for the response to a request to the server "root" URL.
 */
methods.rootRequest = makeRootRequest;
function makeRootRequest(client, options) {
  options = options || {};

  var params = {};
  params.hostname = client.host;
  params.port = client.port;
  params.agent = client.agent;
  params.method = options.method || 'GET';
  params.headers = utils.merge({}, client.defaultHeaders, options.headers || {});

  if (client.auth) {
    var authBuffer = new Buffer(client.auth);
    params.headers.Authorization = 'Basic ' + authBuffer.toString('base64');
  }

  params.path = options.path || '/';
  if (!isEmpty(options.query)) {
    params.path += '?' + encodeQuery(options.query);
  }

  if (client.debug) {
    console.log('couchdb: ' + params.method + ' ' + params.path);
  }

  var value = when.defer();
  var request = client.transport.request(params, function (response) {
    var code = response.statusCode;

    if (code >= 200 && code < 400) {
      value.resolve(response);
    } else {
      getDoc(response).then(function (data) {
        var error;
        if (data) {
          error = new Error(data.error + ', ' + data.reason);
          error.error = data.error;
          error.reason = data.reason;
        } else {
          error = new Error('Request returned status ' + code);
        }

        error.statusCode = code;
        error.requestLine = request.method + ' ' + request.path;

        value.reject(error);
      }, function (error) {
        value.reject(error);
      });
    }
  });

  var body = options.body;
  if (body) {
    if (typeof body.pipe === 'function') {
      body.pipe(request);
    } else {
      request.end(body);
    }
  } else {
    request.end();
  }

  return value.promise;
}

/**
 * Returns a promise for the response to a request to the database URL.
 */
methods.request = makeRequest;
function makeRequest(client, options) {
  if (!client.database) {
    throw new Error('You must set the name of the database first');
  }

  options = options || {};
  options.path = '/' + client.database + (options.path || '');

  return makeRootRequest(client, options);
}

/**
 * Returns a promise for an array of UUIDs.
 */
methods.uuids = uuids;
function uuids(client, count) {
  count = count || 1;

  var cache = client.uuidCache;
  if (count > cache.length) {
    var toFetch = count - cache.length + client.uuidCacheSize;

    return makeRootRequest(client, {
      path: '/_uuids',
      query: { count: toFetch }
    }).then(getDoc).then(function (doc) {
      cache.push.apply(cache, doc.uuids);
      return cache.splice(0, count);
    });
  }

  return when(cache.splice(0, count));
}

/**
 * Returns a promise for a single UUID.
 */
methods.uuid = uuid;
function uuid(client) {
  return uuids(client, 1).then(function (uuids) {
    return uuids[0];
  });
}

/**
 * Returns a promise for an array of the names of all databases on the server.
 */
methods.allDbs = allDbs;
function allDbs(client) {
  // Oddly, CouchDB returns a bare array here.
  return makeRootRequest(client, {
    method: 'GET', path: '/_all_dbs'
  }).then(getDoc);
}

/**
 * Returns a promise for a document of info about the current database.
 */
methods.info = info;
function info(client) {
  return makeRequest(client, { method: 'GET' }).then(getDoc);
}

/**
 * Creates a database. Returns a promise for the response document.
 */
methods.create = create;
function create(client) {
  return makeRequest(client, { method: 'PUT' }).then(getDoc, function (error) {
    if (error.error !== 'file_exists') throw error;
  });
}

/**
 * Destroys a database. Returns a promise for the response document.
 */
methods.destroy = destroy;
function destroy(client) {
  return makeRequest(client, { method: 'DELETE' }).then(getDoc, function (error) {
    if (error.error !== 'not_found') throw error;
  });
}

/**
 * Returns a promise for the given document after saving it to the database.
 * The document's _id and _rev are automatically updated.
 */
methods.save = save;
function save(client, doc) {
  var options = {};

  if (doc._id) {
    options.method = 'PUT';
    options.path = '/' + encodeKey(doc._id);
  } else {
    options.method = 'POST';
  }

  options.body = utils.docToJson(doc);
  options.headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(options.body)
  };

  var cache = client.cache;
  return makeRequest(client, options).then(getDoc).then(function (data) {
    doc._id = data.id;
    doc._rev = data.rev;

    if (cache) {
      var promise;
      if (doc._deleted) {
        promise = cache.purge([ doc._id ]);
      } else {
        promise = cache.set(doc._id, doc);
      }

      return when(promise, function () {
        return doc;
      });
    }

    return doc;
  });
}

/**
 * Returns a promise for the given array of documents after saving them to the
 * database in bulk. All documents' _id and _rev are automatically updated.
 */
methods.saveAll = saveAll;
function saveAll(client, docs) {
  if (!docs || !docs.length) {
    return when([]);
  }

  var options = {};
  options.method = 'POST';
  options.path = '/_bulk_docs';
  options.body = utils.docToJson({ docs: docs });
  options.headers = { 'Content-Type': 'application/json' };

  var cache = client.cache;
  return makeRequest(client, options).then(getDoc).then(function (results) {
    var promises = [];

    // Oddly, CouchDB returns a bare array here.
    var updatedDocs = docs.map(function (doc, i) {
      var result = results[i];

      if (result && !result.error) {
        doc._id = result.id;
        doc._rev = result.rev;

        if (cache) {
          if (doc._deleted) {
            promises.push(cache.purge([ doc._id ]));
          } else {
            promises.push(cache.set(doc._id, doc));
          }
        }
      }

      return doc;
    });

    return when.all(promises).then(function () {
      return updatedDocs;
    });
  });
}

methods.update = updateDoc;
function updateDoc(client, updateHandler, doc) {
  var options = {};
  options.method = 'POST';

  // If updateHandler contains a slash assume it is the name of a design
  // document and update handler.
  var split = updateHandler.split('/');
  var designName = split[0], handlerName = split[1];
  if (handlerName) {
    options.path = '/_design/' + designName + '/_update/' + handlerName;
  } else {
    options.path = updateHandler;
  }

  if (doc) {
    if (doc._id) {
      options.method = 'PUT';
      options.path += '/' + encodeKey(doc._id);
    }

    options.body = utils.docToJson(doc);
    options.headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(options.body)
    };
  }

  return makeRequest(client, options).then(function (response) {
    return getDoc(response).then(function (newDoc) {
      if (doc) {
        if (typeof newDoc === 'object') {
          utils.merge(doc, newDoc);
        }
      } else {
        doc = newDoc;
      }

      // http://wiki.apache.org/couchdb/Document_Update_Handlers#Response
      var newRev = response.headers['x-couch-update-newrev'];
      if (newRev) doc._rev = newRev;

      return doc;
    });
  });
}

/**
 * Returns a promise for the response headers of a HEAD request for the document
 * with the given key. Resolves to null if the document is not found.
 */
methods.head = head;
function head(client, key, query) {
  return makeRequest(client, {
    method: 'HEAD',
    path: '/' + encodeKey(key),
    query: query
  }).then(function (response) {
    return response.headers;
  }, function (error) {
    if (error.statusCode === 404) {
      return null;
    }

    throw error;
  });
}

/**
 * Returns a promise for the document with the given key. Resolves to null if
 * the document is not found.
 */
methods.get = get;
function get(client, key, query) {
  var cache = client.cache;

  if (!cache || !isEmpty(query)) {
    return getKey(client, key, query);
  }

  return when(cache.get([ key ]), function (docs) {
    var doc = docs[0];

    if (doc !== undefined) return doc; // A cache hit!

    return getKey(client, key).then(function (doc) {
      if (!doc) return doc;

      // Store in cache for next time.
      return when(cache.set(key, doc), function () {
        return doc;
      });
    });
  });
}

function getKey(client, key, query) {
  return makeRequest(client, {
    path: '/' + encodeKey(key),
    query: query
  }).then(getDoc, function (error) {
    if (error.statusCode === 404) return null;
    throw error;
  });
}

/**
 * Returns a promise for an array of documents with the given keys. The array
 * contains null for documents that are not found.
 */
methods.getAll = getAll;
function getAll(client, keys) {
  if (!keys || !keys.length) return when([]);

  var cache = client.cache;
  if (!cache) {
    return getKeys(client, keys);
  }

  return when(cache.get(keys), function (docs) {
    var missingKeys = keys.filter(function (key, index) {
      return docs[index] === undefined;
    });

    if (!missingKeys.length) return docs; // All keys were cached!

    return getKeys(client, missingKeys).then(function (missingDocs) {
      // Cache all docs that were found for next time.
      var promises = [];
      missingDocs.forEach(function (doc) {
        if (doc) promises.push(cache.set(doc._id, doc));
      });

      // Fill in the missing docs.
      docs.forEach(function (doc, index) {
        if (doc === undefined) docs[index] = missingDocs.shift();
      });

      return when.all(promises).then(function () {
        return docs;
      });
    });
  });
}

function getKeys(client, keys) {
  return allDocs(client, { keys: keys });
}

/**
 * Returns a promise for the document that is returned from running the given
 * query against the given view function.
 */
methods.view = view;
function view(client, designView, query) {
  var options = {};

  // If designView contains a slash assume it is the name of a design
  // document and view.
  var split = designView.split('/');
  var designName = split[0], viewName = split[1];
  if (viewName) {
    options.path = '/_design/' + designName + '/_view/' + viewName;
  } else {
    options.path = '/' + designView;
  }

  if (query) {
    // Try to avoid query strings that are too long by encoding the keys
    // as JSON and putting them in a POST body.
    // http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
    if (query.keys && encodeQuery(query).length > MAX_QUERY_STRING_LENGTH) {
      options.method = 'POST';
      options.body = JSON.stringify({ keys: query.keys });
      if (!options.headers) options.headers = {};
      options.headers['Content-Type'] = 'application/json';
      delete query.keys;
    }

    if (!isEmpty(query)) {
      options.query = query;
    }
  }

  return makeRequest(client, options).then(getDoc);
}

methods.viewRows = viewRows;
function viewRows(client, designView, query) {
  return view(client, designView, query).then(function (doc) {
    return doc.rows;
  });
}

methods.viewKeys = viewKeys;
function viewKeys(client, designView, query) {
  return viewRows(client, designView, query).then(function (rows) {
    return rows.map(function (row) {
      return row.key;
    });
  });
}

methods.viewValues = viewValues;
function viewValues(client, designView, query) {
  return viewRows(client, designView, query).then(function (rows) {
    return rows.map(function (row) {
      return row.value;
    });
  });
}

/**
 * Returns a promise for an array of documents (include_docs=true) that match
 * the given query to the given view.
 */
methods.viewDocs = viewDocs;
function viewDocs(client, designView, query) {
  query = query || {};
  query.include_docs = true;
  return viewRows(client, designView, query).then(function (rows) {
    return rows.map(function (row) {
      return row.doc;
    });
  });
}

/**
 * A high-level function that returns a promise for the first document (limit=1)
 * in the given view that matches the given query.
 */
methods.viewDoc = viewDoc;
function viewDoc(client, designView, query) {
  query = query || {};
  query.limit = 1;
  return viewDocs(client, designView, query).then(function (docs) {
    return docs[0] || null;
  });
}

/**
 * A high-level function that returns a promise for an array of documents that
 * match the given query against the special _all_docs view. Any keys that are
 * missing or documents that have been deleted will be null.
 */
methods.allDocs = allDocs;
function allDocs(client, query) {
  query = query || {};
  query.include_docs = true;
  return viewRows(client, '_all_docs', query).then(function (rows) {
    return rows.map(function (row) {
      // From http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API#Fetch_Multiple_Documents_With_a_Single_Request
      // - The row for a deleted document will have the revision ID of the deletion, and an extra key "deleted":true in the "value" property.
      // - The row for a nonexistent document will just contain an "error" property with the value "not_found".
      if (row.error === 'not_found' || row.value.deleted) {
        return null;
      }

      return row.doc;
    });
  });
}

/**
 * Returns a promise for the HTTP response to a GET request for the attachment
 * with the given `name` on the given document.
 */
methods.getAttachment = getAttachment;
function getAttachment(client, doc, name) {
  return makeRequest(client, {
    path: makeAttachmentPath(doc._id, name)
  });
}

/**
 * Creates/updates an attachment with the given `name` on the given document.
 * The `body` should be the entire contents of the attachment as a string or a
 * readable stream for its contents. Returns a promise for the document that is
 * returned (see http://wiki.apache.org/couchdb/HTTP_Document_API#Standalone_Attachments).
 *
 * NOTE: It is NOT safe to save the same document again without deleting the
 * attachment since it will not have the _attachments property.
 */
methods.putAttachment = putAttachment;
function putAttachment(client, doc, name, type, size, body) {
  var query;
  if (doc._rev) query = { rev: doc._rev };
  return makeRequest(client, {
    method: 'PUT',
    path: makeAttachmentPath(doc._id, name),
    headers: { 'Content-Type': type, 'Content-Length': size },
    query: query,
    body: body
  }).then(getDoc);
}

/**
 * Deletes the attachment with the given `name` from the given document. Returns
 * a promise for the document that is returned (see http://wiki.apache.org/couchdb/HTTP_Document_API#Standalone_Attachments).
 */
methods.deleteAttachment = deleteAttachment;
function deleteAttachment(client, doc, name) {
  return makeRequest(client, {
    method: 'DELETE',
    path: makeAttachmentPath(doc._id, name)
  }).then(getDoc);
}

/**
 * Returns a promise for a document that describes changes that have been made
 * according to the given `query` parameters (see http://wiki.apache.org/couchdb/HTTP_Document_API#A_changes).
 * If the `feed` parameter is "continuous", returns an emitter for documents
 * as they are received over a persistent connection to the database.
 */
methods.changes = getChanges;
function getChanges(client, query) {
  var params = {
    path: '/_changes',
    query: query
  };

  var continuous = query && query.feed === 'continuous';
  if (continuous) params.agent = false; // opt-out of connection pooling

  return makeRequest(client, params).then(function (response) {
    return continuous ? streamDocs(response) : getDoc(response);
  });
}

/* helpers */

function makeAttachmentPath(key, name) {
  return '/' + encodeKey(key) + '/' + encodeURIComponent(name);
}

function encodeKey(key) {
  return isDesignKey(key) ? key : encodeURIComponent(key);
}

function isDesignKey(key) {
  return (/^_design\//).test(key);
}

function encodeQuery(query) {
  return qs.stringify(prepareQuery(query));
}

// Keys that should be encoded as JSON in queries.
var jsonKeys = { startkey: 1, endkey: 1, key: 1, keys: 1 };

function prepareQuery(query) {
  var value = {};

  for (var key in query) {
    if (query.hasOwnProperty(key)) {
      value[key] = jsonKeys[key] ? JSON.stringify(query[key]) : query[key];
    }
  }

  return value;
}

function getDoc(response) {
  return utils.bufferStream(response).then(function (buffer) {
    var body = buffer.toString();
    if (body === '') return null;

    try {
      return JSON.parse(body);
    } catch (error) {
      console.log('Parse error: ' + error + ', body: ' + body);
      return null;
    }
  });
}

function streamDocs(response) {
  return new DocumentStream(response);
}

var util = require('util');
var EventEmitter = require('events').EventEmitter;

function DocumentStream(response) {
  EventEmitter.call(this);
  this.isStopped = false;

  var self = this;

  var buffer;
  response.on('data', function (chunk) {
    self.emit('data', chunk);

    buffer = buffer ? Buffer.concat([ buffer, chunk ]) : chunk;

    var string = buffer.toString();
    var index = 0;
    var offset, json, doc;
    while ((offset = string.indexOf('\n')) >= 0) {
      json = string.substr(0, offset);
      string = string.substr(offset + 1);

      if (json != '') {
        try {
          doc = JSON.parse(json);
        } catch (error) {
          break;
        }

        self.emit('doc', doc);
      }

      index += Buffer.byteLength(json) + 1;
    }

    if (index) buffer = buffer.slice(index);
  });

  response.on('end', function () {
    self.emit('end');
  });

  response.on('error', function (error) {
    self.emit('error', error);
  });
}

util.inherits(DocumentStream, EventEmitter);

DocumentStream.prototype.stop = function () {
  this.isStopped = true;

  if (this.response) {
    this.response.end();
  }
};

function isEmpty(object) {
  if (!object) return true;
  for (var key in object) return false;
  return true;
}
