const { log } = require('../utils');
const { LOG_LEVEL_ERROR } = require('../constants');
const httpStatus = require('http-status-codes');

const routeNotFoundHandler = (req, res) => {
  log(LOG_LEVEL_ERROR, `${req.url} was not found`);
  res.status(httpStatus.NOT_FOUND).send(`'Sorry can't find ${req.url}!'`);
};

const routeErrorHandler = (error, req, res) => {
  log(LOG_LEVEL_ERROR, `${req.url} had an error`);
  log(LOG_LEVEL_ERROR, error.stack);
  res.status(httpStatus.INTERNAL_SERVER_ERROR).send(`Something broke in ${req.url}!`);
};

module.exports = {
  routeNotFoundHandler,
  routeErrorHandler,
};
