const express = require('express');
const router = express.Router({ mergeParams: true });
const httpStatus = require('http-status-codes');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');

const { LOG_LEVEL_DEBUG } = require('../constants');
const config = require('../config');
const { getVaultStatus } = require('../vault');
const { serverVersion, apiVersion } = require('../version');
const { log } = require('../utils');

const { routeErrorHandler, routeNotFoundHandler } = require('./utils');

// router.use(logger('combined')); // was 'dev'
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
// router.use(cookieParser());

// get all the management
// (accessed at GET/HEAD http://localhost:<port>/api/v1/management/config)
router.get('/config', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/management called with GET url = ${req.url}`);
  getVaultStatus().then(vaultInfo => {
    res.json({
      serverVersion,
      apiVersion,
      config,
      vaultInfo,
    });
  });
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/management/config)
router.options('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/management/config called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', 'GET,HEAD');
  res.end();
});

router.use(routeNotFoundHandler);
router.use(routeErrorHandler);

module.exports = router;
