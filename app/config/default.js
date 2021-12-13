
const loggingConsolePlugin = require('../plugins/logging/console');
const loggingLocalFilePlugin = require('../plugins/logging/localFile');
const songDetailsSFFPlugin = require('../plugins/songDetails/standardFieldedFilename');
const songDetailsMP3Plugin = require('../plugins/songDetails/mp3Tags');

/* eslint-disable no-warning-comments */
module.exports = {
  session: {
    port: 3000,
    secure: false, // use this later?
  },
  db: {
    host: 'localhost',
    user: 'some_user',
    password: 'some_password',
    database: 'some_db_schema',
    reconnectTime: 1000,
  },
  playlists: {
    songHistoryLimit: 500,
    duplicateReplacementRetries: 10,
  },
  // TODO: move plugins to their own separate merge-friendly space
  plugins: {
    logging: [
      {
        name: 'console',
        pluginImpl: loggingConsolePlugin,
        params: [
          {
            name: 'packJson',
            value: false,
          },
        ],
        default: true,
      },
      {
        name: 'localFile',
        pluginImpl: loggingLocalFilePlugin,
        params: [
          {
            name: 'fileName',
            value: 'd:\\src\\playgen\\playgen.log',
          },
          {
            name: 'packJson',
            value: true,
          },
        ],
      },
    ],
    songDetails: [
      {
        name: 'standardFieldedFilename',
        pluginImpl: songDetailsSFFPlugin,
        default: true,
      },
      {
        name: 'mp3Tags',
        pluginImpl: songDetailsMP3Plugin,
      },
    ],
  },
  logType: 'console',
  logLevel: 'info',
  isWindowsService: process.env.IS_WINDOWS_SERVICE === 'true',
};
