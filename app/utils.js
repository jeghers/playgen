
const _ = require('lodash');

const { getPlugin, getDefaultPlugin } = require('./plugins/pluginUtils');
const {
  PLUGIN_TYPE_LOGGING,
  PLUGIN_TYPE_SONG_DETAILS,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_INFO,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_NONE,
} = require('./constants');
let config;

const setConfigForUtils = configToInstall => {
  config = configToInstall;
};

/* eslint-disable max-params */
const handleError = (res, status, error, message) => {
  log(LOG_LEVEL_ERROR, '****** handleError');
  log(LOG_LEVEL_ERROR, message);
  res.status(status);
  res.json({ status: error, message: message });
};

const watchLoadFilePromise = p => {
  if (p) {
    p.then((responsePlaylist) => {
      log(LOG_LEVEL_INFO, `Playlist ${responsePlaylist.name} loaded ${responsePlaylist.count()} songs successfully`);
      log(LOG_LEVEL_DEBUG, 'Playlist...');
      log(LOG_LEVEL_DEBUG, responsePlaylist);
    }, (error) => {
      log(LOG_LEVEL_ERROR, `Promise failed: ${error.toString()}`);
    });
  }
};

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

let loggingErrorGiven = false;
let globalLogType;

const log = (level, message, plugin) => {
  if (_.isUndefined(globalLogType)) {
    globalLogType = getPlugin(PLUGIN_TYPE_LOGGING, config.logType);
    if (_.isUndefined(globalLogType)) {
      globalLogType = getDefaultPlugin(PLUGIN_TYPE_LOGGING);
    }
  }
  if (level === LOG_LEVEL_NONE) {
    return;
  }
  const pluginToUse = _.isUndefined(plugin) ? globalLogType : plugin;
  if (!_.isUndefined(pluginToUse.pluginImpl) &&
    !_.isUndefined(pluginToUse.pluginImpl.log)) {
    pluginToUse.pluginImpl.log(level, message);
  } else if (!loggingErrorGiven) {
    console.error('*** No logging available');
    loggingErrorGiven = true;
  }
};

const extract = (songFilePath, plugin) => {
  const pluginToUse = plugin || getDefaultPlugin(PLUGIN_TYPE_SONG_DETAILS);
  if (!_.isUndefined(pluginToUse.pluginImpl) &&
      !_.isUndefined(pluginToUse.pluginImpl.extract) &&
      !_.isUndefined(songFilePath)) {
    return pluginToUse.pluginImpl.extract(songFilePath);
  }
  return false;
};

module.exports = {
  setConfigForUtils,
  handleError,
  watchLoadFilePromise,
  sleep,
  log,
  extract,
};
