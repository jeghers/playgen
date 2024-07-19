const express = require('express');
const router = express.Router({ mergeParams: true });
const httpStatus = require('http-status-codes');
const fs = require('fs');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
const _ = require('lodash');

const config = require('../config');

const {
  OK,
  ERROR_NOENT,
  ERROR_EPERM,
  ERROR_EXIST,
  ERROR,
  NOTFOUND,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_ERROR,
  UNAVAILABLE,
} = require('../constants');
const { getDb, getPlaylist, handleDbError } = require('../db');
const {
  relativeToAbsolutePath,
  makeSymLink,
  symLinkPath,
  getAllSymLinks,
} = require('../downloads');
const { handleError, log } = require('../utils');

const { routeNotFoundHandler, routeErrorHandler } = require('./utils');

const downloadsEnabled = config.downloads.enabled && !_.isUndefined(config.downloads.downloadsPath);

// router.use(logger('combined')); // was 'dev'
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
// router.use(cookieParser());

// create new download in a given playlist
// (accessed at POST http://localhost:<port>/api/v1/playlists/:playlist_id/downloads)
router.post('/', (req, res /* , next */) => {
  console.warn('**** POST /api/v1/playlists/:playlist_id/downloads - ROUTE AAA');
  log(LOG_LEVEL_INFO, `/api/v1/playlists called with POST url = ${req.url}`);
  if (!downloadsEnabled) {
    handleError(res, httpStatus.SERVICE_UNAVAILABLE, UNAVAILABLE,
      'Download services are not enabled');
    return;
  }

  log(LOG_LEVEL_DEBUG, 'req.body...');
  log(LOG_LEVEL_DEBUG, req.body);

  if (!req.body.hasOwnProperty('songIndex')) {
    handleError(res, httpStatus.BAD_REQUEST, ERROR,
      'Error adding song download - no song index given');
    return;
  }

  const playlistId = req.params.playlist_id;
  const { songIndex } = req.body;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleDbError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR, 'getting', playlistId, err);
        return;
      }
      log(LOG_LEVEL_DEBUG, 'Data received from DB:');
      log(LOG_LEVEL_DEBUG, rows);
      if (rows.length === 0) {
        handleError(res, httpStatus.NOT_FOUND, NOTFOUND, 'Playlist "' + playlistId + '" not found');
      } else {
        log(LOG_LEVEL_DEBUG, rows[0].name);
        const playlist = getPlaylist(rows[0].name);
        if (playlist) {
          const songToDownload = playlist._songsToPlay[songIndex];
          if (_.isUndefined(songToDownload)) {
            res.status(httpStatus.NOT_FOUND);
            res.json({ status: NOTFOUND });
            res.end();
            return;
          }
          const songPath = songToDownload.file;
          const linkPath =
            `${config.downloads.downloadsPath}/song-${playlist.name}-${songIndex}-${songToDownload.title.replace(/ /g, '_')}.mp3`;
          const returnCode = makeSymLink(songPath, linkPath);
          const linkTargetPath = symLinkPath(linkPath);
          log(LOG_LEVEL_DEBUG, `linkTargetPath = ${linkTargetPath}`);
          const isOk = returnCode === OK;
          let httpStatusCode = httpStatus.CREATED;
          if (returnCode === ERROR_NOENT) {
            httpStatusCode = httpStatus.NO_CONTENT;
          } else if (returnCode === ERROR_EPERM) {
            httpStatusCode = httpStatus.FORBIDDEN;
          } else if (returnCode === ERROR_EXIST) {
            httpStatusCode = httpStatus.CONFLICT;
          }
          res.status(httpStatusCode);
          if (isOk) {
            const absLinkPath = relativeToAbsolutePath(linkPath);
            res.json({
              status: returnCode,
              result: {
                playlist: playlistId,
                songToDownload,
                symLinkPath: absLinkPath,
              },
            });
            res.end();
          } else {
            res.end();
          }
        } else {
          handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
            'Playlist "' + playlistId + '" is in the DB but not the memory list');
        }
      }
    }
  );
});

// get all the song downloads in a given playlist
// (accessed at GET/HEAD http://localhost:<port>/api/v1/playlists/:playlist_id/downloads)
router.get('/', (req, res /* , next */) => {
  log(LOG_LEVEL_INFO, `/api/v1/playlists/:playlist_id/downloads called with ${req.method} url = ${req.url}`);
  if (!downloadsEnabled) {
    handleError(res, httpStatus.SERVICE_UNAVAILABLE, UNAVAILABLE,
      'Download services are not enabled');
    return;
  }
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleDbError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR, 'getting', playlistId, err);
        return;
      }
      log(LOG_LEVEL_DEBUG, 'Data received from DB:');
      log(LOG_LEVEL_DEBUG, rows);
      if (rows.length === 0) {
        handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
          'Playlist "' + playlistId + '" not found');
      } else {
        const downloadLinksByPlaylist = getAllSymLinks(config.downloads.downloadsPath, playlistId);
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
      }
    }
  );
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
  res.header('Allow', 'POST,GET,HEAD');
  res.end();
});

// get song download by index for a given playlist
// (accessed at GET/HEAD http://localhost:<port>/api/v1/playlists/:playlist_id/downloads/:download_index)
router.get('/:download_index', (req, res /* , next */) => {
  log(LOG_LEVEL_INFO, `/api/v1/playlists/:playlist_id/downloads/:download_index called with GET url = ${req.url}`);
  if (!downloadsEnabled) {
    handleError(res, httpStatus.SERVICE_UNAVAILABLE, UNAVAILABLE,
      'Download services are not enabled');
    return;
  }
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleDbError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR, 'getting', playlistId, err);
        return;
      }

      log(LOG_LEVEL_DEBUG, 'Data received from DB:');
      log(LOG_LEVEL_DEBUG, rows);

      if (rows.length === 0) {
        handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
          'Playlist "' + playlistId + '" not found');
      } else {
        const playlist = getPlaylist(rows[0].name);
        const downloadIndex = parseInt(req.params.download_index, 10);
        const downloadLinksByPlaylist = getAllSymLinks(config.downloads.downloadsPath, playlistId);
        const { downloadLinks } = downloadLinksByPlaylist[0];
        if (downloadIndex > downloadLinks.length) {
          handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
            'Playlist "' + playlistId + '" only has ' + downloadLinks.length + ' download links');
        }
        const downloadLink = downloadLinks[downloadIndex];
        const song = _.cloneDeep(playlist._songsToPlay[downloadLink.songIndex]);
        res.json({
          status: OK,
          result: {
            playlist: playlistId,
            downloadIndex,
            linkPath: downloadLink.linkPath,
            song,
          }
        });
      }
    }
  );
});

// delete song downloads by index for a given playlist
// (accessed at DELETE http://localhost:<port>/api/v1/playlists/:playlist_id/downloads/:download_index)
router.delete('/:download_index', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id/downloads/:download_index called with DELETE url = ${req.url}`);
  if (!downloadsEnabled) {
    handleError(res, httpStatus.SERVICE_UNAVAILABLE, UNAVAILABLE,
      'Download services are not enabled');
    return;
  }
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleDbError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR, 'getting', playlistId, err);
        return;
      }

      log(LOG_LEVEL_DEBUG, 'Data received from DB:');
      log(LOG_LEVEL_DEBUG, rows);

      if (rows.length === 0) {
        handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
          'Playlist "' + playlistId + '" not found');
      } else {
        const downloadIndex = parseInt(req.params.download_index, 10);
        const downloadLinksByPlaylist = getAllSymLinks(config.downloads.downloadsPath, playlistId);
        const downloadLinkToDelete = downloadLinksByPlaylist[0].downloadLinks[downloadIndex].linkPath;
        if (!fs.existsSync(downloadLinkToDelete)) {
          log(LOG_LEVEL_ERROR, `Download link ${downloadLinkToDelete} does not exist`);
          res.status(httpStatus.NOT_FOUND);
          res.json({ status: NOTFOUND, message: 'Download link "' + downloadLinkToDelete + '" not found' });
          return;
        }
        fs.unlinkSync(downloadLinkToDelete);
        res.status(httpStatus.OK);
        res.json({ status: OK, message: 'Download link "' + downloadLinkToDelete + '" deleted' });
      }
    }
  );
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id/downloads/:download_index)
router.options('/:download_index', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id/downloads/:download_index called with OPTIONS url = ${req.url}`);
  if (!downloadsEnabled) {
    handleError(res, httpStatus.SERVICE_UNAVAILABLE, UNAVAILABLE,
      'Download services are not enabled');
    return;
  }
  res.status(httpStatus.OK);
  res.header('Allow', 'GET,HEAD,DELETE');
  res.end();
});

router.use(routeNotFoundHandler);
router.use(routeErrorHandler);

module.exports = router;
