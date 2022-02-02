const express = require('express');
const router = express.Router({ mergeParams: true });
const httpStatus = require('http-status-codes');
const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
const _ = require('lodash');

const { initialDataLoad, getDb, getPlaylists, getPlaylist, setPlaylist, handleDbError } = require('../db');
const { handleError, watchLoadFilePromise, log } = require('../utils');
const { Playlist } = require('../Playlist');
const {
  ERROR,
  NOTFOUND,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_WARNING,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_NONE,
} = require('../constants');

// router.use(logger('combined')); // was 'dev'
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
// router.use(cookieParser());

// get all the playlists
// (accessed at GET http://localhost:<port>/api/v1/playlists[?refresh=true])
router.get('/', (req, res /* , next */) => {
  log(LOG_LEVEL_INFO, `/api/v1/playlists called with GET url = ${req.url}`);
  const { refresh } = req.query;
  if (!_.isUndefined(refresh) && (refresh === '' || refresh === 'true')) {
    log(LOG_LEVEL_WARNING, 'Refresh all playlists!');
    initialDataLoad();
  }
  getDb().query('SELECT * FROM playlists', (err, rows) => {
    if (err) {
      handleDbError(res, httpStatus.PRECONDITION_REQUIRED, ERROR, 'querying', null, err);
      return;
    }

    log(LOG_LEVEL_NONE, 'Data received from DB:');
    log(LOG_LEVEL_NONE, rows);

    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    for (let i = 0; i < rows.length; i++) {
      const name = rows[i].name;
      const playlist = getPlaylist(name);
      let count = 0;
      if (playlist) {
        count = playlist.count();
        rows[i].songCount = count;
        rows[i].uri = `${fullUrl}/${name}`;
      }
      log(LOG_LEVEL_DEBUG, `Playlist ${name} has ${count} songs`);
    }
    log(LOG_LEVEL_DEBUG, 'Global playlists:');
    log(LOG_LEVEL_DEBUG, getPlaylists());
    res.status(httpStatus.OK);
    res.header('X-Count', `${rows.length}`);
    res.json({ status: 'OK', result: rows, count: rows.length });
  });
});

// get playlists metadata
// (accessed at HEAD http://localhost:<port>/api/v1/playlists)
router.head('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists called with HEAD url = ${req.url}`);
  getDb().query('SELECT * FROM playlists', (err, rows) => {
    if (err) {
      handleDbError(res, httpStatus.PRECONDITION_REQUIRED, ERROR, 'querying', null, err);
      return;
    }

    log(LOG_LEVEL_NONE, 'Data received from DB:');
    log(LOG_LEVEL_NONE, rows);

    log(LOG_LEVEL_DEBUG, `Total of ${rows.length} playlists`);
    res.status(httpStatus.OK);
    res.header('X-Count', `${rows.length}`);
    res.end();
  });
});

// create new playlist
// (accessed at POST http://localhost:<port>/api/v1/playlists)
router.post('/', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists called with POST url = ${req.url}`);
  log(LOG_LEVEL_DEBUG, 'req.body...');
  log(LOG_LEVEL_DEBUG, req.body);
  const data = {};

  if (!req.body.name) {
    handleError(res, httpStatus.BAD_REQUEST, ERROR,
      'Error creating playlist - no name given');
    return;
  }
  const insertParams = { name: req.body.name };
  const name = req.body.name;
  data.name = name;
  if (req.body.filePath) {
    insertParams.filePath = req.body.filePath;
    data.filePath = req.body.filePath;
    log(LOG_LEVEL_DEBUG, `filePath = ${req.body.filePath}`);
  } else {
    handleError(res, httpStatus.BAD_REQUEST, ERROR, `Error creating playlist ${name} - no file path given`);
    return;
  }
  if (req.body.description) {
    insertParams.description = req.body.description;
    data.description = req.body.description;
    log(LOG_LEVEL_DEBUG, `description = ${req.body.description}`);
  }
  if (req.body.redundantTitleThreshold) {
    insertParams.redundantTitleThreshold = req.body.redundantTitleThreshold;
    data.redundantTitleThreshold = req.body.redundantTitleThreshold;
    log(LOG_LEVEL_DEBUG, `redundantTitleThreshold = ${req.body.redundantTitleThreshold}`);
  }
  if (req.body.partialTitleDelimiters) {
    insertParams.partialTitleDelimiters = req.body.partialTitleDelimiters;
    data.partialTitleDelimiters = req.body.partialTitleDelimiters;
    log(LOG_LEVEL_DEBUG, `partialTitleDelimiters = ${req.body.partialTitleDelimiters}`);
  }
  if (req.body.redundantTitleThreshold) {
    insertParams.redundantArtistThreshold = req.body.redundantArtistThreshold;
    data.redundantArtistThreshold = req.body.redundantArtistThreshold;
    log(LOG_LEVEL_DEBUG, `redundantArtistThreshold = ${req.body.redundantArtistThreshold}`);
  }
  if (req.body.songDetailsPluginName) {
    insertParams.songDetailsPluginName = req.body.songDetailsPluginName;
    data.songDetailsPluginName = req.body.songDetailsPluginName;
    log(LOG_LEVEL_DEBUG, `songDetailsPluginName = ${req.body.songDetailsPluginName}`);
  }

  getDb().query('INSERT INTO playlists SET ?',
    insertParams, (err /* , result */) => {
      if (err) {
        handleDbError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR, 'creating', name, err);
        return;
      }

      log(LOG_LEVEL_DEBUG, 'Last insert ID:', res.insertId);
      const playlist = new Playlist(data);
      const promise = playlist.loadFile();
      watchLoadFilePromise(promise);
      setPlaylist(name, playlist);
      log(LOG_LEVEL_DEBUG, 'Global playlists:');
      log(LOG_LEVEL_DEBUG, getPlaylists());
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
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', 'GET,HEAD,POST');
  res.end();
});

// get playlist by id
// (accessed at GET http://localhost:<port>/api/v1/playlists/:playlist_id)
router.get('/:playlist_id', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id called with GET url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleDbError(res, httpStatus.INTERNAL_SERVER_ERROR, 'fetching', ERROR, playlistId, err);
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
          log(LOG_LEVEL_DEBUG, `    ${playlist.count()} songs`);
          rows[0].songCount = playlist.count();
        } else {
          rows[0].songCount = 0;
        }

        res.status(httpStatus.OK);
        res.header('X-Count', `${playlist ? playlist.count() : 0}`);
        res.json({ status: 'OK', result: rows[0] });
      }
    }
  );
});

// get playlist metadata by id
// (accessed at HEAD http://localhost:<port>/api/v1/playlists/:playlist_id)
router.head('/:playlist_id', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id called with HEAD url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query('SELECT * FROM playlists Where name = ?',
    [ playlistId ], (err, rows) => {
      if (err) {
        handleDbError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR, 'fetching', playlistId, err);
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
          log(LOG_LEVEL_DEBUG, `    ${playlist.count()} songs`);
          rows[0].songCount = playlist.count();
        } else {
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
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id called with PUT url = ${req.url}`);
  log(LOG_LEVEL_DEBUG, 'req.body...');
  log(LOG_LEVEL_DEBUG, req.body);
  const playlistId = req.params.playlist_id;
  const playlistData = getPlaylist(playlistId);
  if (!playlistData) {
    handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
      'Playlist "' + playlistId + '" not found');
    return;
  }
  const playlistDataCopy = new Playlist(playlistData);
  let updateQuery = 'UPDATE playlists SET ';
  const updateParams = [];
  let allValidFields = true;
  let fileChanged = false;
  if (req.body.filePath) {
    updateQuery += 'filePath = ?';
    updateParams.push(req.body.filePath);
    playlistDataCopy.filePath = req.body.filePath;
    log(LOG_LEVEL_DEBUG, `filePath = ${req.body.filePath}`);
    if (playlistData.filePath !== req.body.filePath) {
      fileChanged = true;
    }
  } else {
    allValidFields = false;
  }
  if (req.body.description) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'description = ?';
    updateParams.push(req.body.description);
    playlistDataCopy.description = req.body.description;
    log(LOG_LEVEL_DEBUG, `description = ${req.body.description}`);
  } else {
    allValidFields = false;
  }
  if (!req.body.hasOwnProperty('redundantTitleThreshold')) {
    req.body.redundantTitleThreshold = null;
  }
  if (updateParams.length > 0) { updateQuery += ', '; }
  updateQuery += 'redundantTitleThreshold = ?';
  updateParams.push(req.body.redundantTitleThreshold);
  playlistDataCopy.redundantTitleThreshold = req.body.redundantTitleThreshold;
  log(LOG_LEVEL_DEBUG, `redundantTitleThreshold = ${req.body.redundantTitleThreshold}`);
  if (req.body.partialTitleDelimiters) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'partialTitleDelimiters = ?';
    updateParams.push(req.body.partialTitleDelimiters);
    playlistDataCopy.partialTitleDelimiters = req.body.partialTitleDelimiters;
    log(LOG_LEVEL_DEBUG, `partialTitleDelimiters = ${req.body.partialTitleDelimiters}`);
  } else {
    allValidFields = false;
  }
  if (!req.body.hasOwnProperty('redundantArtistThreshold')) {
    req.body.redundantArtistThreshold = null;
  }
  if (updateParams.length > 0) { updateQuery += ', '; }
  updateQuery += 'redundantArtistThreshold = ?';
  updateParams.push(req.body.redundantArtistThreshold);
  playlistDataCopy.redundantArtistThreshold = req.body.redundantArtistThreshold;
  log(LOG_LEVEL_DEBUG, `redundantArtistThreshold = ${req.body.redundantArtistThreshold}`);

  if (!allValidFields) {
    handleError(res, httpStatus.BAD_REQUEST, ERROR,
      'Error updating playlist "' + playlistId + '" - not enough valid fields given');
    return;
  }

  updateQuery += ' WHERE name = ?';
  updateParams.push(playlistId);
  log(LOG_LEVEL_DEBUG, `playlistId = ${playlistId}`);

  getDb().query(updateQuery, updateParams, (err, result) => {
    if (err) {
      handleDbError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR, 'updating', playlistId, err);
      return;
    }

    log(LOG_LEVEL_DEBUG, `Changed ${result.changedRows} rows`);
    setPlaylist(playlistId, playlistDataCopy);
    if (fileChanged) {
      const promise = playlistDataCopy.loadFile();
      watchLoadFilePromise(promise);
      playlistDataCopy._validateOldSongHistory();
    }
    log(LOG_LEVEL_DEBUG, 'Global playlists:');
    log(LOG_LEVEL_DEBUG, getPlaylists());
    res.status(httpStatus.OK);
    res.json({ status: 'OK', message: 'Playlist "' + playlistId + '" updated' });
  });
});

// partially update an existing playlist
// (accessed at PATCH http://localhost:<port>/api/v1/playlists/:playlist_id)
router.patch('/:playlist_id', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id called with PATCH url = ${req.url}`);
  log(LOG_LEVEL_DEBUG, 'req.body...');
  log(LOG_LEVEL_DEBUG, req.body);
  const playlistId = req.params.playlist_id;
  const playlistData = getPlaylist(playlistId);
  if (!playlistData) {
    handleError(res, httpStatus.NOT_FOUND, NOTFOUND,
      'Playlist "' + playlistId + '" not found');
    return;
  }
  const playlistDataCopy = new Playlist(playlistData);
  let updateQuery = 'UPDATE playlists SET ';
  const updateParams = [];
  let someValidFields = false;
  let fileChanged = false;
  if (req.body.filePath) {
    updateQuery += 'filePath = ?';
    updateParams.push(req.body.filePath);
    playlistDataCopy.filePath = req.body.filePath;
    log(LOG_LEVEL_DEBUG, `filePath = ${req.body.filePath}`);
    if (playlistData.filePath !== req.body.filePath) {
      fileChanged = true;
    }
    someValidFields = true;
  }
  if (req.body.description) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'description = ?';
    updateParams.push(req.body.description);
    playlistDataCopy.description = req.body.description;
    log(LOG_LEVEL_DEBUG, `description = ${req.body.description}`);
    someValidFields = true;
  }
  if (req.body.redundantTitleThreshold) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'redundantTitleThreshold = ?';
    updateParams.push(req.body.redundantTitleThreshold);
    playlistDataCopy.redundantTitleThreshold = req.body.redundantTitleThreshold;
    log(LOG_LEVEL_DEBUG, `redundantTitleThreshold = ${req.body.redundantTitleThreshold}`);
    someValidFields = true;
  }
  if (req.body.partialTitleDelimiters) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'partialTitleDelimiters = ?';
    updateParams.push(req.body.partialTitleDelimiters);
    playlistDataCopy.partialTitleDelimiters = req.body.partialTitleDelimiters;
    log(LOG_LEVEL_DEBUG, `partialTitleDelimiters = ${req.body.partialTitleDelimiters}`);
    someValidFields = true;
  }
  if (req.body.redundantArtistThreshold) {
    if (updateParams.length > 0) { updateQuery += ', '; }
    updateQuery += 'redundantArtistThreshold = ?';
    updateParams.push(req.body.redundantArtistThreshold);
    playlistDataCopy.redundantArtistThreshold = req.body.redundantArtistThreshold;
    log(LOG_LEVEL_DEBUG, `redundantArtistThreshold = ${req.body.redundantArtistThreshold}`);
    someValidFields = true;
  }

  if (!someValidFields) {
    handleError(res, httpStatus.BAD_REQUEST, ERROR,
      'Error updating playlist "' + playlistId + '" - no valid fields given');
    return;
  }

  updateQuery += ' WHERE name = ?';
  updateParams.push(playlistId);
  log(LOG_LEVEL_DEBUG, `playlistId = ${playlistId}`);

  getDb().query(updateQuery, updateParams, (err, result) => {
    if (err) {
      handleDbError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR, 'updating', playlistId, err);
      return;
    }

    log(LOG_LEVEL_DEBUG, `Changed ${result.changedRows} rows`);
    setPlaylist(playlistId, playlistDataCopy);
    if (fileChanged) {
      const promise = playlistDataCopy.loadFile();
      watchLoadFilePromise(promise);
      playlistDataCopy._validateOldSongHistory();
    }
    log(LOG_LEVEL_DEBUG, 'Global playlists:');
    log(LOG_LEVEL_DEBUG, getPlaylists());
    res.status(httpStatus.OK);
    res.json({ status: 'OK', message: 'Playlist "' + playlistId + '" updated' });
  });
});

// delete an existing playlist
// (accessed at DELETE http://localhost:<port>/api/v1/playlists/:playlist_id)
router.delete('/:playlist_id', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id called with DELETE url = ${req.url}`);
  const playlistId = req.params.playlist_id;
  getDb().query(
    'DELETE FROM playlists WHERE name = ?',
    [ playlistId ], (err, result) => {
      if (err) {
        handleDbError(res, httpStatus.INTERNAL_SERVER_ERROR, ERROR, 'deleting', playlistId, err);
        return;
      }

      if (result.affectedRows === 0) {
        res.status(httpStatus.NOT_FOUND);
        res.json({ status: NOTFOUND, message: 'Playlist "' + playlistId + '" not found' });
        return;
      }
      log(LOG_LEVEL_DEBUG, 'Deleted ' + result.affectedRows + ' rows');
      delete getPlaylists()[playlistId];
      log(LOG_LEVEL_DEBUG, 'Global playlists:');
      log(LOG_LEVEL_DEBUG, getPlaylists());
      res.status(httpStatus.OK);
      res.json({ status: 'OK', message: 'Playlist "' + playlistId + '" deleted' });
    }
  );
});

// return REST options metadata
// (accessed at OPTIONS http://localhost:<port>/api/v1/playlists/:playlist_id)
router.options('/:playlist_id', (req, res /* , next */) => {
  log(LOG_LEVEL_DEBUG, `/api/v1/playlists/:playlist_id called with OPTIONS url = ${req.url}`);
  res.status(httpStatus.OK);
  res.header('Allow', 'GET,HEAD,PUT,PATCH,DELETE');
  res.end();
});

router.use((req, res) => {
  res.status(httpStatus.NOT_FOUND).send('Sorry can\'t find that!');
});

router.use((error, req, res) => {
  // can this be modularized?
  log(LOG_LEVEL_ERROR, '/v1/playlists had an error');
  log(LOG_LEVEL_ERROR, error.stack);
  res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Something broke!');
});

module.exports = router;
