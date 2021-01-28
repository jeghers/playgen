const express = require('express');
const router = express.Router({ mergeParams: true });
const httpStatus = require('http-status-codes');
// const logger = require('morgan');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
const _ = require('lodash');

const { dbInit, getDb, playlists } = require('../db');
const { handleError } = require('../utils');

// router.use(logger('combined')); // was 'dev'
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
// router.use(cookieParser());

// get the currently-selected song from
// the playlist with that id (accessed at
// GET http://localhost:<port>/api/playlists/:playlist_id/currentsong[?format=text])
router.get('/', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id/currentsong called with GET url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
          'Error getting playlist ' + playlistId + ' - ' + err);
        console.log('Reconnecting to DB...');
        dbInit();
        return;
      }

      console.log('Data received from DB:');
      console.log(rows);

      if (rows.length === 0) {
        handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
          'Playlist ' + playlistId + ' not found');
      }
      else {
        console.log(rows[0].name);

        const playlist = playlists[rows[0].name];
        if (playlist) {
          if ((!playlist._songsToPlay) || (!playlist._fileLoaded)) {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' has no songs loaded');
            return;
          }
          const current = _.cloneDeep(playlist._getCurrentSong());
          current.playlist = playlistId;
          if (current.song === null) {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' has no current song yet');
            return;
          }
          current.song.uri = `${req.protocol}://${req.get('host')}${req.originalUrl.replace('currentsong', 'songs')}/${current.index}`;
          res.status(httpStatus.OK);
          res.json({ status: 'OK', result: current });
        }
        else {
          handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
            'Playlist ' + playlistId + ' is in the DB but not the memory list');
        }
      }
    }
  );
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id/currentsong)
router.options('/', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id/currentsong called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', 'GET');
  res.end();
});

router.use((req, res) => {
  res.status(httpStatus.NOT_FOUND).send('Sorry can\'t find that!');
});

router.use((error, req, res) => {
  // can this be modularized?
  console.log('/v1/playlists/:playlist_id/songs had an error');
  console.error(error.stack);
  res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Something broke!');
});

module.exports = router;