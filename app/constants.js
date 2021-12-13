
const LOG_LEVEL_FATAL = 'fatal';
const LOG_LEVEL_FATAL_VALUE = 5;
const LOG_LEVEL_ERROR = 'error';
const LOG_LEVEL_ERROR_VALUE = 4;
const LOG_LEVEL_WARNING = 'warning';
const LOG_LEVEL_WARNING_VALUE = 3;
const LOG_LEVEL_INFO = 'info';
const LOG_LEVEL_INFO_VALUE = 2;
const LOG_LEVEL_DEBUG = 'debug';
const LOG_LEVEL_DEBUG_VALUE = 1;
const LOG_LEVEL_NONE = 'none';
const LOG_LEVEL_NONE_VALUE = 0;

module.exports = {
  NOOP: 'NOOP',
  ERROR: 'ERROR',
  NOTFOUND: 'NOTFOUND',
  NOCONTENT: 'NOCONTENT',
  CONFLICT: 'CONFLICT',
  PLUGIN_TYPE_LOGGING: 'logging',
  PLUGIN_TYPE_SONG_DETAILS: 'songDetails',
  LOG_LEVEL_FATAL,
  LOG_LEVEL_FATAL_VALUE,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_ERROR_VALUE,
  LOG_LEVEL_WARNING,
  LOG_LEVEL_WARNING_VALUE,
  LOG_LEVEL_INFO,
  LOG_LEVEL_INFO_VALUE,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_DEBUG_VALUE,
  LOG_LEVEL_NONE,
  LOG_LEVEL_NONE_VALUE,
  LOG_LEVELS: {
    [LOG_LEVEL_FATAL]: LOG_LEVEL_FATAL_VALUE,
    [LOG_LEVEL_ERROR]: LOG_LEVEL_ERROR_VALUE,
    [LOG_LEVEL_WARNING]: LOG_LEVEL_WARNING_VALUE,
    [LOG_LEVEL_INFO]: LOG_LEVEL_INFO_VALUE,
    [LOG_LEVEL_DEBUG]: LOG_LEVEL_DEBUG_VALUE,
    [LOG_LEVEL_NONE]: LOG_LEVEL_NONE_VALUE,
  },
  DEFAULT_LOG_FILE_NAME: 'playgen.log',
};