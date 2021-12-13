
const _ = require('lodash');

const {
  LOG_LEVEL_FATAL_VALUE,
  LOG_LEVEL_ERROR_VALUE,
  LOG_LEVEL_WARNING_VALUE,
  LOG_LEVEL_INFO,
  LOG_LEVEL_INFO_VALUE,
  LOG_LEVEL_DEBUG_VALUE,
  LOG_LEVELS,
} = require('../../constants');

let configLogLevelValue = LOG_LEVEL_INFO_VALUE;
let packJson;

const initPlugin = (config, params) => {
  if (!_.isUndefined(config) && !_.isUndefined(config.plugins) && !_.isUndefined(config.plugins.logging)) {
    configLogLevelValue = LOG_LEVELS[config.logLevel];
    const packJsonParam = _.filter(params, { name: 'packJson' });
    packJson = _.isEmpty(packJsonParam) ? false : packJsonParam[0].value;
    log(LOG_LEVEL_INFO, `Set configLogLevelValue to ${_.toUpper(config.logLevel)} (${configLogLevelValue})`);
  }
};

const log = (level, message) => {
  let logLevelString = level.toUpperCase();
  const logLevelValue = LOG_LEVELS[level];
  if (_.isUndefined(logLevelValue)) {
    logLevelString = 'UNKNOWN LEVEL';
  }
  if (logLevelValue >= configLogLevelValue) {
    let consoleFunction = console.log;
    switch (logLevelValue) {
      case LOG_LEVEL_FATAL_VALUE:
      case LOG_LEVEL_ERROR_VALUE:
        consoleFunction = console.error;
        break;
      case LOG_LEVEL_WARNING_VALUE:
        consoleFunction = console.warn;
        break;
      case LOG_LEVEL_INFO_VALUE:
        consoleFunction = console.info;
        break;
      case LOG_LEVEL_DEBUG_VALUE:
        consoleFunction = console.debug;
        break;
      default:
        break;
    }
    const logMessagePrefix = `${new Date().toISOString()} ${logLevelString}`;
    if (typeof message === 'object') {
      consoleFunction(`${logMessagePrefix}...`);
      consoleFunction(JSON.stringify(message, null, packJson ? null : 1));
    } else {
      consoleFunction(`${logMessagePrefix}: ${message}`);
    }
  }
};

module.exports = { initPlugin, log };
