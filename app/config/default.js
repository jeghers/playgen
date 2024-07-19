
module.exports = {
  session: {
    port: 3000,
    secure: false, // use this later?
  },
  db: {
    host: 'localhost',
    user: 'root',
    port: 3306,
    password: 'your_db_password',
    database: 'your_db_schema',
    reconnectTime: 1000,
  },
  playlists: {
    songHistoryLimit: 500,
    duplicateReplacementRetries: 10,
  },
  downloads: {
    enabled: true,
    downloadsPath: './downloads',
    webServerBaseUrl: 'https://www.t4p.com/blues/icecastDownloads',
    scanIntervalMinutes: 5,
    // all expire times add up cumulatively
    // expireTimeMinutes: 1,
    // expireTimeMinutes: 25,
    // expireTimeHours: 0,
    // expireTimeDays: 7,
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
  healthCheckRetryTime: 5000,
  isWindowsService: process.env.IS_WINDOWS_SERVICE === 'true',
};
