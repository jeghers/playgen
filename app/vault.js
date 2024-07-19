const vault = require('node-vault');
const http = require('http');
const httpStatus = require('http-status-codes');
const _ = require('lodash');

const { LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_DEBUG, VAULT_TRUSTED_HELPER_TIMEOUT } = require('./constants');
const { log } = require('./utils');

const vaultSettings = require('./config/vaultSettings');

const vaultOptions = {
  apiVersion: 'v1', // not yet used?
  endpoint: process.env.VAULT_ADDR,
};

const vaultClientTypePrefix = process.env.VAULT_CLIENT_TYPE;

let vaultClient = _.isEmpty(vaultOptions.endpoint) ? null : vault(vaultOptions);

/* eslint-disable camelcase */
const initVault = async () => {
  if (_.isNull(vaultClient)) {
    return false;
  }
  try {
    const status = await vaultClient.status();
    if (!status.initialized) {
      await vaultClient.init();
    }
    log(LOG_LEVEL_INFO, `Vault is ${status.initialized ? '' : 'un'}initialized ${status.sealed ? 'but ' : 'and un'}sealed`);
    return status.initialized && !status.sealed;
  } catch (error) {
    log(LOG_LEVEL_ERROR, `Failed to connect to vault: ${error && (error.message || error.error.message)}`);
    return false;
  }
}

const setVaultAppRoleToken = appRoleToken => {
  vaultOptions.token = appRoleToken;
  vaultClient = !_.isEmpty(vaultOptions.endpoint) && vault(vaultOptions); // get new client with app role token
};

const getVaultStatus = async () => {
  if (_.isEmpty(vaultOptions.endpoint) || _.isNull(vaultOptions.token)) {
    return {
      initialized: false,
      sealed: null,
      appRole: vaultClientAppRole,
      authenticated: false,
      error: 'No Vault service available',
    };
  }
  try {
    const status = await vaultClient.status();
    const { initialized, sealed } = status;
    return {
      initialized,
      sealed,
      appRole: vaultClientAppRole,
      authenticated: !_.isUndefined(vaultOptions.token),
    };
  } catch (error) {
    log(LOG_LEVEL_ERROR, `Failed to connect to vault: ${error.message}`);
    /* eslint-disable no-undefined */
    return {
      initialized: false,
      sealed: null,
      appRole: vaultClientAppRole,
      authenticated: false,
      error: error.message,
    };
  }
};

const vaultClientAppRole = process.env.VAULT_APP_ROLE;

const vthOptions = {
  // TODO: get VTH addr dynamically
  host: 'localhost',
  port: '9999',
  path: `/api/v1/appRoles/${vaultClientAppRole}`,
  timeout: VAULT_TRUSTED_HELPER_TIMEOUT,
};

const authenticateVaultAppRole = () => {
  log(LOG_LEVEL_INFO, `Attempting to authenticate Vault app-role ${vaultClientAppRole}`);
  return new Promise((resolve, reject) => {
    const request = http.request(vthOptions, res => {
      log(LOG_LEVEL_INFO, `App-role authentication status: ${res.statusCode}`);
      if (res.statusCode === httpStatus.OK) {
        res.on('data', data => {
          const json = JSON.parse(data);
          log(LOG_LEVEL_DEBUG, 'App-role authentication data...');
          log(LOG_LEVEL_DEBUG, json);
          resolve(json.token);
        });
      } else {
        const error = new Error();
        error.statusCode = res.statusCode;
        if (res.statusCode === httpStatus.NOT_FOUND) {
          error.message = `Vault App Role ${vaultClientAppRole} not found`;
        } else {
          error.message = 'Vault Helper API call returned failure';
        }
        reject(error);
      }
    });
    request.on('error', error => {
      log(LOG_LEVEL_ERROR, 'APP-ROLE AUTH ERROR');
      log(LOG_LEVEL_ERROR, error);
      error.statusCode = httpStatus.INTERNAL_SERVER_ERROR;
      reject(error);
    });
    request.end();
  });
};

const buildVaultPaths = (vaultPaths, vaultPathToConfigFieldMap) => {
  _.forEach(vaultSettings, (vaultSetting, configField) => {
    const vaultSettingParts = vaultSetting.split(':');
    if (vaultSettingParts.length === 2) {
      let vaultPath = vaultSettingParts[0];
      if (vaultClientTypePrefix) {
        vaultPath = vaultPath.replace('%VAULT_CLIENT%', vaultClientTypePrefix);
      } else {
        vaultPath = vaultPath.replace('%VAULT_CLIENT%', '').replace('//', '/');
      }
      log(LOG_LEVEL_DEBUG, `Vault path is ${vaultPath}`);
      const vaultField = vaultSettingParts[1];
      if (_.isUndefined(vaultPaths[vaultPath])) {
        vaultPaths[vaultPath] = [ vaultField ];
      } else {
        vaultPaths[vaultPath].push(vaultField);
      }
      vaultPathToConfigFieldMap[`${vaultPath}:${vaultField}`] = configField;
    } else {
      log(LOG_LEVEL_DEBUG, `${vaultSettings} is not a valid path/subfield`);
    }
  });
};

const applyVaultResponseToConfig = (response, vaultPath, vaultPathToConfigFieldMap, config) => {
  const vaultValues = response && response.data;
  _.forEach(vaultValues, (vaultValue, vaultValueKey) => {
    const vaultSettingsKey = `${vaultPath}:${vaultValueKey}`;
    log(LOG_LEVEL_DEBUG, `vaultSettingsKey = ${vaultSettingsKey}`);
    const configFieldPath = vaultPathToConfigFieldMap[vaultSettingsKey];
    if (_.get(config, configFieldPath)) {
      // config value exists, update it
      if (vaultValue === 'undefined') { // 'undefined' means remove the field
        log(LOG_LEVEL_DEBUG, `Remove the value at ${configFieldPath}`);
        _.unset(config, configFieldPath);
      } else {
        log(LOG_LEVEL_DEBUG, `Store value ${vaultValue} into ${configFieldPath}`);
        _.set(config, configFieldPath, vaultValue);
      }
    } else {
      log(LOG_LEVEL_DEBUG, `Value ${vaultValue} has no ${configFieldPath} to store in`);
    }
  });
};

const updateConfigFromVault = config => {
  return new Promise((resolve, reject) => {
    if (_.isEmpty(vaultOptions.endpoint) || _.isNull(vaultOptions.token)) {
      resolve();
    }
    const vaultPaths = {};
    const vaultPathToConfigFieldMap = {};
    buildVaultPaths(vaultPaths, vaultPathToConfigFieldMap);
    const promises = [];
    _.forEach(vaultPaths, (configFields, vaultPath) => {
      log(LOG_LEVEL_INFO, `Reading vault path ${vaultPath}`);
      const promise = vaultClient.read(vaultPath)
        .then(response => {
          applyVaultResponseToConfig(response, vaultPath, vaultPathToConfigFieldMap, config);
        })
        .catch(error => {
          log(LOG_LEVEL_ERROR, `Failed reading vault path ${vaultPath}`);
          log(LOG_LEVEL_ERROR, error);
        });
      promises.push(promise);
    });
    Promise.all(promises)
      .then(() => { // all promises have been resolved
        log(LOG_LEVEL_INFO, 'Vault values applied to config');
        log(LOG_LEVEL_DEBUG, 'config...');
        log(LOG_LEVEL_DEBUG, config);
        resolve(); // fulfilled
      })
      .catch(error => { // one or more promises have been rejected
        log(LOG_LEVEL_ERROR, `Failed to update config from vault: ${error.message}`);
        log(LOG_LEVEL_ERROR, error);
        reject(error); // rejected
      });
  });
};

module.exports = {
  initVault,
  authenticateVaultAppRole,
  setVaultAppRoleToken,
  getVaultStatus,
  updateConfigFromVault,
};
