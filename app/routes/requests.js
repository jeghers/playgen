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

// create new request in a given playlist
// (accessed at POST http://localhost:<port>/api/v1/playlists/:playlist_id/requests)
router.post('/', (req, res /* , next */) => {
  console.log(`/api/v1/playlists called with POST url = ${req.url}`);
  console.log('req.body...');
  console.log(req.body);

  if (!req.body.hasOwnProperty('songIndex')) {
    handleError(res, httpStatus.BAD_REQUEST, 'ERROR',
      'Error adding song request - no song index given');
    return;
  }

  const playlistId = req.params.playlist_id;
  const { songIndex } = req.body;
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
          const playlistCount = playlist.count();
          if (songIndex >= playlistCount) {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' only has ' + playlistCount + ' songs');
            return;
          }
          const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
          const existingRequestIndex = playlist._hasPriorityRequest(songIndex);
          if (existingRequestIndex > -1) {
            const uri = `${fullUrl}/${existingRequestIndex}`;
            res.set('Location', uri);
            handleError(res, httpStatus.CONFLICT, 'CONFLICT',
              'Playlist ' + playlistId + ' already has a request for song ' + songIndex);
            return;
          }
          const count = playlist._addPriorityRequest(songIndex);
          const song = playlist._getSong(songIndex);
          const songUri = `${fullUrl}/${songIndex}`.replace('requests', 'songs');
          const uri = `${fullUrl}/${count - 1}`;
          res.set('Location', uri);
          res.status(httpStatus.CREATED);
          res.json({ status: 'OK', count, song, uri: songUri });
        }
        else {
          handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
            'Playlist ' + playlistId + ' is in the DB but not the memory list');
        }
      }
    }
  );
});

// get all the songs in a given playlist
// (accessed at GET http://localhost:<port>/api/v1/playlists/:playlist_id/requests)
router.get('/', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id/requests called with GET url = ${req.url}`);
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
          if ((!playlist._priorityRequests) || (!playlist._fileLoaded)) {
            res.json({
              status: 'OK',
              result: { playlist: playlistId, requests: [], count: 0 }
            });
            return;
          }
          const requestList = playlist._priorityRequests;
          const count = requestList.length;
          const returnList = [];
          const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
          for (let i = 0; i < count; i++) {
            const requestInfo = requestList[i];
            const o = _.cloneDeep(playlist._songsToPlay[requestInfo.songIndex]);
            const uri = `${fullUrl}/${requestInfo.songIndex}`.replace('requests', 'songs');
            returnList.push({
              songIndex: requestInfo.songIndex,
              song: o,
              timestamp: requestInfo.timestamp,
              uri,
            });
          }
          console.log('    ' + count + ' requests');
          res.status(httpStatus.OK);
          res.header('X-Count', `${playlist._priorityRequests.length}`);
          res.json({
            status: 'OK',
            result: { playlist: playlistId, requests: returnList, count }
          });
        }
        else {
          handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
            'Playlist ' + playlistId + ' is in the DB but not the memory list');
        }
      }
    }
  );
});

// get song metadata for a given playlist
// (accessed at HEAD http://localhost:<port>/api/v1/playlists/:playlist_id/requests)
router.head('/', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id/requests called with HEAD url = ${req.url}`);
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
          if ((!playlist._priorityRequests) || (!playlist._fileLoaded)) {
            res.json({
              status: 'OK',
              result: { playlist: playlistId, requests: [], count: 0 }
            });
            return;
          }
          const count = playlist._priorityRequests.length;
          console.log('    ' + count + ' requests');
          res.status(httpStatus.OK);
          res.header('X-Count', `${count}`);
          res.end();
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
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id/requests)
router.options('/', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id/requests called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', 'POST,GET,HEAD');
  res.end();
});

// get song request by index for a given playlist
// (accessed at GET http://localhost:<port>/api/v1/playlists/:playlist_id/requests/:request_index)
router.get('/:request_index', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id/requests/:request_index called with GET url = ${req.url}`);
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
          if ((!playlist._priorityRequests)) {
            handleError(res, httpStatus.NO_CONTENT, 'NOCONTENT',
              'Playlist ' + playlistId + ' has no requests loaded');
            return;
          }
          const requestList = playlist._priorityRequests;
          const count = requestList.length;
          console.log('    ' + count + ' requests');
          const requestIndex = req.params.request_index;
          if (requestIndex >= count) {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' only has ' + count + ' requests');
            return;
          }
          const requestInfo = requestList[requestIndex];
          const { songIndex } = requestInfo;
          const song = _.cloneDeep(playlist._songsToPlay[songIndex]);
          const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
          const uri = `${fullUrl}/${songIndex}`.replace(`requests/${requestIndex}`, 'songs');
          console.log('    song... ');
          console.log(song);
          res.json({
            status: 'OK',
            result: {
              song,
              playlist: playlistId,
              songIndex: songIndex,
              timestamp: requestInfo.timestamp,
              uri,
            },
          });
        }
        else {
          handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
            'Playlist ' + playlistId + ' is in the DB but not the memory list');
        }
      }
    }
  );
});

// delete song request by index for a given playlist
// (accessed at DELETE http://localhost:<port>/api/v1/playlists/:playlist_id/requests/:request_index)
router.delete('/:request_index', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id/requests/:request_index called with DELETE url = ${req.url}`);
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
          if ((!playlist._priorityRequests)) {
            handleError(res, httpStatus.NO_CONTENT, 'NOCONTENT',
              'Playlist ' + playlistId + ' has no requests loaded');
            return;
          }
          const requestList = playlist._priorityRequests;
          const count = requestList.length;
          console.log('    ' + count + ' requests');
          const requestIndex = req.params.request_index;
          if (requestIndex >= count) {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' only has ' + count + ' requests');
            return;
          }
          requestList.splice(requestIndex, 1);
          console.log('Deleted request ' + requestIndex);
          res.status(httpStatus.OK);
          res.json({
            status: 'OK',
            message: 'Playlist ' + playlistId + ' song request ' + requestIndex + ' deleted'
          });
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
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id/requests/:request_index)
router.options('/:playlist_id', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id/requests/:request_index called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', 'GET,DELETE');
  res.end();
});

router.use((req, res) => {
  res.status(httpStatus.NOT_FOUND).send('Sorry can\'t find that!');
});

router.use((error, req, res) => {
  // can this be modularized?
  console.log('/v1/playlists/:playlist_id/requests had an error');
  console.error(error.stack);
  res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Something broke!');
});

module.exports = router;
