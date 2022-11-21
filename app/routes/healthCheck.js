const express = require('express');
const router = express.Router({ mergeParams: true });
const httpStatus = require('http-status-codes');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');

const { pingDb } = require('../db');
const { log } = require('../utils');
const { GET, LOG_LEVEL_DEBUG, LOG_LEVEL_ERROR } = require('../constants');

// router.use(logger('combined')); // was 'dev'
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
// router.use(cookieParser());

// get all the healthCheck
// (accessed at GET/HEAD http://localhost:<port>/api/v1/healthCheck)
router.get('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/healthCheck called with GET url = ${req.url}`);
  pingDb((healthCheckFlag, reasonText) => {
    if (healthCheckFlag) {
      res.status(httpStatus.OK);
      res.json({ status: 'READY', reason: reasonText });
    } else {
      res.status(httpStatus.SERVICE_UNAVAILABLE);
      res.json({ status: 'OFFLINE', reason: reasonText });
    }
  });
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/healthCheck)
router.options('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/healthCheck called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', GET);
  res.end();
});

router.use((req, res) => {
  res.status(httpStatus.NOT_FOUND).send('Sorry can\'t find that!');
});

router.use((error, req, res) => {
  // can this be modularized?
  log(LOG_LEVEL_ERROR, '/v1/healthCheck had an error');
  log(LOG_LEVEL_ERROR, error.stack);
  res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Something broke!');
});

module.exports = router;
