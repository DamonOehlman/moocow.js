var extend = require('cog/extend');
var mucus = require('mucus');
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

  Thanks to the amazing power of [`browserify-cdn`](https://wzrd.in/), moocow.js
  can be used on any website!

  ```html
  <script src="https://wzrd.in/standalone/moocow@latest"></script>
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
  script.src = 'https://wzrd.in/standalone/moocow@latest';
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
  var defaultAudio = fs.readFileSync(__dirname + '/audio/Mudchute_cow_1.ogg');

  var audioFiles = {
    cow: crel('audio', { src: bufferUrl(defaultAudio) })
  };

  return mucus(target, function(changes) {
    if (changes.added.length > 0) {
      audioFiles.cow.play();
    }
  });
};
