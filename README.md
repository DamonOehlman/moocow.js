# moocow.js

Play audio when a DOM element has child nodes added. What can I say, I'm
making the world a better place.


[![NPM](https://nodei.co/npm/moocow.png)](https://nodei.co/npm/moocow/)



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

## License(s)

### ISC

Copyright (c) 2015, Damon Oehlman <damon.oehlman@gmail.com>

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
