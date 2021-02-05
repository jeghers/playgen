const mysql = require('mysql8');

const Playlist = require('./Playlist');
const { watchPromise } = require('./utils');
const config = require('./config');

let db = null;
const playlists = {};

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const dbInit = () => {

  console.log('**************** new dbInit');
  // First you need to create a connection to the db
  db = mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
  });

  db.connect((err) => {
    if (err) {
      console.log('Error connecting to DB - ' + err);
      return;
    }
    console.log('Connection established');
  });
  // If you're also serving http, display a 503 error.
  db.on('error', (err) => {
    console.log('DB error', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      sleep(config.db.reconnectTime).then(() => {  // lost due to either server restart, or a
        dbInit();                                  // connection idle timeout (the wait_timeout
      });                                          // server variable configures this)
    } else {
      throw err;
    }
  });

  db.query('SELECT * FROM playlists', (err, rows) => {
    if (err) {
      // no initial data
      console.log('Error querying initial playlists - ' + err);
      sleep(config.db.reconnectTime).then(() => {
        db.end((/* err */) => {
          // The connection is terminated now
          dbInit(); // retry
        });
      });
      return;
    }

    //console.log('Data received from DB:');
    //console.log(rows);

    /* eslint-disable no-warning-comments */
    if (rows && rows.length) {
      for (let i = 0; i < rows.length; i++) {
        // TODO: try to rescue old history on re-connect of DB
        const playlist = new Playlist(rows[i]);
        const promise = playlist.loadFile();
        watchPromise(promise);
        playlists[playlist.name] = playlist;
      }
    }
    console.log('Global playlists:');
    console.log(playlists);
  });

  /*db.end((err) => {
      // The connection is terminated gracefully
      // Ensures all previously enqueued queries are still
      // before sending a COM_QUIT packet to the MySQL server.
  });*/
};

module.exports = {
  dbInit: dbInit,
  getDb: () => db,
  playlists: playlists,
};
