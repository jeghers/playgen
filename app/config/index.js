const _ = require('lodash');
const defaults = require('./default.js');
const runMode = process.env.NODE_ENV || 'development';
const config = require('./' + runMode + '.js');
config.runMode = runMode;

module.exports = _.merge({}, defaults, config);
