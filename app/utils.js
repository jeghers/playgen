
const _ = require('lodash');

const config = require('./config');
const {
  LOG_LEVEL_FATAL,
  LOG_LEVEL_FATAL_VALUE,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_ERROR_VALUE,
  LOG_LEVEL_WARNING,
  LOG_LEVEL_WARNING_VALUE,
  LOG_LEVEL_INFO,
  LOG_LEVEL_INFO_VALUE,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_DEBUG_VALUE,
  LOG_LEVEL_NONE,
  LOG_LEVEL_NONE_VALUE,
} = require('./constants');

const logLevels = {
  [LOG_LEVEL_FATAL]: LOG_LEVEL_FATAL_VALUE,
  [LOG_LEVEL_ERROR]: LOG_LEVEL_ERROR_VALUE,
  [LOG_LEVEL_WARNING]: LOG_LEVEL_WARNING_VALUE,
  [LOG_LEVEL_INFO]: LOG_LEVEL_INFO_VALUE,
  [LOG_LEVEL_DEBUG]: LOG_LEVEL_DEBUG_VALUE,
  [LOG_LEVEL_NONE]: LOG_LEVEL_NONE_VALUE,
};

const configLogLevelValue = logLevels[config.log] || LOG_LEVEL_INFO_VALUE;

/* eslint-disable max-params */
const handleError = (res, status, error, message) => {
  log(LOG_LEVEL_ERROR, '****** handleError');
  log(LOG_LEVEL_ERROR, message);
  res.status(status);
  res.json({ status: error, message: message });
};

const watchPromise = p => {
  if (p) {
    p.then((responsePlaylist) => {
      log(LOG_LEVEL_INFO, 'Playlist ' + responsePlaylist.name + ' loaded ' +
        responsePlaylist.count() + ' songs successfully');
      log(LOG_LEVEL_DEBUG, 'Playlist...');
      log(LOG_LEVEL_DEBUG, responsePlaylist);
    }, (error) => {
      log(LOG_LEVEL_ERROR, 'Promise failed.', error);
    });
  }
};

const log = (level, message) => {
  const logLevelValue = logLevels[level];
  if (_.isUndefined(logLevelValue)) {
    // logging error
    console.log(`UNKNOWN LEVEL '${level}': ${message}`)
  } else if (logLevelValue >= configLogLevelValue) {
    let loggingCall = console.log;
    switch (logLevelValue) {
      case LOG_LEVEL_FATAL_VALUE:
      case LOG_LEVEL_ERROR_VALUE:
        loggingCall = console.error;
        break;
      case LOG_LEVEL_WARNING_VALUE:
        loggingCall = console.warn;
        break;
      case LOG_LEVEL_INFO_VALUE:
        loggingCall = console.info;
        break;
      case LOG_LEVEL_DEBUG_VALUE:
        loggingCall = console.debug;
        break;
      default:
        break;
    }
    if (typeof message === 'object') {
      loggingCall(`${level.toUpperCase()}:`);
      loggingCall(message);
    } else {
      loggingCall(`${level.toUpperCase()}: ${message}`);
    }
  }
};

module.exports = {
  handleError,
  watchPromise,
  log,
};
