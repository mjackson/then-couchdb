var url = require('url');
var http = require('http');
var https = require('https');
var qs = require('querystring');
var RSVP = require('rsvp');
var Cache = require('./cache');
var MemoryCache = require('./memory-cache');
var utils = require('./utils');
module.exports = Client;

// CouchDB currently has a URL length limit of 8k.
// https://issues.apache.org/jira/browse/COUCHDB-243
var MAX_URL_LENGTH = 1024 * 8;

// Use this value as a guide to determine if a query string
// is too long. Reserve 1k for the rest of the URL.
var MAX_QUERY_STRING_LENGTH = MAX_URL_LENGTH - 1024;

function Client(options) {
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

    if (match)
      options.database = match[1];
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

  if (options.database)
    this.useDatabase(options.database);

  if (options.cache)
    this.useCache(options.cache);
}

/**
 * Returns the URL this client is currently using.
 */
Client.prototype.__defineGetter__('url', function () {
  var options = {
    protocol: this.protocol,
    auth: this.auth,
    hostname: this.host,
    port: this.port
  };

  if (this.database)
    options.pathname = this.database;

  return url.format(options);
});

/**
 * Returns true if this client uses TLS to encrypt data.
 */
Client.prototype.__defineGetter__('isSecure', function () {
  return this.protocol === 'https:';
});

/**
 * Sets the name of the database to use for database-level requests.
 */
Client.prototype.useDatabase = function (database) {
  this.database = database;

  if (this.cache)
    this.cache.purge();
};

// Shorthand.
Client.prototype.use = Client.prototype.useDatabase;

/**
 * Sets the cache for this client to use.
 */
Client.prototype.useCache = function (cache) {
  cache = cache || new MemoryCache;

  if (!(cache instanceof Cache))
    throw new Error('Cache must be an instance of couchdb.Cache');

  this.cache = cache;
};

/**
 * Tells this client to stop using the cache. Returns the result of calling
 * `destroy` on the cache, if present.
 */
Client.prototype.stopCaching = function () {
  var cache = this.cache;
  delete this.cache;

  if (cache && isFunction(cache.destroy))
    return cache.destroy();
};

/**
 * Returns a promise for the response to a request to the server "root" URL.
 */
Client.prototype.rootRequest = function (options) {
  options = options || {};

  var params = {};
  params.hostname = this.host;
  params.port = this.port;
  params.agent = this.agent;
  params.method = options.method || 'GET';
  params.headers = utils.merge({}, this.defaultHeaders, options.headers || {});

  if (this.auth) {
    var authBuffer = new Buffer(this.auth);
    params.headers.Authorization = 'Basic ' + authBuffer.toString('base64');
  }

  params.path = options.path || '/';

  if (!isEmpty(options.query))
    params.path += '?' + encodeQuery(options.query);

  if (this.debug)
    console.log('couchdb: ' + params.method + ' ' + params.path);

  var deferred = RSVP.defer();
  var request = this.transport.request(params, function (response) {
    var code = response.statusCode;

    if (code >= 200 && code < 400) {
      deferred.resolve(response);
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

        deferred.reject(error);
      }, function (error) {
        deferred.reject(error);
      });
    }
  });

  var content = options.content || options.body; // body is deprecated

  if (content) {
    if (isFunction(content.pipe)) {
      content.pipe(request);
    } else {
      request.end(content);
    }
  } else {
    request.end();
  }

  return deferred.promise;
};

/**
 * Returns a promise for the response to a request to the database URL.
 */
Client.prototype.request = function (options) {
  if (!this.database)
    throw new Error('You must set the name of the database first');

  options = options || {};
  options.path = '/' + this.database + (options.path || '');

  return this.rootRequest(options);
};

/**
 * Returns a promise for an array of UUIDs.
 */
Client.prototype.uuids = function (count) {
  count = count || 1;

  var cache = this.uuidCache;

  if (count > cache.length) {
    var toFetch = count - cache.length + this.uuidCacheSize;

    return this.rootRequest({
      path: '/_uuids',
      query: { count: toFetch }
    }).then(getDoc).then(function (doc) {
      cache.push.apply(cache, doc.uuids);
      return cache.splice(0, count);
    });
  }

  return RSVP.resolve(cache.splice(0, count));
};

/**
 * Returns a promise for a single UUID.
 */
Client.prototype.uuid = function () {
  return this.uuids(1).then(function (uuids) {
    return uuids[0];
  });
};

/**
 * Returns a promise for an array of the names of all databases on the server.
 */
Client.prototype.allDbs = function () {
  // Oddly, CouchDB returns a bare array here.
  return this.rootRequest({ method: 'GET', path: '/_all_dbs' }).then(getDoc);
};

/**
 * Returns a promise for a document of info about the current database.
 */
Client.prototype.info = function () {
  return this.request({ method: 'GET' }).then(getDoc);
};

/**
 * Creates a database. Returns a promise for the response document.
 */
Client.prototype.create = function () {
  return this.request({ method: 'PUT' }).then(getDoc, function (error) {
    if (error.error !== 'file_exists')
      throw error;
  });
};

/**
 * Destroys a database. Returns a promise for the response document.
 */
Client.prototype.destroy = function () {
  return this.request({ method: 'DELETE' }).then(getDoc, function (error) {
    if (error.error !== 'not_found')
      throw error;
  });
};

/**
 * Returns a promise for the given document after saving it to the database.
 * The document's _id and _rev are automatically updated.
 */
Client.prototype.save = function (doc) {
  var options = {};

  if (doc._id) {
    options.method = 'PUT';
    options.path = '/' + encodeKey(doc._id);
  } else {
    options.method = 'POST';
  }

  options.content = utils.docToJson(doc);
  options.headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(options.content)
  };

  var cache = this.cache;
  return this.request(options).then(getDoc).then(function (data) {
    doc._id = data.id;
    doc._rev = data.rev;

    if (cache) {
      var promise;
      if (doc._deleted) {
        promise = cache.purge([ doc._id ]);
      } else {
        promise = cache.set(doc._id, doc);
      }

      return RSVP.resolve(promise).then(function () {
        return doc;
      });
    }

    return doc;
  });
};

/**
 * Returns a promise for the given array of documents after saving them to the
 * database in bulk. All documents' _id and _rev are automatically updated.
 */
Client.prototype.saveAll = function (docs) {
  if (!docs || !docs.length)
    return RSVP.resolve([]);

  var options = {};
  options.method = 'POST';
  options.path = '/_bulk_docs';
  options.content = utils.docToJson({ docs: docs });
  options.headers = { 'Content-Type': 'application/json' };

  var cache = this.cache;
  return this.request(options).then(getDoc).then(function (results) {
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

    return RSVP.all(promises).then(function () {
      return updatedDocs;
    });
  });
};

Client.prototype.update = function (updateHandler, doc) {
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

    options.content = utils.docToJson(doc);
    options.headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(options.content)
    };
  }

  return this.request(options).then(function (response) {
    return getDoc(response).then(function (newDoc) {
      if (doc) {
        if (typeof newDoc === 'object')
          utils.merge(doc, newDoc);
      } else {
        doc = newDoc;
      }

      // http://wiki.apache.org/couchdb/Document_Update_Handlers#Response
      var newRev = response.headers['x-couch-update-newrev'];

      if (newRev)
        doc._rev = newRev;

      return doc;
    });
  });
};

/**
 * Returns a promise for the response headers of a HEAD request for the document
 * with the given key. Resolves to null if the document is not found.
 */
Client.prototype.head = function (key, query) {
  return this.request({
    method: 'HEAD',
    path: '/' + encodeKey(key),
    query: query
  }).then(function (response) {
    return response.headers;
  }, function (error) {
    if (error.statusCode === 404)
      return null;

    throw error;
  });
};

/**
 * Returns a promise for the document with the given key. Resolves to null if
 * the document is not found.
 */
Client.prototype.get = function (key, query) {
  var cache = this.cache;

  if (!cache || !isEmpty(query))
    return getKey(this, key, query);

  var client = this;
  return RSVP.resolve(cache.get([ key ])).then(function (docs) {
    var doc = docs[0];

    if (doc !== undefined)
      return doc; // A cache hit!

    return getKey(client, key).then(function (doc) {
      if (!doc)
        return doc;

      // Store in cache for next time.
      return RSVP.resolve(cache.set(key, doc)).then(function () {
        return doc;
      });
    });
  });
};

function getKey(client, key, query) {
  return client.request({
    path: '/' + encodeKey(key),
    query: query
  }).then(getDoc, function (error) {
    if (error.statusCode === 404)
      return null;

    throw error;
  });
}

/**
 * Returns a promise for an array of documents with the given keys. The array
 * contains null for documents that are not found.
 */
Client.prototype.getAll = function (keys) {
  if (!keys || !keys.length)
    return RSVP.resolve([]);

  var cache = this.cache;

  if (!cache)
    return getKeys(this, keys);

  var client = this;
  return RSVP.resolve(cache.get(keys)).then(function (docs) {
    var missingKeys = keys.filter(function (key, index) {
      return docs[index] === undefined;
    });

    if (!missingKeys.length)
      return docs; // All keys were cached!

    return getKeys(client, missingKeys).then(function (missingDocs) {
      // Cache all docs that were found for next time.
      var promises = [];

      missingDocs.forEach(function (doc) {
        if (doc)
          promises.push(cache.set(doc._id, doc));
      });

      // Fill in the missing docs.
      docs.forEach(function (doc, index) {
        if (doc === undefined)
          docs[index] = missingDocs.shift();
      });

      return RSVP.all(promises).then(function () {
        return docs;
      });
    });
  });
};

function getKeys(client, keys) {
  // TODO: Optimize this GET by eliminating duplicate keys before fetching the
  // documents from the database. Then, expand the resulting array using clones
  // of duplicate objects.
  return client.allDocs({ keys: keys });
}

/**
 * Returns a promise for the document that is returned from running the given
 * query against the given view function.
 */
Client.prototype.view = function (designView, query) {
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
    // as JSON and putting them in a POST content.
    // http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
    if (query.keys && encodeQuery(query).length > MAX_QUERY_STRING_LENGTH) {
      options.method = 'POST';
      options.content = JSON.stringify({ keys: query.keys });

      if (!options.headers)
        options.headers = {};
      
      options.headers['Content-Type'] = 'application/json';

      delete query.keys;
    }

    if (!isEmpty(query))
      options.query = query;
  }

  return this.request(options).then(getDoc);
};

/**
 * Returns a promise for an array of all rows in the given view.
 */
Client.prototype.viewRows = function (designView, query) {
  return this.view(designView, query).then(function (doc) {
    return doc.rows;
  });
};

/**
 * Returns a promise for an array of all keys in the given view.
 */
Client.prototype.viewKeys = function (designView, query) {
  return this.viewRows(designView, query).then(function (rows) {
    return rows.map(function (row) {
      return row.key;
    });
  });
};

/**
 * Returns a promise for an array of all values in the given view.
 */
Client.prototype.viewValues = function (designView, query) {
  return this.viewRows(designView, query).then(function (rows) {
    return rows.map(function (row) {
      return row.value;
    });
  });
};

/**
 * Returns a promise for an array of documents (include_docs=true) that match
 * the given query to the given view.
 */
Client.prototype.viewDocs = function (designView, query) {
  query = query || {};
  query.include_docs = true;

  return this.viewRows(designView, query).then(function (rows) {
    return rows.map(function (row) {
      return row.doc;
    });
  });
};

/**
 * A high-level function that returns a promise for the first document (limit=1)
 * in the given view that matches the given query.
 */
Client.prototype.viewDoc = function (designView, query) {
  query = query || {};
  query.limit = 1;

  return this.viewDocs(designView, query).then(function (docs) {
    return docs[0] || null;
  });
};

/**
 * A high-level function that returns a promise for an array of documents that
 * match the given query against the special _all_docs view. Any keys that are
 * missing or documents that have been deleted will be null.
 */
Client.prototype.allDocs = function (query) {
  query = query || {};
  query.include_docs = true;

  return this.viewRows('_all_docs', query).then(function (rows) {
    return rows.map(function (row) {
      // From http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API#Fetch_Multiple_Documents_With_a_Single_Request
      // - The row for a deleted document will have the revision ID of the deletion, and an extra key "deleted":true in the "value" property.
      // - The row for a nonexistent document will just contain an "error" property with the value "not_found".
      if (row.error === 'not_found' || row.value.deleted)
        return null;

      return row.doc;
    });
  });
};

/**
 * Returns a promise for the HTTP response to a GET request for the attachment
 * with the given `name` on the given document.
 */
Client.prototype.getAttachment = function (doc, name) {
  return this.request({ path: makeAttachmentPath(doc._id, name) });
};

/**
 * Creates/updates an attachment with the given `name` on the given document.
 * The `content` should be the entire contents of the attachment as a string or a
 * readable stream for its contents. Returns a promise for the document that is
 * returned (see http://wiki.apache.org/couchdb/HTTP_Document_API#Standalone_Attachments).
 *
 * NOTE: It is NOT safe to save the same document again without deleting the
 * attachment since it will not have the _attachments property.
 */
Client.prototype.putAttachment = function (doc, name, type, size, content) {
  var query;

  if (doc._rev)
    query = { rev: doc._rev };

  return this.request({
    method: 'PUT',
    path: makeAttachmentPath(doc._id, name),
    headers: { 'Content-Type': type, 'Content-Length': size },
    query: query,
    content: content
  }).then(getDoc);
};

/**
 * Deletes the attachment with the given `name` from the given document. Returns
 * a promise for the document that is returned (see http://wiki.apache.org/couchdb/HTTP_Document_API#Standalone_Attachments).
 */
Client.prototype.deleteAttachment = function (doc, name) {
  return this.request({
    method: 'DELETE',
    path: makeAttachmentPath(doc._id, name)
  }).then(getDoc);
};

/**
 * Returns a promise for a document that describes changes that have been made
 * according to the given `query` parameters (see http://wiki.apache.org/couchdb/HTTP_Document_API#A_changes).
 * If the `feed` parameter is "continuous", returns an emitter for documents
 * as they are received over a persistent connection to the database.
 */
Client.prototype.changes = function (query) {
  var params = {
    path: '/_changes',
    query: query
  };

  var isContinuous = query && query.feed === 'continuous';

  if (isContinuous)
    params.agent = false; // opt-out of connection pooling

  return this.request(params).then(function (response) {
    return isContinuous ? streamDocs(response) : getDoc(response);
  });
};

/* helpers */

function makeAttachmentPath(key, name) {
  return '/' + encodeKey(key) + '/' + encodeURIComponent(name);
}

function encodeKey(key) {
  return isDesignKey(key) ? key : encodeURIComponent(key);
}

var designKeyFormat = /^_design\//;

function isDesignKey(key) {
  return designKeyFormat.test(key);
}

function encodeQuery(query) {
  return qs.stringify(prepareQuery(query));
}

// Keys that should be encoded as JSON in queries.
var jsonKeys = { startkey: 1, endkey: 1, key: 1, keys: 1 };

function prepareQuery(query) {
  var value = {};

  for (var key in query) {
    if (query.hasOwnProperty(key))
      value[key] = jsonKeys[key] ? JSON.stringify(query[key]) : query[key];
  }

  return value;
}

function getDoc(response) {
  return utils.bufferStream(response).then(function (buffer) {
    var content = buffer.toString();

    if (content === '')
      return null;

    try {
      return JSON.parse(content);
    } catch (error) {
      console.log('Parse error: ' + error + ', content: ' + content);
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

  var self = this, buffer;

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

    if (index)
      buffer = buffer.slice(index);
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

  if (this.response)
    this.response.end();
};

function isFunction(object) {
  return typeof object === 'function';
}

function isEmpty(object) {
  if (object) {
    for (var key in object)
      return false;
  }

  return true;
}
