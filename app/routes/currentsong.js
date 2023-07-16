const express = require('express');
const router = express.Router({ mergeParams: true });
const httpStatus = require('http-status-codes');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
const _ = require('lodash');

const {
  GET,
  OK,
  ERROR,
  NOTFOUND,
  NOCONTENT,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
} = require('../constants');
const { getDb, getPlaylist, handleDbError } = require('../db');
const { handleError, log } = require('../utils');

const { routeNotFoundHandler, routeErrorHandler } = require('./utils');

// router.use(logger('combined')); // was 'dev'
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
// router.use(cookieParser());

// get the currently-selected song from
// the playlist with that id (accessed at
router.get('/', (req, res /* , next */) => {
  log(LOG_LEVEL_INFO, `/api/v1/playlists/:playlist_id/currentsong called with GET url = ${req.url}`);
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
        log(LOG_LEVEL_DEBUG, rows[0].name);
        const playlist = getPlaylist(rows[0].name);
        if (playlist) {
          if ((!playlist._songsToPlay) || (!playlist._fileLoaded)) {
            handleError(res, httpStatus.NO_CONTENT, NOCONTENT,
              'Playlist "' + playlistId + '" has no songs loaded');
            return;
          }
          const current = _.cloneDeep(playlist._getCurrentSong());
          current.playlist = playlistId;
          if (current.song === null) {
            handleError(res, httpStatus.NO_CONTENT, NOCONTENT,
              'Playlist "' + playlistId + '" has no current song yet');
            return;
          }
          current.song.uri = `${req.protocol}://${req.get('host')}${req.originalUrl.replace('currentsong', 'songs')}/${current.index}`;
          res.status(httpStatus.OK);
          res.json({ status: OK, result: current });
        }
        else {
          handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
            'Playlist "' + playlistId + '" is in the DB but not the memory list');
        }
      }
    }
  );
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id/currentsong)
router.options('/', (req, res /* , next */) => {
  log(LOG_LEVEL_INFO, `/api/v1/playlists/:playlist_id/currentsong called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', GET);
  res.end();
});

router.use(routeNotFoundHandler);
router.use(routeErrorHandler);

module.exports = router;
