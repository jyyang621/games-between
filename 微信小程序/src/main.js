'use strict';

// Bootstrap only. The host and game modules can also run on the browser adapter.
const { createMiniGame } = require('./app/host.js');
module.exports = { createMiniGame };
if (typeof wx !== 'undefined') module.exports.instance = createMiniGame(wx);
