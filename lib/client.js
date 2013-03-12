var url = require('url');
var http = require('http');
var https = require('https');
var qs = require('querystring');
var events = require('events');
var q = require('q');
var utils = require('./utils');

var httpModules = {
  'http:': http,
  'https:': https
};

var httpAgents = {
  'http:': new http.Agent({ maxSockets: 20 }),
  'https:': new https.Agent({ maxSockets: 20 })
};

module.exports = Client;

function Client(options) {
  options = options || process.env.COUCHDB_URL || 'http://localhost:5984';

  if (typeof options === 'string') {
    var parsed = url.parse(options);
    options = {};
    options.protocol = parsed.protocol;
    options.auth = parsed.auth;
    options.host = parsed.hostname;
    options.port = parsed.port;
    var match = parsed.pathname.match(/^\/([^\/]+)/);
    if (match) options.database = match[1];
  }

  this.protocol = options.protocol || 'http:';
  this.defaultHeaders = options.headers || { Accept: 'application/json' };
  this.auth = options.auth;
  this.host = options.host || 'localhost';
  this.port = parseInt(options.port, 10) || 5984;
  this.uuidCacheSize = options.uuidCacheSize || 100;
  this.debug = options.debug || false;

  if (options.database) this.use(options.database);

  this._uuidCache = [];
}

// Tells this client to use the database with the given name.
Client.prototype.use = function (database) {
  this.database = database;
};

// Returns a promise for the response to a request to the root URL.
Client.prototype.rootRequest = function (options, resolver) {
  resolver = resolver || resolveDoc;
  options = options || {};

  var httpModule = httpModules[this.protocol];
  if (!httpModule) throw new Error('Unknown protocol: ' + this.protocol);

  var params = {};
  params.method = options.method || 'GET';
  if (this.auth) params.auth = this.auth;
  params.hostname = this.host;
  if (this.port) params.port = this.port;
  params.path = options.path || '/';
  var query = options.query;
  if (query && !isEmpty(query)) params.path += '?' + qs.stringify(prepareQuery(query));
  params.headers = utils.merge({}, this.defaultHeaders, options.headers || {});
  params.agent = httpAgents[this.protocol];

  if (this.debug) console.log('couchdb: ' + params.method + ' ' + params.path);

  var value = q.defer();

  var request = httpModule.request(params, function (response) {
    if (isSuccessCode(response.statusCode)) {
      resolver(value, request, response);
    } else {
      getDoc(response).then(function (data) {
        var error;
        if (data) {
          error = new Error(data.error + ', ' + data.reason);
          error.error = data.error;
          error.reason = data.reason;
        } else {
          error = new Error('Request returned status ' + response.statusCode);
        }

        error.statusCode = response.statusCode;
        error.requestLine = request.method + ' ' + request.path;

        value.reject(error);
      }, value.reject);
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
};

// Returns a promise for the response to a request to the database URL.
Client.prototype.request = function (options, resolver) {
  if (!this.database) throw new Error('You must set the name of the database first');
  options = options || {};
  options.path = '/' + this.database + (options.path || '');
  return this.rootRequest(options, resolver);
};

// Returns a promise for an array of UUIDs.
Client.prototype.uuids = function (count) {
  count = count || 1;

  var cache = this._uuidCache;
  if (count > cache.length) {
    var toFetch = count - cache.length + this.uuidCacheSize;
    return this.rootRequest({
      path: '/_uuids',
      query: { count: toFetch }
    }).then(function (doc) {
      cache.push.apply(cache, doc.uuids);
      return cache.splice(0, count);
    });
  }

  return q(cache.splice(0, count));
};

// Returns a promise for an array of the names of all databases on the server.
Client.prototype.allDbs = function () {
  return this.rootRequest({ method: 'GET', path: '/_all_dbs' });
};

// Returns a promise for a document of info about the current database.
Client.prototype.info = function () {
  return this.request({ method: 'GET' });
};

// Creates the database. Returns a promise for the response document.
Client.prototype.create = function () {
  return this.request({ method: 'PUT' }).fail(function (error) {
    if (error.error != 'file_exists') throw error;
  });
};

// Destroys the database. Returns a promise for the response document.
Client.prototype.destroy = function () {
  return this.request({ method: 'DELETE' }).fail(function (error) {
    if (error.error != 'not_found') throw error;
  });
};

// Returns a promise for the document with the given id. Resolves to null if
// the document is not found.
Client.prototype.get = function (id, query) {
  return this.request({
    path: '/' + prepareId(id),
    query: query
  }).fail(function (error) {
    if (error.statusCode === 404) return null;
    throw error;
  });
};

// Returns a promise for the response headers of a HEAD request for the document
// with the given id. Resolves to null if the document is not found.
Client.prototype.head = function (id, query) {
  return this.request({
    method: 'HEAD',
    path: '/' + prepareId(id),
    query: query
  }, resolveHeaders).fail(function (error) {
    if (error.statusCode === 404) return null;
    throw error;
  });
};

// Returns a promise for the given document after saving it to the database.
// The document's _id and _rev are automatically updated.
Client.prototype.save = function (doc) {
  var options = {};

  if (doc._id) {
    options.method = 'PUT';
    options.path = '/' + prepareId(doc._id);
  } else {
    options.method = 'POST';
  }

  options.body = utils.docToJson(doc);
  options.headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(options.body)
  };

  return this.request(options).then(function (data) {
    doc._id = data.id;
    doc._rev = data.rev;
    return doc;
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
      options.path += '/' + prepareId(doc._id);
    }

    options.body = utils.docToJson(doc);
    options.headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(options.body)
    };
  }

  return this.request(options, resolveResponse).then(function (response) {
    return getDoc(response).then(function (newDoc) {
      if (doc) {
        if (typeof newDoc === 'object') {
          for (var prop in newDoc) {
            doc[prop] = newDoc[prop];
          }
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
};

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
    if (query.keys) {
      options.method = 'POST';
      options.body = JSON.stringify({ keys: query.keys });
      if (!options.headers) options.headers = {};
      options.headers['Content-Type'] = 'application/json';
      delete query.keys;
    }
    if (!isEmpty(query)) options.query = query;
  }

  return this.request(options);
};

Client.prototype.viewRows = function (designView, query) {
  return this.view(designView, query).get('rows');
};

Client.prototype.viewKeys = function (designView, query) {
  return this.viewRows(designView, query).then(getKeys);
};

Client.prototype.viewValues = function (designView, query) {
  return this.viewRows(designView, query).then(getValues);
};

Client.prototype.viewDocs = function (designView, query) {
  query = query || {};
  query.include_docs = true;
  return this.viewRows(designView, query).then(function (rows) {
    var docs = [];

    // There are some rare cases when include_docs returns a null document! :/
    // http://mail-archives.apache.org/mod_mbox/couchdb-dev/201002.mbox/%3C3B6CF0F8-2226-4315-9131-91AB02DC7255@apache.org%3E
    // http://grokbase.com/p/couchdb/dev/102mjq3hq9/include-docs-returning-doc-null
    var row;
    for (var i = 0, len = rows.length; i < len; ++i) {
      row = rows[i];
      if (row.doc) docs.push(row.doc);
    }

    return docs;
  });
};

Client.prototype.viewDoc = function (designView, query) {
  query = query || {};
  query.limit = 1;
  return this.viewDocs(designView, query).then(function (docs) {
    return docs[0] || null;
  });
};

Client.prototype.allRows = function (query) {
  return this.viewRows('_all_docs', query);
};

Client.prototype.allKeys = function (query) {
  return this.allRows(query).then(getKeys);
};

Client.prototype.allValues = function (query) {
  return this.allRows(query).then(getValues);
};

Client.prototype.allDocs = function (query) {
  query = query || {};
  query.include_docs = true;
  return this.allRows(query).then(function (rows) {
    var docs = [];

    // From http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API#Fetch_Multiple_Documents_With_a_Single_Request
    // - The row for a deleted document will have the revision ID of the deletion, and an extra key "deleted":true in the "value" property.
    // - The row for a nonexistent document will just contain an "error" property with the value "not_found".
    var row;
    for (var i = 0, len = rows.length; i < len; ++i) {
      row = rows[i];
      if (row.error === 'not_found') {
        docs.push(null);
      } else {
        docs.push(row.doc);
      }
    }

    return docs;
  });
};

Client.prototype.bulkDocs = function (docs) {
  if (!docs.length) return q([]);

  var options = {};
  options.method = 'POST';
  options.path = '/_bulk_docs';
  options.body = utils.docToJson({ docs: docs });
  options.headers = { 'Content-Type': 'application/json' };

  return this.request(options).then(function (results) {
    return docs.map(function (doc, i) {
      var result = results[i];
      if (result.ok) {
        doc._id = result.id;
        doc._rev = result.rev;
      }
      return doc;
    });
  });
};

// Returns a promise for the HTTP response to a GET request for the attachment
// with the given `name` on the given document.
Client.prototype.getAttachment = function (doc, name) {
  return this.request({ path: makeAttachmentPath(doc._id, name) }, resolveResponse);
};

// Creates/updates an attachment with the given `name` on the given document.
// The `body` should be the entire contents of the attachment as a string or a
// readable stream for its contents. Returns a promise for the document that is
// returned (see http://wiki.apache.org/couchdb/HTTP_Document_API#Standalone_Attachments).
//
// NOTE: It is NOT safe to save the same document again without deleting the
// attachment since it will not have the _attachments property.
Client.prototype.putAttachment = function (doc, name, type, size, body) {
  var query;
  if (doc._rev) query = { rev: doc._rev };
  return this.request({
    method: 'PUT',
    path: makeAttachmentPath(doc._id, name),
    headers: { 'Content-Type': type, 'Content-Length': size },
    query: query,
    body: body
  });
};

// Deletes the attachment with the given `name` from the given document. Returns
// a promise for the document that is returned (see http://wiki.apache.org/couchdb/HTTP_Document_API#Standalone_Attachments).
Client.prototype.deleteAttachment = function (doc, name) {
  return this.request({
    method: 'DELETE',
    path: makeAttachmentPath(doc._id, name)
  });
};

// Returns a promise for a document that describes changes that have been made
// according to the given `query` parameters (see http://wiki.apache.org/couchdb/HTTP_Document_API#A_changes).
// If the `feed` parameter is "continuous", returns an emitter for documents
// as they are received over a persistent connection to the database.
Client.prototype.changes = function (query) {
  var resolver = query && query.feed == 'continuous' ? resolveDocStream : resolveDoc;
  return this.request({ path: '/_changes', query: query }, resolver);
};

/* resolvers */

function resolveResponse(value, request, response) {
  value.resolve(response);
}

function resolveHeaders(value, request, response) {
  value.resolve(response.headers);
}

function resolveDoc(value, request, response) {
  value.resolve(getDoc(response));
}

function resolveDocStream(value, request, response) {
  // Remove the request socket from the agent's connection
  // pool since streaming could last indefinitely.
  request.socket.emit('agentRemove');

  var emitter = new events.EventEmitter;
  emitter.request = request;
  emitter.response = response;

  var buffer;
  response.on('data', function (chunk) {
    emitter.emit('data', chunk);

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

        emitter.emit('doc', doc);
      }

      index += Buffer.byteLength(json) + 1;
    }

    if (index) buffer = buffer.slice(index);
  });

  response.on('end', function () {
    emitter.emit('end');
  });

  value.resolve(emitter);
}

/* helpers */

function makeAttachmentPath(docId, name) {
  return '/' + prepareId(docId) + '/' + encodeURIComponent(name);
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

function prepareId(id) {
  return isDesignId(id) ? id : encodeURIComponent(id);
}

function isDesignId(id) {
  return (/^_design\//).test(id);
}

function isSuccessCode(code) {
  return code >= 200 && code < 400;
}

function isEmpty(object) {
  for (var key in object) return false;
  return true;
}

function getDoc(response) {
  return utils.bufferStream(response).then(function (buffer) {
    var body = buffer.toString();
    return body === '' ? null : JSON.parse(body);
  });
}

function getKeys(rows) {
  return rows.map(function (row) {
    return row.key;
  });
}

function getValues(rows) {
  return rows.map(function (row) {
    return row.value;
  });
}
