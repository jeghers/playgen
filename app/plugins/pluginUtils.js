
const _ = require('lodash');

let globalConfig;

const initAllPlugins = config => {
  globalConfig = config;
  if (config && config.plugins) {
    _.forEach(config.plugins, pluginType => {
      _.forEach(pluginType, pluginItem => {
        if (pluginItem.pluginImpl && pluginItem.pluginImpl.initPlugin) {
          pluginItem.pluginImpl.initPlugin(config, pluginItem.params);
        }
      });
    });
  }
};

const getDefaultPlugin = type => {
  let returnPlugin; // undefined unless set later
  const pluginsOfType = globalConfig.plugins[type];
  if (pluginsOfType) {
    _.forEach(pluginsOfType, plugin => {
      if (plugin.default) {
        returnPlugin = plugin;
        return false;
      }
      return true;
    });
  }
  return returnPlugin;
}

const getPlugin = (type, name) => {
  const pluginsOfType = globalConfig.plugins[type];
  if (pluginsOfType) {
    const plugins = _.filter(pluginsOfType, { name });
    return _.isEmpty(plugins) ? null : plugins[0];
  }
  return null;
}

module.exports = {
  initAllPlugins,
  getDefaultPlugin,
  getPlugin,
};
