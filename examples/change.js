var moocow = require('..');
var h = require('hyperscript');
var list = h('ul');

moocow(list);

document.body.appendChild(list);

setInterval(function() {
  list.appendChild(h('li', 'hello'));
}, 5000);
