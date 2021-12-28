
const rsyslog = require('node-rsyslog');
const _ = require('lodash');

const { CRIT, ERROR, WARNING, INFO, DEBUG } = rsyslog.SEVERITY;
const rsyslogOptions = {
  // host is provided in plugin params
  appname: 'playgen',
  method: 'TCP',
};

const {
  LOG_LEVEL_FATAL_VALUE,
  LOG_LEVEL_ERROR_VALUE,
  LOG_LEVEL_WARNING_VALUE,
  LOG_LEVEL_INFO,
  LOG_LEVEL_INFO_VALUE,
  LOG_LEVEL_DEBUG_VALUE,
  LOG_LEVELS,
} = require('../../constants');

const PLUGIN_NAME = 'rsyslog';

let configLogLevelValue = LOG_LEVEL_INFO_VALUE;
let remoteHost;
let packJson;
let logger;

const initPlugin = (config, params) => {
  if (!_.isUndefined(config) && !_.isUndefined(config.plugins) && !_.isUndefined(config.plugins.logging)) {
    configLogLevelValue = LOG_LEVELS[config.logLevel];
    const remoteHostParam = _.filter(params, { name: 'remoteHost' });
    remoteHost = _.isEmpty(remoteHostParam) ? false : remoteHostParam[0].value;
    rsyslogOptions.host = remoteHost;
    const packJsonParam = _.filter(params, { name: 'packJson' });
    packJson = _.isEmpty(packJsonParam) ? false : packJsonParam[0].value;
    logger = new rsyslog.RSyslog(rsyslogOptions);
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
    let rsyslogLevel = INFO;
    switch (logLevelValue) {
      case LOG_LEVEL_FATAL_VALUE:
        rsyslogLevel = CRIT;
        break;
      case LOG_LEVEL_ERROR_VALUE:
        rsyslogLevel = ERROR;
        break;
      case LOG_LEVEL_WARNING_VALUE:
        rsyslogLevel = WARNING;
        break;
      case LOG_LEVEL_INFO_VALUE:
        rsyslogLevel = INFO;
        break;
      case LOG_LEVEL_DEBUG_VALUE:
        rsyslogLevel = DEBUG;
        break;
      default:
        break;
    }
    const logMessagePrefix = `${new Date().toISOString()} ${logLevelString}`;
    if (typeof message === 'object') {
      logger.send(rsyslogLevel, `${logMessagePrefix}...`);
      logger.send(rsyslogLevel, JSON.stringify(message, null, packJson ? null : 1));
    } else {
      logger.send(rsyslogLevel, `${logMessagePrefix}: ${message}`);
    }
  }
};

module.exports = { name: PLUGIN_NAME, initPlugin, log };
