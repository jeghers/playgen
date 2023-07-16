const express = require('express');
const router = express.Router({ mergeParams: true });
const httpStatus = require('http-status-codes');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
const _ = require('lodash');

const config = require('../config');

const {
  OK,
  UNAVAILABLE,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
} = require('../constants');
const { getAllSymLinks } = require('../downloads');
const { log, handleError } = require('../utils');

const { routeNotFoundHandler, routeErrorHandler } = require('./utils');

const downloadsEnabled = config.downloads.enabled && !_.isUndefined(config.downloads.downloadsPath);

// router.use(logger('combined')); // was 'dev'
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
// router.use(cookieParser());

// get all the song requests in a given playlist
// (accessed at GET/HEAD http://localhost:<port>/api/v1/downloads)
router.get('/', (req, res /* , next */) => {
  log(LOG_LEVEL_INFO, `/api/v1/downloads called with ${req.method} url = ${req.url}`);
  if (!downloadsEnabled) {
    handleError(res, httpStatus.SERVICE_UNAVAILABLE, UNAVAILABLE,
      'Download services are not enabled');
    return;
  }
  const downloadLinksByPlaylist = getAllSymLinks(config.downloads.downloadsPath);
  const playlistCount = downloadLinksByPlaylist.length;
  let downloadLinksTotalCount = 0;
  _.forEach(downloadLinksByPlaylist, playlist => {
    downloadLinksTotalCount += playlist.downloadsCount;
  });
  res.status(httpStatus.OK);
  res.header('X-Playlist-Count', `${playlistCount}`);
  res.header('X-DownloadLinks-Total-Count', `${downloadLinksTotalCount}`);
  res.json({
    status: OK,
    result: {
      playlists: downloadLinksByPlaylist,
      playlistCount,
      downloadLinksTotalCount,
    },
  });
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id/downloads)
router.options('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id/downloads called with OPTIONS url = ${req.url}`);
  if (!downloadsEnabled) {
    handleError(res, httpStatus.SERVICE_UNAVAILABLE, UNAVAILABLE,
      'Download services are not enabled');
    return;
  }
  res.status(httpStatus.OK);
  res.header('Allow', 'GET,HEAD');
  res.end();
});

router.use(routeNotFoundHandler);
router.use(routeErrorHandler);

module.exports = router;
