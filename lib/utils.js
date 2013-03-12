var assert = require('assert');
var q = require('q');

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
  var value = q.defer();

  var buffers = [];
  stream.on('data', function (chunk) {
    buffers.push(Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk));
  });

  stream.on('end', function () {
    value.resolve(Buffer.concat(buffers));
  });

  stream.on('error', function (error) {
    value.reject(error);
  });

  if (typeof stream.resume === 'function') stream.resume();

  return value.promise;
}
