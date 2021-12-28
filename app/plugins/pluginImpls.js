
const loggingConsolePlugin = require('./logging/console');
const loggingLocalFilePlugin = require('./logging/localFile');
const loggingRSyslogPlugin = require('./logging/rsyslog');
const songDetailsSFFPlugin = require('./songDetails/standardFieldedFilename');
const songDetailsMP3Plugin = require('./songDetails/mp3Tags');

const pluginImpls = [
  loggingConsolePlugin,
  loggingLocalFilePlugin,
  loggingRSyslogPlugin,
  songDetailsSFFPlugin,
  songDetailsMP3Plugin,
];

module.exports = { pluginImpls };
