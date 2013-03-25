var assert = require('assert');
var when = require('when');
var _slice = Array.prototype.slice;

var utils = module.exports;

utils.docToJson = docToJson;
function docToJson(doc) {
  return JSON.stringify(doc, function (key, value) {
    return (typeof value === 'function') ? value.toString() : value;
  });
}

utils.docsAreEqual = docsAreEqual;
function docsAreEqual(one, two) {
  try {
    assert.deepEqual(normalize(one), normalize(two));
    return true;
  } catch (err) {
    return false;
  }
}

function normalize(doc) {
  return JSON.parse(utils.docToJson(doc));
}

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
  var value = when.defer();
  var chunks = [];

  // Start the data flowing.
  var chunk = stream.read();
  if (chunk) {
    chunks.push(chunk);
  }

  stream.on('readable', function () {
    chunks.push(stream.read());
  });

  stream.on('error', function (error) {
    value.reject(error);
  });

  stream.on('end', function () {
    value.resolve(Buffer.concat(chunks));
  });

  return value.promise;
}
