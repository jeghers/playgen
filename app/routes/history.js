const express = require('express');
const router = express.Router({ mergeParams: true });
const httpStatus = require('http-status-codes');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
const _ = require('lodash');

const {
  GET,
  OK,
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

// get the song history from a given playlist
// (accessed at GET/HEAD http://localhost:<port>/api/v1/playlists/:playlist_id/history[?start=nn&length=nn])
router.get('/', (req, res /* , next */) => {
  log(LOG_LEVEL_INFO, `/api/v1/playlists/:playlist_id/history called with ${req.method} url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleDbError(res, httpStatus.NOT_FOUND, NOTFOUND, 'getting', playlistId, err);
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
          let history = _.cloneDeep(playlist._getSongHistory());
          history.forEach((item, historyIndex) => {
            item.historyIndex = historyIndex;
          });
          log(LOG_LEVEL_DEBUG, 'Query string...');
          log(LOG_LEVEL_DEBUG, req.query);
          const { start, length } = req.query;
          log(LOG_LEVEL_DEBUG, `Query string for start = ${start}`);
          log(LOG_LEVEL_DEBUG, `Query string for length = ${length}`);
          if (start) {
            history = history.slice(start);
          }
          if (length) {
            history = history.slice(0, length);
          }
          if (req.method === GET) {
            const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
            for (let i = 0; i < history.length; i++) {
              const o = history[i];
              if (!_.isUndefined(o.song.file)) {
                o.song.uri = `${req.protocol}://${req.get('host')}${req.originalUrl.replace('history', 'songs')}/${o.index}`;
              }
              o.uri = `${fullUrl}/${i}`;
            }
          }
          const count = history.length;
          res.status(httpStatus.OK);
          if (start) {
            res.header('X-Start', `${start}`);
          }
          res.header('X-Count', `${count}`);
          res.header('X-Total-Count', `${playlist._getSongHistory().length}`);
          res.json({ status: OK, result: { playlist: playlistId, history, count } });
        } else {
          handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
            'Playlist "' + playlistId + '" is in the DB but not the memory list');
        }
      }
    }
  );
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id/history)
router.options('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id/history called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', 'GET,HEAD');
  res.end();
});

// get song by index for a given playlist
// (accessed at GET/HEAD http://localhost:<port>/api/v1/playlists/:playlist_id/history/:song_index)
router.get('/:song_index', (req, res /* , next */) => {
  log(LOG_LEVEL_INFO, `/api/v1/playlists/:playlist_id/history/:song_index called with GET url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleDbError(res, httpStatus.NOT_FOUND, NOTFOUND, 'getting', playlistId, err);
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
          const history = playlist._getSongHistory();
          if (history === null) {
            handleError(res, httpStatus.NO_CONTENT, NOCONTENT,
              'Playlist "' + playlistId + '" has no song history yet');
            return;
          }
          if (req.params.song_index >= history.length) {
            handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
              'Playlist "' + playlistId + '" only has ' + history.length + ' songs');
            return;
          }

          const historyItem = _.cloneDeep(history[req.params.song_index]);
          historyItem.playlist = playlistId;
          historyItem.song.uri =
            `${req.protocol}://${req.get('host')}${req.originalUrl.replace(/history.*$/, 'songs')}/${historyItem.index}`;
          res.status(httpStatus.OK);
          res.json({ status: OK, result: historyItem });
        } else {
          handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
            'Playlist "' + playlistId + '" is in the DB but not the memory list');
        }
      }
    }
  );
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id/history/:song_index)
router.options('/:playlist_id', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id/history/:song_index called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', GET);
  res.end();
});

router.use(routeNotFoundHandler);
router.use(routeErrorHandler);

module.exports = router;
