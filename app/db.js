const mysql = require('mysql8');
const _ = require('lodash');

const { initPlaylist } = require('./Playlist');
const { log, sleep, handleError } = require('./utils');
const {
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_WARNING,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_NONE,
} = require('./constants');

let db = null;
let config;
let playlists;
let initialPlaylistsLoaded = false;

const setConfigForDb = configToInstall => {
  config = configToInstall;
};

const initDb = () => {

  // First you need to create a connection to the db
  db = mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
  });

  db.connect(error => {
    if (error) {
      log(LOG_LEVEL_ERROR, `Error connecting to DB - ${error}`);
      return;
    }
    log(LOG_LEVEL_INFO, 'DB Connection established');
  });
  // If you're also serving http, display a 503 error.
  db.on('error', error => {
    log(LOG_LEVEL_ERROR, `DB error - ${error}`);
    if (error.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      sleep(config.db.reconnectTime).then(() => {  // lost due to either server restart, or a
        initDb();                                  // connection idle timeout (the wait_timeout
      });                                          // server variable configures this)
    } else {
      throw error;
    }
  });

  initialDataLoad();

  /* db.end((error) => {
      // The connection is terminated gracefully
      // Ensures all previously enqueued queries are still
      // before sending a COM_QUIT packet to the MySQL server.
  }); */
};

const initialDataLoad = () => {
  playlists = {};
  db.query('SELECT * FROM playlists', (error, rows) => {
    if (error) {
      // no initial data
      log(LOG_LEVEL_ERROR, `Error querying initial playlists - ${error}`);
      sleep(config.db.reconnectTime).then(() => {
        db.end((/* error */) => {
          // The connection is terminated now
          initDb(); // retry
        });
      });
      return;
    }

    log(LOG_LEVEL_NONE, 'Data received from DB:');
    log(LOG_LEVEL_NONE, rows);

     if (rows && rows.length) {
      for (let i = 0; i < rows.length; i++) {
        // TODO: try to rescue old history on re-connect of DB
        const playlist = initPlaylist(rows[i]);
        playlists[playlist.name] = playlist;
      }
    }
    initialPlaylistsLoaded = true;
    log(LOG_LEVEL_DEBUG, 'Global playlists:');
    log(LOG_LEVEL_DEBUG, playlists);
  });
};

const pingDb = resultCallback => {
  log(LOG_LEVEL_DEBUG, 'Pinging the database...');
  let retries = 5;
  db.query('SELECT 1', (error, /* rows */) => {
    if (error) {
      // no initial data
      log(LOG_LEVEL_ERROR, `Error pinging the database - ${error}`);
      sleep(config.healthCheckRetryTime).then(() => {
        db.end((/* error */) => {
          // The connection is terminated now
          if (retries > 0) {
            retries -= 1;
            log(LOG_LEVEL_ERROR, 'Retry after sleeping');
            initDb();
            pingDb(resultCallback); // retry
          } else {
            resultCallback(false, 'Cannot reach the database');
          }
        });
      });
      return;
    }

    // healthCheckFlag = true;
    let reason;
    if (initialPlaylistsLoaded) {
      let allPlaylistsReady = true;
      _.forEach(playlists, playlist => {
        if (!playlist._fileLoaded) {
          reason = `Playlist '${playlist.name}' is not fully loaded yet`;
          log(LOG_LEVEL_INFO, reason);
          allPlaylistsReady = false;
          return false;
        }
        return true;
      });
      if (allPlaylistsReady) {
        reason = 'All playlists fully loaded';
        log(LOG_LEVEL_INFO, reason);
      }
      resultCallback(allPlaylistsReady, reason); // all playlists must be fully loaded up
    } else {
      reason = 'Initial playlist query not done yet';
      log(LOG_LEVEL_INFO, reason);
      resultCallback(false, reason);
    }
  });
};

/* eslint-disable max-params */
const handleDbError = (res, httpStatusCode, errorType, actionVerb, playlistId, error) => {
  const message = playlistId ?
    `Error ${actionVerb} playlist "${playlistId}" - ${error}` :
    `Error ${actionVerb} playlists - ${error}`;
  handleError(res, httpStatusCode, errorType, message);
  log(LOG_LEVEL_WARNING, 'Reconnecting to DB...');
  initDb();
};

module.exports = {
  setConfigForDb,
  initDb,
  pingDb,
  initialDataLoad,
  getDb: () => db,
  getPlaylists: () => playlists,
  getPlaylist: name => playlists[name],
  setPlaylist: (name, playlist) => { playlists[name] = playlist; },
  handleDbError,
};
