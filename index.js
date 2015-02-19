var extend = require('cog/extend');
var pluck = require('whisk/pluck');
var fs = require('fs');

/**
  # moocow.js

  Play audio when a DOM element has child nodes added. What can I say, I'm
  making the world a better place.

  ## Example Usage

  To be completed.

  ## Ready to Use on Any Website

  Because I know how important this script is, it's been browserified to a UMDjs
  module that can be included using any script tag using the following url:

  ```html
  <script src="https://cdn.rawgit.com/DamonOehlman/moocow.js/v1.0.0/bundle.js"></script>
  <script>
  var newEl = document.createElement('div');

  moocow(document.body);
  document.body.appendChild(newEl);
  </script>
  ```

  ## Acknowledgements

  - [Mudchute_cow_1.ogg](http://commons.wikimedia.org/wiki/File:Mudchute_cow_1.ogg)

**/
module.exports = function(target, opts) {
  var observer = new MutationObserver(handleMutations);
  var stop = observer.disconnect.bind(observer);
  var defaultAudio = fs.readFileSync(__dirname + '/Mudchute_cow_1.ogg');

  var audioFiles = {
    cow: createAudioFromBlob(new Blob([defaultAudio], { type: 'audio/ogg' }))
  };

  function createAudioFromBlob(blob) {
    var audio = document.createElement('audio');

    audio.src = URL.createObjectURL(blob);

    return audio;
  }

  function handleMutations(records) {
    var addedNodes = records.map(pluck('addedNodes')).reduce(require('whisk/flatten'));

    if (addedNodes.length > 0) {
      audioFiles.cow.play();
    }
  }

  observer.observe(target, extend({
    attributes: false,
    childList: true,
    characterData: false
  }, opts));

  return stop;
};
