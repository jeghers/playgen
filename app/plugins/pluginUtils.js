
const _ = require('lodash');

let globalConfig;
let pluginImpls;

const getPluginImpl = name => {
  const impls = _.filter(pluginImpls, { name });
  return _.isEmpty(impls) ? null : impls[0];
};

const setPluginImpls = impls => {
  pluginImpls = impls;
};

const initAllPlugins = config => {
  globalConfig = config;
  if (config && config.plugins) {
    _.forEach(config.plugins, pluginType => {
      _.forEach(pluginType, pluginItem => {
        const impl = getPluginImpl(pluginItem.name);
        if (impl && impl.initPlugin) {
          impl.initPlugin(config, pluginItem.params);
        }
        // late binding of the actual impl functions
        pluginItem.pluginImpl = impl;
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
  setPluginImpls,
  initAllPlugins,
  getDefaultPlugin,
  getPlugin,
};
