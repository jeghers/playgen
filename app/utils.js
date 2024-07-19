
const _ = require('lodash');

const { getDefaultPlugin, getPlugins } = require('./plugins/pluginUtils');
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
  // JSON content might not be returned depending on the status code
  res.json({ status: error, message: message });
};

const watchLoadFilePromise = p => {
  if (p) {
    p.then((responsePlaylist) => {
      if (responsePlaylist) {
        log(LOG_LEVEL_INFO, `Playlist ${responsePlaylist.name} loaded ${responsePlaylist.count()} songs successfully`);
        log(LOG_LEVEL_DEBUG, 'Playlist...');
        log(LOG_LEVEL_DEBUG, responsePlaylist);
      }
    }, (error) => {
      log(LOG_LEVEL_ERROR, `Promise failed: ${error.toString()}`);
    });
  }
};

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

let loggingErrorGiven = false;
let loggingPluginsToUse;

const log = (level, message) => {
  if (_.isUndefined(loggingPluginsToUse)) {
    const { logType } = config;
    const pluginNames = _.isArray(logType) ? logType : [ logType ];
    loggingPluginsToUse = getPlugins(PLUGIN_TYPE_LOGGING, pluginNames);
    if (_.isUndefined(loggingPluginsToUse) || _.isEmpty(loggingPluginsToUse)) {
      loggingPluginsToUse = [ getDefaultPlugin(PLUGIN_TYPE_LOGGING) ];
    }
  }
  if (level === LOG_LEVEL_NONE) {
    return;
  }
  _.forEach(loggingPluginsToUse, pluginToUse => {
    if (!_.isUndefined(pluginToUse.pluginImpl) &&
      !_.isUndefined(pluginToUse.pluginImpl.log)) {
      pluginToUse.pluginImpl.log(level, message);
    } else if (!loggingErrorGiven) {
      console.error(`*** Logging plugin "${pluginToUse.name}" failed`);
      loggingErrorGiven = true;
    }
  });
};

const extractSongInfo = (songFilePath, plugin) => {
  const pluginToUse = plugin || getDefaultPlugin(PLUGIN_TYPE_SONG_DETAILS);
  if (!_.isUndefined(pluginToUse.pluginImpl) &&
      !_.isUndefined(pluginToUse.pluginImpl.extractSongInfo) &&
      !_.isUndefined(songFilePath)) {
    return pluginToUse.pluginImpl.extractSongInfo(songFilePath);
  }
  return false;
};

module.exports = {
  setConfigForUtils,
  handleError,
  watchLoadFilePromise,
  sleep,
  log,
  extractSongInfo,
};
