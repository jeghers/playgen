
module.exports = {
  session: {
    port: 3000,
    secure: false, // use this later?
  },
  db: {
    host: process.env.HOST_IP,
    user: 'root',
    port: 3306,
    password: 'yrut9bUh', // 'your_db_password',
    database: 'BluesWire', // 'your_db_schema',
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
            value: '/var/log/playgen/playgen.log',
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
  logType: [
    'console',
    'localFile'
  ],
  logLevel: 'info',
  healthCheckRetryTime: 5000,
  isWindowsService: process.env.IS_WINDOWS_SERVICE === 'true',
};

/*
update SQL
ALTER TABLE `blueswire`.`playlists`
ADD COLUMN `songDetailsPluginName` VARCHAR(32) NULL DEFAULT NULL AFTER `partialTitleDelimiters`,
CHANGE COLUMN `redundantArtistThreshold` `redundantArtistThreshold` INT(10) UNSIGNED NULL DEFAULT NULL AFTER `redundantTitleThreshold`;

revert SQL
ALTER TABLE `blueswire`.`playlists`
DROP COLUMN `songDetailsPluginName`,
CHANGE COLUMN `partialTitleDelimiters` `partialTitleDelimiters` VARCHAR(16) NULL DEFAULT NULL AFTER `redundantTitleThreshold`;
 */
