
const _ = require('lodash');

/* eslint-disable no-unused-vars */
// typical constant values you might need
// (remove them if you don't actually need them)
const {
  LOG_LEVEL_FATAL_VALUE,
  LOG_LEVEL_ERROR_VALUE,
  LOG_LEVEL_WARNING_VALUE,
  LOG_LEVEL_INFO,
  LOG_LEVEL_INFO_VALUE,
  LOG_LEVEL_DEBUG_VALUE,
  LOG_LEVELS,
} = require('../../constants');

// give it a nicer name than this
const PLUGIN_NAME = 'newLoggingPlugin';

let configLogLevelValue = LOG_LEVEL_INFO_VALUE;
let packJson;

const initPlugin = (config, params) => {
  // this is typical initialization logic needed for logging.  Feel free
  // to add whatever else you need and remove what you don't need.
  if (!_.isUndefined(config) && !_.isUndefined(config.plugins) && !_.isUndefined(config.plugins.logging)) {
    // config.logLevel is a string telling us what level(s) of logging to use
    // configLogLevelValue will convert it to a numeric value
    configLogLevelValue = LOG_LEVELS[config.logLevel];
    // by supporting a 'packJson' parameter, you can control whether
    // JSON data is packed tight or shown more human-readable
    // the 'log' method will can use it (see the example below)
    const packJsonParam = _.filter(params, { name: 'packJson' });
    packJson = _.isEmpty(packJsonParam) ? false : packJsonParam[0].value;
    log(LOG_LEVEL_INFO, `Set configLogLevelValue to ${_.toUpper(config.logLevel)} (${configLogLevelValue})`);
  }
};

const log = (level, message) => {
  // you might want use 'logLevelString' in your logging output
  const logLevelString = level.toUpperCase();
  const logLevelValue = LOG_LEVELS[level];
  if (logLevelValue >= configLogLevelValue) {
    // if log level is high enough, implement your logging logic here.
    //
    // 'message' could be a string or an object.  If it is an object,
    // use JSON.stringify to convert it to a string.  If you are supporting
    // the 'packJson' parameter and it is set to true, then call JSON.stringify
    // with 'space' set to 1, otherwise set it to null.
  }
};

// make sure the export has the plugin name and all the implemented methods
module.exports = { name: PLUGIN_NAME, initPlugin, log };
