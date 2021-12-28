
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
        default: true,
      },
      {
        name: 'mp3Tags',
      },
    ],
  },
  logType: 'console',
  logLevel: 'info',
  isWindowsService: process.env.IS_WINDOWS_SERVICE === 'true',
};
