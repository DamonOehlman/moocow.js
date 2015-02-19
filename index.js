var extend = require('cog/extend');
var pluck = require('whisk/pluck');
var flatten = require('flatten-list');
var fs = require('fs');
var bufferUrl = require('buffer-url');
var crel = require('crel');

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
  <script src="https://cdn.rawgit.com/DamonOehlman/moocow.js/v1.0.2/bundle.js"></script>
  <script>
  var newEl = document.createElement('div');

  moocow(document.body);
  document.body.appendChild(newEl);
  </script>
  ```

  Or you can use it on any site in using developer tools - load the script into the
  currently displayed page (this might be blocked by cross origin policy):

  ```js
  var script = document.createElement('script');
  script.src = 'https://cdn.rawgit.com/DamonOehlman/moocow.js/v1.0.2/bundle.js';
  document.body.appendChild(script);
  ```

  Now inspect an element, and you can moocow enable it:

  ```js
  moocow($0);
  ```

  ## Acknowledgements

  - [Mudchute_cow_1.ogg](http://commons.wikimedia.org/wiki/File:Mudchute_cow_1.ogg)

**/
module.exports = function(target, opts) {
  var observer = new MutationObserver(handleMutations);
  var stop = observer.disconnect.bind(observer);
  var defaultAudio = fs.readFileSync(__dirname + '/Mudchute_cow_1.ogg');

  var audioFiles = {
    cow: crel('audio', { src: bufferUrl(defaultAudio) })
  };

  function handleMutations(records) {
    var addedNodes = flatten(records.map(pluck('addedNodes')));
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
