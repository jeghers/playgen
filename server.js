// server.js

// BASE SETUP
// =============================================================================

// call the packages we need
const express = require('express');    // call express
const httpStatus = require('http-status-codes');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const _ = require('lodash');
const Playlist = require('./app/Playlist');
const config = require('./config');
const port = process.env.PORT || config.session.port; // set our port

console.log('config...');
console.log(config);

/* const playListsJson = require('./playlists.json'); // (with path)
console.log('Playlist JSON data...');
console.log(playListsJson); */

const app = express();                 // define our app using express

const playlists = {};

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let db = null;

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dbInit () {

  // First you need to create a connection to the db
  db = mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
  });

  db.connect(function (err) {
    if (err) {
      console.log('Error connecting to DB - ' + err);
      return;
    }
    console.log('Connection established');
  });
  // If you're also serving http, display a 503 error.
  db.on('error', function (err) {
    console.log('DB error', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      sleep(config.db.reconnectTime).then(() => {  // lost due to either server restart, or a
        dbInit();                                  // connnection idle timeout (the wait_timeout
      });                                          // server variable configures this)
    } else {
      throw err;
    }
  });

  db.query('SELECT * FROM playlists', function (err, rows) {
    if (err) {
      // no initial data
      console.log('Error querying initial playlists - ' + err);
      sleep(config.db.reconnectTime).then(() => {
        db.end(function (/* err */) {
          // The connection is terminated now
          dbInit(); // retry
        });
      });
      return;
    }

    //console.log('Data received from DB:');
    //console.log(rows);

    if (rows && rows.length) {
      for (let i = 0; i < rows.length; i++) {
        const playlist = new Playlist(rows[i]);
        const promise = playlist.loadFile();
        watchPromise(promise);
        playlists[playlist.name] = playlist;
      }
    }

    console.log('Global playlists:');
    console.log(playlists);

  });

  /*db.end(function(err)
  {
      // The connection is terminated gracefully
      // Ensures all previously enqueued queries are still
      // before sending a COM_QUIT packet to the MySQL server.
  });*/
}

dbInit();

// ROUTES FOR OUR API
// =============================================================================
const router = express.Router(); // get an instance of the express Router

// middleware to use for all requests
router.use(function (req, res, next) {
  // do logging
  console.log('Something is happening.');
  next(); // make sure we go to the next routes and don't stop here
});

// test route to make sure everything is working
// (accessed at GET http://localhost:<port>/api)
router.get('/', function (req, res) {
  res.json({ status: 'NOOP', message: 'Welcome to the \'playgen\' api.' });
});

// more routes for our API will happen here

// on routes that end in /playlists
// ----------------------------------------------------
router.route('/playlists')

  // get all the playlists
  // (accessed at GET http://localhost:<port>/api/playlists)
  .get(function (req, res) {
    db.query('SELECT * FROM playlists', function (err, rows) {
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
  })

  // get playlists metadata
  // (accessed at HEAD http://localhost:<port>/api/playlists)
  .head(function (req, res) {
    db.query('SELECT * FROM playlists', function (err, rows) {
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
  })

  // create a playlist
  // (accessed at POST http://localhost:<port>/api/playlists)
  .post(function (req, res) {
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

    db.query('INSERT INTO playlists SET ?',
      insertParams, function (err /* , result */) {
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
        res.json({ status: 'OK', uri, message: 'Playlist ' + name + ' created' });
      });
  })

  // get playlist options
  // (accessed at OPTIONS http://localhost:<port>/api/playlists)
  .options(function (req, res) {
    res.status(httpStatus.OK);
    res.header('Allow', 'GET,HEAD,POST');
    res.end();
  });

// on routes that end in /playlists/:playlist_id
// ----------------------------------------------------
router.route('/playlists/:playlist_id')

  // get the playlist with that id
  // (accessed at GET http://localhost:<port>/api/playlists/:playlist_id)
  .get(function (req, res) {
    const playlistId = req.params.playlist_id;
    db.query('SELECT * FROM playlists Where name = ?',
      [ playlistId ], function (err, rows) {
        if (err) {
          handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
            'Error fetching playlist ' + playlistId + ' - ' + err);
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
  })

  // get playlist metadata
  // (accessed at HEAD http://localhost:<port>/api/playlists/:playlist_id)
  .head(function (req, res) {
    const playlistId = req.params.playlist_id;
    db.query('SELECT * FROM playlists Where name = ?',
      [ playlistId ], function (err, rows) {
        if (err) {
          handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
            'Error fetching playlist ' + playlistId + ' - ' + err);
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
  })

  // update the playlist with this id
  // (accessed at PUT http://localhost:<port>/api/playlists/:playlist_id)
  .put(function (req, res) {
    const playlistId = req.params.playlist_id;
    const data = playlists[playlistId];
    if (!data) {
      handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
        'Playlist ' + playlistId + ' not found');
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
    } else {
      allValidFields = false;
    }
    if (req.body.description) {
      if (updateParams.length > 0) { updateQuery += ', '; }
      updateQuery += 'description = ?';
      updateParams.push(req.body.description);
      dataCopy.description = req.body.description;
      console.log('description = ' + req.body.description);
    } else {
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
    } else {
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
        'Error updating playlist ' + playlistId + ' - not enough valid fields given');
      return;
    }

    updateQuery += ' WHERE name = ?';
    updateParams.push(playlistId);
    console.log('playlistId = ' + playlistId);

    db.query(
      updateQuery, updateParams,
      function (err, result) {
        if (err) {
          handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
            'Error updating playlist ' + playlistId + ' - ' + err);
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
        res.json({ status: 'OK', message: 'Playlist ' + playlistId + ' updated' });
      }
    );
  })

  // update the playlist with this id
  // (accessed at PATCH http://localhost:<port>/api/playlists/:playlist_id)
  .patch(function (req, res) {
    const playlistId = req.params.playlist_id;
    const data = playlists[playlistId];
    if (!data) {
      handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
        'Playlist ' + playlistId + ' not found');
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
        'Error updating playlist ' + playlistId + ' - no valid fields given');
      return;
    }

    updateQuery += ' WHERE name = ?';
    updateParams.push(playlistId);
    console.log('playlistId = ' + playlistId);

    db.query(
      updateQuery, updateParams,
      function (err, result) {
        if (err) {
          handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
            'Error updating playlist ' + playlistId + ' - ' + err);
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
        res.json({ status: 'OK', message: 'Playlist ' + playlistId + ' updated' });
      }
    );
  })

  // delete the playlist with this id
  // (accessed at DELETE http://localhost:<port>/api/playlists/:playlist_id)
  .delete(function (req, res) {
    const playlistId = req.params.playlist_id;
    db.query(
      'DELETE FROM playlists WHERE name = ?',
      [ playlistId ], function (err, result) {
        if (err) {
          handleError(res, httpStatus.INTERNAL_SERVER_ERROR, 'ERROR',
            'Error deleting playlist ' + playlistId + ' - ' + err);
          console.log('Reconnecting to DB...');
          dbInit();
          return;
        }

        if (result.affectedRows === 0) {
          res.status(httpStatus.NOT_FOUND);
          res.json({ status: 'NOTFOUND', message: 'Playlist ' + playlistId + ' not found' });
          return;
        }
        console.log('Deleted ' + result.affectedRows + ' rows');
        delete playlists[playlistId];
        console.log('Global playlists:');
        console.log(playlists);
        res.status(httpStatus.OK);
        res.json({ status: 'OK', message: 'Playlist ' + playlistId + ' deleted' });
      }
    );
  })

  // get playlist options
  // (accessed at OPTIONS http://localhost:<port>/api/playlists/:playlist_id)
  .options(function (req, res) {
    res.status(httpStatus.OK);
    res.header('Allow', 'GET,HEAD,PUT,PATCH,DELETE');
    res.end();
  });

// on routes that end in /playlists/:playlist_id/songs
// ----------------------------------------------------
router.route('/playlists/:playlist_id/songs')

  // get the songs for the playlist with that id (accessed at
  // GET http://localhost:<port>/api/playlists/:playlist_id/songs[?start=nn&length=nn])
  .get(function (req, res) {
    const playlistId = req.params.playlist_id;
    db.query('SELECT * FROM playlists Where name = ?',
      [ playlistId ], function (err, rows) {
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
            let songList = _.cloneDeep(playlist._songsToPlay);
            console.log('Query string...');
            console.log(req.query);
            const { start, length } = req.query;
            console.log('Query string for start = ' + start);
            console.log('Query string for length = ' + length);
            if (start) {
              songList = songList.slice(start);
            }
            if (length) {
              songList = songList.slice(0, length);
            }
            const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
            for (let i = 0; i < songList.length; i++) {
              const o = songList[i];
              o.uri = `${fullUrl}/${i}`;
            }
            console.log('    ' + playlist.count() + ' songs');
            const count = songList.length; // playlist.count();
            res.status(httpStatus.OK);
            if (start) {
              res.header('X-Start', `${start}`);
            }
            res.header('X-Count', `${count}`);
            res.header('X-Total-Count', `${playlist._songsToPlay.length}`);
            res.json({
              status: 'OK',
              result: { playlist: playlistId, songs: songList, count }
            });
            return;
          }
          else {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' is in the DB but not the memory list');
          }
        }
      }
    );
  })

  // get metadata for the songs for the playlist (accessed at
  // HEAD http://localhost:<port>/api/playlists/:playlist_id/songs[?start=nn&length=nn])
  .head(function (req, res) {
    const playlistId = req.params.playlist_id;
    db.query('SELECT * FROM playlists Where name = ?',
      [ playlistId ], function (err, rows) {
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
            console.log('    ' + playlist._songsToPlay.length + ' songs');
            let songList = _.clone(playlist._songsToPlay);
            console.log('Query string...');
            console.log(req.query);
            const { start, length } = req.query;
            console.log('Query string for start = ' + start);
            console.log('Query string for length = ' + length);
            if (start) {
              songList = songList.slice(start);
            }
            if (length) {
              songList = songList.slice(0, length);
            }
            const count = songList.length; // playlist._songsToPlay.length;
            res.status(httpStatus.OK);
            if (start) {
              res.header('X-Start', `${start}`);
            }
            res.header('X-Count', `${count}`);
            res.header('X-Total-Count', `${playlist._songsToPlay.length}`);
            res.end();
            return;
          }
          else {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' is in the DB but not the memory list');
          }
        }
      }
    );
  })

  // get playlist options
  // (accessed at OPTIONS http://localhost:<port>/api/playlists/:playlist_id/songs)
  .options(function (req, res) {
    res.status(httpStatus.OK);
    res.header('Allow', 'GET,HEAD');
    res.end();
  });

// on routes that end in /playlists/:playlist_id/songs/:song_index
// ----------------------------------------------------
router.route('/playlists/:playlist_id/songs/:song_index')

  // get the indexed song in the playlist with the given id (accessed at
  // GET http://localhost:<port>/api/playlists/:playlist_id/songs/:song_index)
  .get(function (req, res) {
    const playlistId = req.params.playlist_id;
    db.query('SELECT * FROM playlists Where name = ?',
      [ playlistId ], function (err, rows) {
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
            console.log('    ' + playlist.count() + ' songs');
            const count = playlist.count();
            if (req.params.song_index >= count) {
              handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
                'Playlist ' + playlistId + ' only has ' + count + ' songs');
              return;
            }
            const song = _.cloneDeep(playlist._songsToPlay[req.params.song_index]);
            song.playlist = playlistId;
            console.log('    song... ');
            console.log(song);
            delete song['uri'];
            res.json({ status: 'OK', result: song });
          }
          else {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' is in the DB but not the memory list');
          }
        }
      }
    );
  })

  // get playlist options
  // (accessed at OPTIONS http://localhost:<port>/api/playlists/:playlist_id/songs/:song_index)
  .options(function (req, res) {
    res.status(httpStatus.OK);
    res.header('Allow', 'GET');
    res.end();
  });

// on routes that end in /playlists/:playlist_id/nextsong
// ----------------------------------------------------
router.route('/playlists/:playlist_id/nextsong')

  // get the next randomly-selected song from
  // the playlist with that id (accessed at
  // GET http://localhost:<port>/api/playlists/:playlist_id/nextsong[?format=text])
  .get(function (req, res) {
    const playlistId = req.params.playlist_id;
    db.query('SELECT * FROM playlists Where name = ?',
      [ playlistId ], function (err, rows) {
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
            const next = _.cloneDeep(playlist._getNextSong());
            next.playlist = playlistId;
            next.song.uri = `${req.protocol}://${req.get('host')}${req.originalUrl.replace('nextsong', 'songs')}/${next.index}`;
            console.log('Query string...');
            console.log(req.query);
            console.log('Query string for format = ' + req.query.format);
            res.status(httpStatus.OK);
            if ((req.query.format) && (req.query.format === 'text')) {
              console.log('Return text instead of JSON');
              console.log('next.song.file = ' + next.song.file);
              res.type('text/plain');
              res.send(next.song.file); // text only
            }
            else { res.json({ status: 'OK', result: next }); }
          }
          else {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' is in the DB but not the memory list');
          }
        }
      }
    );
  })

  // get playlist options
  // (accessed at OPTIONS http://localhost:<port>/api/playlists/:playlist_id/nextsong)
  .options(function (req, res) {
    res.status(httpStatus.OK);
    res.header('Allow', 'GET');
    res.end();
  });

// on routes that end in /playlists/:playlist_id/currentsong
// ----------------------------------------------------
router.route('/playlists/:playlist_id/currentsong')

  // get the currently-selected song from
  // the playlist with that id (accessed at
  // GET http://localhost:<port>/api/playlists/:playlist_id/currentsong[?format=text])
  .get(function (req, res) {
    const playlistId = req.params.playlist_id;
    db.query('SELECT * FROM playlists Where name = ?',
      [ playlistId ], function (err, rows) {
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
  })

  // get playlist options
  // (accessed at OPTIONS http://localhost:<port>/api/playlists/:playlist_id/currentsong)
  .options(function (req, res) {
    res.status(httpStatus.OK);
    res.header('Allow', 'GET');
    res.end();
  });

// on routes that end in /playlists/:playlist_id/history
// ----------------------------------------------------
router.route('/playlists/:playlist_id/history')

  // get the song history from the playlist with that id (accessed at
  // GET http://localhost:<port>/api/playlists/:playlist_id/history[?start=nn&length=nn])
  .get(function (req, res) {
    const playlistId = req.params.playlist_id;
    db.query('SELECT * FROM playlists Where name = ?',
      [ playlistId ], function (err, rows) {
        if (err) {
          handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
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
            let history = _.cloneDeep(playlist._getSongHistory());
            history.forEach((item, historyIndex) => {
              item.historyIndex = historyIndex;
            });
            console.log('Query string...');
            console.log(req.query);
            const { start, length } = req.query;
            console.log('Query string for start = ' + start);
            console.log('Query string for length = ' + length);
            if (start) {
              history = history.slice(start);
            }
            if (length) {
              history = history.slice(0, length);
            }
            const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
            for (let i = 0; i < history.length; i++) {
              const o = history[i];
              o.song.uri = `${req.protocol}://${req.get('host')}${req.originalUrl.replace('history', 'songs')}/${o.index}`;
              o.uri = `${fullUrl}/${i}`;
            }
            const count = history.length;
            res.status(httpStatus.OK);
            if (start) {
              res.header('X-Start', `${start}`);
            }
            res.header('X-Count', `${count}`);
            res.header('X-Total-Count', `${playlist._getSongHistory().length}`);
            res.json({ status: 'OK', result: { playlist: playlistId, history, count } });
          }
          else {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' is in the DB but not the memory list');
          }
        }
      }
    );
  })

  // get metadata for the song history from the playlist (accessed at
  // HEAD http://localhost:<port>/api/playlists/:playlist_id/history)
  .head(function (req, res) {
    const playlistId = req.params.playlist_id;
    db.query('SELECT * FROM playlists Where name = ?',
      [ playlistId ], function (err, rows) {
        if (err) {
          handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
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
            console.log('    ' + playlist._getSongHistory().length + ' songs');
            let history = _.clone(playlist._getSongHistory());
            console.log('Query string...');
            console.log(req.query);
            const { start, length } = req.query;
            console.log('Query string for start = ' + start);
            console.log('Query string for length = ' + length);
            if (start) {
              history = history.slice(start);
            }
            if (length) {
              history = history.slice(0, length);
            }
            const count = history.length; // playlist._songsToPlay.length;
            res.status(httpStatus.OK);
            if (start) {
              res.header('X-Start', `${start}`);
            }
            res.header('X-Count', `${count}`);
            res.header('X-Total-Count', `${playlist._getSongHistory().length}`);
            res.end();
          }
          else {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' is in the DB but not the memory list');
          }
        }
      }
    );
  })

  // get playlist options
  // (accessed at OPTIONS http://localhost:<port>/api/playlists/:playlist_id/history)
  .options(function (req, res) {
    res.status(httpStatus.OK);
    res.header('Allow', 'GET,HEAD');
    res.end();
  });

// on routes that end in /playlists/:playlist_id/history/:song_index
// ----------------------------------------------------
router.route('/playlists/:playlist_id/history/:song_index')

  // get the indexed song in the history of
  // the playlist with that id (accessed at
  // GET http://localhost:<port>/api/playlists/:playlist_id/history/:song_index)
  .get(function (req, res) {
    const playlistId = req.params.playlist_id;
    db.query('SELECT * FROM playlists Where name = ?',
      [ playlistId ], function (err, rows) {
        if (err) {
          handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
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
            const history = playlist._getSongHistory();
            if (history === null) {
              handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
                'Playlist ' + playlistId + ' has no song history yet');
              return;
            }
            if (req.params.song_index >= history.length) {
              handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
                'Playlist ' + playlistId + ' only has ' + history.length + ' songs');
              return;
            }

            const historyItem = _.cloneDeep(history[req.params.song_index]);
            historyItem.playlist = playlistId;
            historyItem.song.uri =
              `${req.protocol}://${req.get('host')}${req.originalUrl.replace(/history.*$/, 'songs')}/${historyItem.index}`;
            res.status(httpStatus.OK);
            res.json({ status: 'OK', result: historyItem });
          }
          else {
            handleError(res, httpStatus.NOT_FOUND, 'NOTFOUND',
              'Playlist ' + playlistId + ' is in the DB but not the memory list');
          }
        }
      }
    );
  })

  // get playlist options
  // (accessed at OPTIONS http://localhost:<port>/api/playlists/:playlist_id/history/:song_index)
  .options(function (req, res) {
    res.status(httpStatus.OK);
    res.header('Allow', 'GET');
    res.end();
  });

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Listening on port ' + port);

/* eslint-disable max-params */
function handleError (res, status, error, message) {
  console.log(message);
  res.status(status);
  res.json({ status: error, message: message });
}

function watchPromise (p) {
  if (p) {
    p.then(function (responsePlaylist) {
      console.log('Playlist ' + responsePlaylist.name + ' loaded ' +
        responsePlaylist.count() + ' songs successfully');
      console.log('Playlist...');
      console.log(responsePlaylist);
    }, function (error) {
      console.error('Promise failed.', error);
    });
  }
}
