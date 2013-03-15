var assert = require('assert');
var rsvp = require('rsvp');
var Promise = rsvp.Promise;

var utils = module.exports;

utils.docsAreEqual = docsAreEqual;
function docsAreEqual(existingDoc, doc) {
  var object = JSON.parse(docToJson(doc));

  try {
    assert.deepEqual(existingDoc, object);
    return true;
  } catch (err) {
    return false;
  }
}

utils.docToJson = docToJson;
function docToJson(doc) {
  return JSON.stringify(doc, function (key, value) {
    return (typeof value === 'function') ? value.toString() : value;
  });
}

var _slice = Array.prototype.slice;

utils.merge = merge;
function merge(object) {
  _slice.call(arguments, 1).forEach(function (obj) {
    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        object[prop] = obj[prop];
      }
    }
  });

  return object;
}

utils.bufferStream = bufferStream;
function bufferStream(stream) {
  var promise = new Promise;
  var chunks = [];

  stream.on('readable', function () {
    chunks.push(stream.read());
  });

  stream.on('error', function (error) {
    promise.reject(error);
  });

  stream.on('end', function () {
    promise.resolve(Buffer.concat(chunks));
  });

  return promise;
}
