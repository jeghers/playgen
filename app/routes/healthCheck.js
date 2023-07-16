const express = require('express');
const router = express.Router({ mergeParams: true });
const httpStatus = require('http-status-codes');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');

const { GET, READY, OFFLINE, LOG_LEVEL_DEBUG } = require('../constants');
const { pingDb } = require('../db');
const { log } = require('../utils');

const { routeErrorHandler, routeNotFoundHandler } = require('./utils');

// router.use(logger('combined')); // was 'dev'
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
// router.use(cookieParser());

// get all the healthcheck
// (accessed at GET/HEAD http://localhost:<port>/api/v1/healthcheck)
router.get('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/healthcheck called with GET url = ${req.url}`);
  pingDb((healthCheckFlag, reasonText) => {
    if (healthCheckFlag) {
      res.status(httpStatus.OK);
      res.json({ status: READY, reason: reasonText });
    } else {
      res.status(httpStatus.SERVICE_UNAVAILABLE);
      res.json({ status: OFFLINE, reason: reasonText });
    }
  });
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/healthcheck)
router.options('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/healthcheck called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', GET);
  res.end();
});

router.use(routeNotFoundHandler);
router.use(routeErrorHandler);

module.exports = router;
