
const fs = require('fs');
const _ = require('lodash');

const defaults = require('./default.js');
const runMode = process.env.NODE_ENV || 'development';
const config = require('./' + runMode + '.js');
const { PLAYGEN_CONFIG_JSON } = process.env;

let extras;
if (PLAYGEN_CONFIG_JSON) {
  // read the file
  try {
    const jsonData = fs.readFileSync(PLAYGEN_CONFIG_JSON);
    extras = JSON.parse(jsonData.toString());
  } catch (error) {
    console.error(`Failed to read PLAYGEN_CONFIG_JSON file ${PLAYGEN_CONFIG_JSON}`);
  }
}
config.runMode = runMode;

const mergeArrayByProperty = (a1, a2, propertyName) => {
  const defaultsInA2 = _.find(a2, { default: true });
  if (!_.isEmpty(defaultsInA2)) {
    _.forEach(a1, itemInA1 => { itemInA1.default = false; });
  }
  const result = _.unionBy(a2, a1, propertyName);
  return _.cloneDeep(result);
};

let logging = config.plugins && config.plugins.logging;
let songDetails = config.plugins && config.plugins.songDetails;
if (extras) {
  logging = mergeArrayByProperty(logging, extras.plugins && extras.plugins.logging, 'name');
  songDetails = mergeArrayByProperty(songDetails, extras.plugins && extras.plugins.songDetails, 'name');
}
logging = mergeArrayByProperty(defaults.plugins && defaults.plugins.logging, logging, 'name');
songDetails = mergeArrayByProperty(defaults.plugins && defaults.plugins.songDetails, songDetails, 'name');

const configExports = _.merge(defaults, config, extras);
configExports.plugins.logging = logging;
configExports.plugins.songDetails = songDetails;

module.exports = configExports;
