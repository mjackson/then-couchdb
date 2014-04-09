var assert = require('assert');

exports.docToJson = function (doc) {
  return JSON.stringify(doc, function (key, value) {
    if (typeof value === 'function')
      return value.toString();

    return value;
  });
};

exports.docsAreEqual = function (one, two) {
  try {
    assert.deepEqual(normalizeDocument(one), normalizeDocument(two));
    return true;
  } catch (err) {
    return false;
  }
};

function normalizeDocument(doc) {
  return JSON.parse(exports.docToJson(doc));
}

var _slice = Array.prototype.slice;

exports.merge = function (object) {
  _slice.call(arguments, 1).forEach(function (obj) {
    for (var prop in obj) {
      if (obj.hasOwnProperty(prop))
        object[prop] = obj[prop];
    }
  });

  return object;
};

var RSVP = require('rsvp');

exports.bufferStream = function (stream) {
  var deferred = RSVP.defer();
  var chunks = [];

  stream.on('data', function (chunk) {
    chunks.push(chunk);
  });

  stream.on('end', function () {
    deferred.resolve(Buffer.concat(chunks));
  });

  stream.on('error', function (error) {
    deferred.reject(error);
  });

  return deferred.promise;
};
