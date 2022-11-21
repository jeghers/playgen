// server.js

const express = require('express');
const bodyParser = require('body-parser');
const httpStatus = require('http-status-codes');

const config = require('./app/config');
const { setConfigForDb, dbInit } = require('./app/db');
const { startDownloadCleanupService } = require('./app/downloads');
const { pluginImpls } = require('./app/plugins/pluginImpls');
const { setPluginImpls, initAllPlugins } = require('./app/plugins/pluginUtils');
const { setConfigForUtils, log } = require('./app/utils');
const { setConfigForPlaylist } = require('./app/Playlist');
const { NOOP, ERROR, LOG_LEVEL_INFO } = require('./app/constants');

const port = process.env.PORT || config.session.port; // set our port

setConfigForDb(config);
setConfigForUtils(config);
setConfigForPlaylist(config);
setPluginImpls(pluginImpls);
initAllPlugins(config);

// wait until after plugins are initialized before trying to log anything
log(LOG_LEVEL_INFO, 'config...');
log(LOG_LEVEL_INFO, config);

const app = express(); // define our app using express

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

dbInit();

const defaultRouter = express.Router(); // get an instance of the express Router

// middleware to use for all requests
defaultRouter.use((req, res, next) => {
  next(); // make sure we go to the next routes and don't stop here
});

// test route to make sure everything is working
// (accessed at GET/HEAD http://localhost:<port>/api)
defaultRouter.get('/', (req, res) => {
  res.json({ status: NOOP, message: 'Welcome to the \'playgen\' api.' });
});

// test route to make sure everything is working
// (accessed at GET http://localhost:<port>/api/v1)
defaultRouter.get('/v1', (req, res) => {
  res.json({ status: NOOP, message: 'V1 is the current version.' });
});

// register our routes -------------------------------
app.use('/api', defaultRouter);

const playlistsRoute = require('./app/routes/playlists');
const currentSongRoute = require('./app/routes/currentsong');
const nextSongRoute = require('./app/routes/nextsong');
const songsRoute = require('./app/routes/songs');
const requestsRoute = require('./app/routes/requests');
const historyRoute = require('./app/routes/history');
const downloadsRoute = require('./app/routes/downloads');
const downloadsGlobalRoute = require('./app/routes/downloadsGlobal');
const healthCheckRoute = require('./app/routes/healthCheck');

// If you need a backend, e.g. an API, add your custom backend-specific middleware here
app.use('/api/v1/playlists/:playlist_id/currentsong', currentSongRoute);
app.use('/api/v1/playlists/:playlist_id/nextsong', nextSongRoute);
app.use('/api/v1/playlists/:playlist_id/songs', songsRoute);
app.use('/api/v1/playlists/:playlist_id/requests', requestsRoute);
app.use('/api/v1/playlists/:playlist_id/history', historyRoute);
app.use('/api/v1/playlists/:playlist_id/downloads', downloadsRoute);
app.use('/api/v1/playlists', playlistsRoute);
app.use('/api/v1/downloads', downloadsGlobalRoute);
app.use('/api/v1/healthcheck', healthCheckRoute);

// catch all the rest as errors
app.use((req, res) => {
  // special case of version mismatch
  if (/\/api\/v(?!1)/.test(req.url)) {
    res.status(httpStatus.NOT_IMPLEMENTED);
    res.json({ status: ERROR, message: 'Version not supported.' });
    return;
  }
  res.status(httpStatus.NOT_FOUND);
  res.json({ status: ERROR, message: 'Sorry can\'t find that!' });
});

startDownloadCleanupService();

// start the server
// =============================================================================
app.listen(port);
log(LOG_LEVEL_INFO, `Listening on port ${port}`);
