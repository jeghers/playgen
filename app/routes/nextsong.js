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

const { routeErrorHandler, routeNotFoundHandler } = require('./utils');
// router.use(logger('combined')); // was 'dev'
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
// router.use(cookieParser());

// get the next randomly-selected song from
// the playlist with that id (accessed at
// GET http://localhost:<port>/api/v1/playlists/:playlist_id/nextsong[?format=text])
router.get('/', (req, res /* , next */) => {
  const playlistId = req.params.playlist_id;
  log(LOG_LEVEL_INFO, `/api/v1/playlists/${playlistId}/nextsong called with GET url = ${req.url}`);
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleDbError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR, 'getting', playlistId, err);
        return;
      }

      log(LOG_LEVEL_DEBUG, 'Data received from DB:');
      log(LOG_LEVEL_DEBUG, rows);

      if (rows.length === 0) {
        handleError(res, httpStatus.NOT_FOUND, NOTFOUND, `Playlist "${playlistId}" not found`);
      } else {
        log(LOG_LEVEL_DEBUG, rows[0].name);
        const playlist = getPlaylist(rows[0].name);
        if (playlist) {
          if ((!playlist._songsToPlay) || (!playlist._fileLoaded)) {
            handleError(res, httpStatus.NO_CONTENT, NOCONTENT,
              'Playlist "' + playlistId + '" has no songs loaded');
            return;
          }
          const next = _.cloneDeep(playlist._getNextSong());
          next.playlist = playlistId;
          next.song.uri = `${req.protocol}://${req.get('host')}${req.originalUrl.replace('nextsong', 'songs')}/${next.index}`;
          log(LOG_LEVEL_DEBUG, 'Query string...');
          log(LOG_LEVEL_DEBUG, req.query);
          log(LOG_LEVEL_DEBUG, `Query string for format = ${req.query.format}`);
          res.status(httpStatus.OK);
          if ((req.query.format) && (req.query.format === 'text')) {
            log(LOG_LEVEL_DEBUG, 'Return text instead of JSON');
            res.type('text/plain');
            res.send(next.song.file); // text only
          }
          else { res.json({ status: OK, result: next }); }
          log(LOG_LEVEL_INFO, `next.song.file = ${next.song.file}`);
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
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id/nextsong)
router.options('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id/nextsong called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', GET);
  res.end();
});

router.use(routeNotFoundHandler);
router.use(routeErrorHandler);

module.exports = router;
