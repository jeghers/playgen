
const fs = require('fs');
const _ = require('lodash');

const {
  LOG_LEVEL_INFO,
  LOG_LEVEL_INFO_VALUE,
  LOG_LEVELS,
  DEFAULT_LOG_FILE_NAME,
} = require('../../constants');

const PLUGIN_NAME = 'localFile';

let configLogLevelValue = LOG_LEVEL_INFO_VALUE; // default
let logFileName;
let logFileStream;
let packJson;

const openLogFile = fileName => {
  logFileStream = fs.createWriteStream(fileName, { flags: 'a', autoClose: true });
};

const initPlugin = (config, params) => {
  const fileNameParam = _.filter(params, { name: 'fileName' });
  logFileName = _.isEmpty(fileNameParam) ? DEFAULT_LOG_FILE_NAME : fileNameParam[0].value;
  const packJsonParam = _.filter(params, { name: 'packJson' });
  packJson = _.isEmpty(packJsonParam) ? false : packJsonParam[0].value;
  if (!_.isUndefined(logFileStream)) {
    // just in case this gets initialized more than once
    logFileStream.end();
  }
  if (!_.isUndefined(config) && !_.isUndefined(config.plugins) && !_.isUndefined(config.plugins.logging)) {
    configLogLevelValue = LOG_LEVELS[config.logLevel];
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
    if (_.isUndefined(logFileStream)) {
      openLogFile(logFileName);
    }
    const logMessagePrefix = `${new Date().toISOString()} ${logLevelString}`;
    if (typeof message === 'object') {
      logFileStream.write(`${logMessagePrefix}:\n`);
      logFileStream.write(JSON.stringify(message, null, packJson ? null : 1));
    } else {
      logFileStream.write(`${logMessagePrefix}: ${message}`);
    }
    logFileStream.write('\n');
  }
};

module.exports = { name: PLUGIN_NAME, initPlugin, log };
