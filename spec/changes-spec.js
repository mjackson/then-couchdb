require('./helper');

describe('continuous changes', function () {
  var numFrames, changes;
  beforeEach(function () {
    numFrames = 0;
    changes = [];

    db.changes({ feed: 'continuous', include_docs: true }).then(function (emitter) {
      emitter.on('data', function (chunk) {
        numFrames += 1;
      });

      emitter.on('doc', function (change) {
        changes.push(change);
      });
    });
  });

  describe('when a document that contains multi-byte characters is received across multiple frames', function () {
    var doc;
    beforeEach(function () {
      var mbChar = '\uF090';
      var charLength = Buffer.byteLength(mbChar);
      var frameSize = Math.pow(2, 16);
      var messageLength = Math.ceil((frameSize * 2) / charLength);
      var message = new Array(messageLength + 1).join(mbChar);

      return db.save({ message: message }).then(function (newDoc) {
        doc = newDoc;
        return delay(10);
      });
    });

    it('parses the message correctly', function () {
      assert(numFrames > 1);
      assert(changes.length);
      var lastChange = changes[changes.length - 1];
      compareDocs(lastChange.doc, doc);
    });
  });
});

var Promise = require('rsvp').Promise;

function delay(n) {
  var promise = new Promise;

  setTimeout(function () {
    promise.resolve();
  }, n);

  return promise;
}
