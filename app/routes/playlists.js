const express = require('express');
const router = express.Router({ mergeParams: true });
const httpStatus = require('http-status-codes');
// const logger = require('morgan');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');

const { dbInit, getDb, playlists } = require('../db');
const { handleError, watchPromise } = require('../utils');
const Playlist = require('../Playlist');

// router.use(logger('combined')); // was 'dev'
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
// router.use(cookieParser());

// get all the playlists
// (accessed at GET http://localhost:<port>/api/v1/playlists)
router.get('/', (req, res /* , next */) => {
  console.log(`/api/v1/playlists called with GET url = ${req.url}`);
  getDb().query('SELECT * FROM playlists', (err, rows) => {
    if (err) {
      handleError(res, httpStatus.PRECONDITION_REQUIRED, 'ERROR',
        'Error querying playlists - ' + err);
      console.log('Reconnecting to DB...');
      dbInit();
      return;
    }

    //console.log('Data received from DB:');
    //console.log(rows);

    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    for (let i = 0; i < rows.length; i++) {
      const name = rows[i].name;
      const playlist = playlists[name];
      let count = 0;
      if (playlist) {
        count = playlist.count();
        rows[i].songCount = count;
        rows[i].uri = `${fullUrl}/${name}`;
      }
      console.log('Playlist ' + name + ' has ' + count + ' songs');
    }
    console.log('Global playlists:');
    console.log(playlists);
    res.status(httpStatus.OK);
    res.header('X-Count', `${rows.length}`);
    res.json({ status: 'OK', result: rows, count: rows.length });
  });
});

// get playlists metadata
// (accessed at HEAD http://localhost:<port>/api/v1/playlists)
router.head('/', (req, res /* , next */) => {
  console.log(`/api/v1/playlists called with HEAD url = ${req.url}`);
  getDb().query('SELECT * FROM playlists', (err, rows) => {
    if (err) {
      handleError(res, httpStatus.PRECONDITION_REQUIRED, 'ERROR',
        'Error querying playlists - ' + err);
      console.log('Reconnecting to DB...');
      dbInit();
      return;
    }

    //console.log('Data received from DB:');
    //console.log(rows);

    console.log(`Total of ${rows.length} playlists`);
    res.status(httpStatus.OK);
    res.header('X-Count', `${rows.length}`);
    res.end();
  });
});

// create new playlist
// (accessed at POST http://localhost:<port>/api/v1/playlists)
router.post('/', (req, res /* , next */) => {
  console.log(`/api/v1/playlists called with POST url = ${req.url}`);
  console.log('req.body...');
  console.log(req.body);
  const data = {};

  if (!req.body.name) {
    handleError(res, httpStatus.BAD_REQUEST, 'ERROR',
      'Error creating playlist - no name given');
    return;
  }
  const insertParams = { name: req.body.name };
  const name = req.body.name;
  data.name = name;
  if (req.body.filePath) {
    insertParams.filePath = req.body.filePath;
    data.filePath = req.body.filePath;
    console.log('filePath = ' + req.body.filePath);
  }
  else {
    handleError(res, httpStatus.BAD_REQUEST, 'ERROR',
      'Error creating playlist ' + name + ' - no file path given');
    return;
  }
  if (req.body.description) {
    insertParams.description = req.body.description;
    data.description = req.body.description;
    console.log('description = ' + req.body.description);
  }
  if (req.body.redundantTitleThreshold) {
    insertParams.redundantTitleThreshold = req.body.redundantTitleThreshold;
    data.redundantTitleThreshold = req.body.redundantTitleThreshold;
    console.log('redundantTitleThreshold = ' + req.body.redundantTitleThreshold);
  }
  if (req.body.partialTitleDelimiters) {
    insertParams.partialTitleDelimiters = req.body.partialTitleDelimiters;
    data.partialTitleDelimiters = req.body.partialTitleDelimiters;
    console.log('partialTitleDelimiters = ' + req.body.partialTitleDelimiters);
  }
  if (req.body.redundantTitleThreshold) {
    insertParams.redundantArtistThreshold = req.body.redundantArtistThreshold;
    data.redundantArtistThreshold = req.body.redundantArtistThreshold;
    console.log('redundantArtistThreshold = ' + req.body.redundantArtistThreshold);
  }

  getDb().query('INSERT INTO playlists SET ?',
    insertParams, (err /* , result */) => {
      if (err) {
        handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
          'Error creating playlist ' + name + ' - ' + err);
        console.log('Reconnecting to DB...');
        dbInit();
        return;
      }

      console.log('Last insert ID:', res.insertId);
      const playlist = new Playlist(data);
      const promise = playlist.loadFile();
      watchPromise(promise);
      playlists[name] = playlist;
      console.log('Global playlists:');
      console.log(playlists);
      const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
      const uri = `${fullUrl}/${name}`;
      res.status(httpStatus.CREATED);
      res.set('Location', uri);
      res.json({ status: 'OK', uri, message: 'Playlist "' + name + '" created' });
    });
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists)
router.options('/', (req, res /* , next */) => {
  console.log(`/api/v1/playlists called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', 'GET,HEAD,POST');
  res.end();
});

// get playlist by id
// (accessed at GET http://localhost:<port>/api/v1/playlists/:playlist_id)
router.get('/:playlist_id', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id called with GET url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
          'Error fetching playlist "' + playlistId + '" - ' + err);
        console.log('Reconnecting to DB...');
        dbInit();
        return;
      }

      console.log('Data received from DB:');
      console.log(rows);

      if (rows.length === 0) {
        handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
          'Playlist "' + playlistId + '" not found');
      }
      else {
        console.log(rows[0].name);

        const playlist = playlists[rows[0].name];
        if (playlist) {
          console.log('    ' + playlist.count() + ' songs');
          rows[0].songCount = playlist.count();
        }
        else {
          rows[0].songCount = 0;
        }

        res.status(httpStatus.OK);
        res.header('X-Count', `${playlist.count()}`);
        res.json({ status: 'OK', result: rows[0] });
      }
    }
  );
});

// get playlist metadata by id
// (accessed at HEAD http://localhost:<port>/api/v1/playlists/:playlist_id)
router.head('/:playlist_id', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id called with HEAD url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
          'Error fetching playlist "' + playlistId + '" - ' + err);
        console.log('Reconnecting to DB...');
        dbInit();
        return;
      }

      console.log('Data received from DB:');
      console.log(rows);

      if (rows.length === 0) {
        handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
          'Playlist "' + playlistId + '" not found');
      }
      else {
        console.log(rows[0].name);

        const playlist = playlists[rows[0].name];
        if (playlist) {
          console.log('    ' + playlist.count() + ' songs');
          rows[0].songCount = playlist.count();
        }
        else {
          rows[0].songCount = 0;
        }

        res.status(httpStatus.OK);
        res.header('X-Count', `${playlist.count()}`);
        res.end();
      }
    }
  );
});

// update an existing playlist
// (accessed at PUT http://localhost:<port>/api/v1/playlists/:playlist_id)
router.put('/:playlist_id', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id called with PUT url = ${req.url}`);
  console.log('req.body...');
  console.log(req.body);
  const playlistId = req.params.playlist_id;
  const data = playlists[playlistId];
  if (!data) {
    handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
      'Playlist "' + playlistId + '" not found');
    return;
  }
  const dataCopy = new Playlist(data);
  let updateQuery = 'UPDATE playlists SET ';
  const updateParams = [];
  let allValidFields = true;
  let fileChanged = false;
  let someRedundantThresholdChanged = false; // rename this to something more meaningful
  if (req.body.filePath) {
    updateQuery += 'filePath = ?';
    updateParams.push(req.body.filePath);
    dataCopy.filePath = req.body.filePath;
    console.log('filePath = ' + req.body.filePath);
    if (data.filePath !== req.body.filePath) {
      fileChanged = true;
    }
  }
  else {
    allValidFields = false;
  }
  if (req.body.description) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'description = ?';
    updateParams.push(req.body.description);
    dataCopy.description = req.body.description;
    console.log('description = ' + req.body.description);
  }
  else {
    allValidFields = false;
  }
  if (!req.body.hasOwnProperty('redundantTitleThreshold')) {
    req.body.redundantTitleThreshold = null;
  }
  if (updateParams.length > 0) { updateQuery += ', '; }
  updateQuery += 'redundantTitleThreshold = ?';
  updateParams.push(req.body.redundantTitleThreshold);
  dataCopy.redundantTitleThreshold = req.body.redundantTitleThreshold;
  console.log('redundantTitleThreshold = ' + req.body.redundantTitleThreshold);
  if (data.redundantTitleThreshold !== req.body.redundantTitleThreshold) {
    someRedundantThresholdChanged = true;
  }
  if (req.body.partialTitleDelimiters) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'partialTitleDelimiters = ?';
    updateParams.push(req.body.partialTitleDelimiters);
    dataCopy.partialTitleDelimiters = req.body.partialTitleDelimiters;
    console.log('partialTitleDelimiters = ' + req.body.partialTitleDelimiters);
    someRedundantThresholdChanged = true;
  }
  else {
    allValidFields = false;
  }
  if (!req.body.hasOwnProperty('redundantArtistThreshold')) {
    req.body.redundantArtistThreshold = null;
  }
  if (updateParams.length > 0) { updateQuery += ', '; }
  updateQuery += 'redundantArtistThreshold = ?';
  updateParams.push(req.body.redundantArtistThreshold);
  dataCopy.redundantArtistThreshold = req.body.redundantArtistThreshold;
  console.log('redundantArtistThreshold = ' + req.body.redundantArtistThreshold);
  if (data.redundantArtistThreshold !== req.body.redundantArtistThreshold) {
    someRedundantThresholdChanged = true;
  }

  if (!allValidFields) {
    handleError(res, httpStatus.BAD_REQUEST, 'ERROR',
      'Error updating playlist "' + playlistId + '" - not enough valid fields given');
    return;
  }

  updateQuery += ' WHERE name = ?';
  updateParams.push(playlistId);
  console.log('playlistId = ' + playlistId);

  getDb().query(
    updateQuery, updateParams,
    (err, result) => {
      if (err) {
        handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
          'Error updating playlist "' + playlistId + '" - ' + err);
        console.log('Reconnecting to DB...');
        dbInit();
        return;
      }

      console.log('Changed ' + result.changedRows + ' rows');
      playlists[playlistId] = dataCopy;
      if (someRedundantThresholdChanged) {
        dataCopy._clearSongHistory();
      }
      if (fileChanged) {
        const promise = dataCopy.loadFile();
        watchPromise(promise);
      }
      console.log('Global playlists:');
      console.log(playlists);
      res.status(httpStatus.OK);
      res.json({ status: 'OK', message: 'Playlist "' + playlistId + '" updated' });
    }
  );
});

// partially update an existing playlist
// (accessed at PATCH http://localhost:<port>/api/v1/playlists/:playlist_id)
router.patch('/:playlist_id', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id called with PATCH url = ${req.url}`);
  console.log('req.body...');
  console.log(req.body);
  const playlistId = req.params.playlist_id;
  const data = playlists[playlistId];
  if (!data) {
    handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
      'Playlist "' + playlistId + '" not found');
    return;
  }
  const dataCopy = new Playlist(data);
  let updateQuery = 'UPDATE playlists SET ';
  const updateParams = [];
  let someValidFields = false;
  let fileChanged = false;
  let someRedundantThresholdChanged = false;
  if (req.body.filePath) {
    updateQuery += 'filePath = ?';
    updateParams.push(req.body.filePath);
    dataCopy.filePath = req.body.filePath;
    console.log('filePath = ' + req.body.filePath);
    if (data.filePath !== req.body.filePath) {
      fileChanged = true;
    }
    someValidFields = true;
  }
  if (req.body.description) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'description = ?';
    updateParams.push(req.body.description);
    dataCopy.description = req.body.description;
    console.log('description = ' + req.body.description);
    someValidFields = true;
  }
  if (req.body.redundantTitleThreshold) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'redundantTitleThreshold = ?';
    updateParams.push(req.body.redundantTitleThreshold);
    dataCopy.redundantTitleThreshold = req.body.redundantTitleThreshold;
    console.log('redundantTitleThreshold = ' + req.body.redundantTitleThreshold);
    someValidFields = true;
    someRedundantThresholdChanged = true;
  }
  if (req.body.partialTitleDelimiters) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'partialTitleDelimiters = ?';
    updateParams.push(req.body.partialTitleDelimiters);
    dataCopy.partialTitleDelimiters = req.body.partialTitleDelimiters;
    console.log('partialTitleDelimiters = ' + req.body.partialTitleDelimiters);
    someValidFields = true;
    someRedundantThresholdChanged = true;
  }
  if (req.body.redundantArtistThreshold) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'redundantArtistThreshold = ?';
    updateParams.push(req.body.redundantArtistThreshold);
    dataCopy.redundantArtistThreshold = req.body.redundantArtistThreshold;
    console.log('redundantArtistThreshold = ' + req.body.redundantArtistThreshold);
    someValidFields = true;
    someRedundantThresholdChanged = true;
  }

  if (!someValidFields) {
    handleError(res, httpStatus.BAD_REQUEST, 'ERROR',
      'Error updating playlist "' + playlistId + '" - no valid fields given');
    return;
  }

  updateQuery += ' WHERE name = ?';
  updateParams.push(playlistId);
  console.log('playlistId = ' + playlistId);

  getDb().query(
    updateQuery, updateParams,
    (err, result) => {
      if (err) {
        handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
          'Error updating playlist "' + playlistId + '" - ' + err);
        console.log('Reconnecting to DB...');
        dbInit();
        return;
      }

      console.log('Changed ' + result.changedRows + ' rows');
      playlists[playlistId] = dataCopy;
      if (someRedundantThresholdChanged) {
        dataCopy._clearSongHistory();
      }
      if (fileChanged) {
        const promise = dataCopy.loadFile();
        watchPromise(promise);
      }
      console.log('Global playlists:');
      console.log(playlists);
      res.status(httpStatus.OK);
      res.json({ status: 'OK', message: 'Playlist "' + playlistId + '" updated' });
    }
  );
});

// delete an existing playlist
// (accessed at DELETE http://localhost:<port>/api/v1/playlists/:playlist_id)
router.delete('/:playlist_id', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id called with DELETE url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query(
    'DELETE FROM playlists WHERE name = ?',
    [ playlistId ], (err, result) => {
      if (err) {
        handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
          'Error deleting playlist "' + playlistId + '" - ' + err);
        console.log('Reconnecting to DB...');
        dbInit();
        return;
      }

      if (result.affectedRows === 0) {
        res.status(httpStatus.NOT_FOUND);
        res.json({ status: 'NOTFOUND', message: 'Playlist "' + playlistId + '" not found' });
        return;
      }
      console.log('Deleted ' + result.affectedRows + ' rows');
      delete playlists[playlistId];
      console.log('Global playlists:');
      console.log(playlists);
      res.status(httpStatus.OK);
      res.json({ status: 'OK', message: 'Playlist "' + playlistId + '" deleted' });
    }
  );
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id)
router.options('/:playlist_id', (req, res /* , next */) => {
  console.log(`/api/v1/playlists/:playlist_id called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', 'GET,HEAD,PUT,PATCH,DELETE');
  res.end();
});

router.use((req, res) => {
  res.status(httpStatus.NOT_FOUND).send('Sorry can\'t find that!');
});

router.use((error, req, res) => {
  // can this be modularized?
  console.log('/v1/playlists had an error');
  console.error(error.stack);
  res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Something broke!');
});

module.exports = router;
