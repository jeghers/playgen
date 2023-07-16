// server.js

const express = require('express');
const bodyParser = require('body-parser');
const httpStatus = require('http-status-codes');

const config = require('./app/config');
const { serverVersion, apiVersion } = require('./app/version');
const { initDb, setConfigForDb, pingDb } = require('./app/db');
const { initVault, updateConfigFromVault, authenticateVaultAppRole, setVaultAppRoleToken } = require('./app/vault');
const { startDownloadCleanupService } = require('./app/downloads');
const { pluginImpls } = require('./app/plugins/pluginImpls');
const { setPluginImpls, initAllPlugins } = require('./app/plugins/pluginUtils');
const { setConfigForUtils, log } = require('./app/utils');
const { setConfigForPlaylist } = require('./app/Playlist');
const { NOOP, ERROR, READY, OFFLINE, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_DEBUG } = require('./app/constants');

const managementRoute = require('./app/routes/management');
const healthCheckRoute = require('./app/routes/healthCheck');
const playlistsRoute = require('./app/routes/playlists');
const currentSongRoute = require('./app/routes/currentsong');
const nextSongRoute = require('./app/routes/nextsong');
const songsRoute = require('./app/routes/songs');
const requestsRoute = require('./app/routes/requests');
const historyRoute = require('./app/routes/history');
const downloadsRoute = require('./app/routes/downloads');
const downloadsGlobalRoute = require('./app/routes/downloadsGlobal');

const port = process.env.PORT || config.session.port; // set our port

const app = express(); // define our app using express
// configure app to use bodyParser() this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

setPluginImpls(pluginImpls);
initAllPlugins(config);
setConfigForUtils(config); // do this early so logging will work

log(LOG_LEVEL_INFO, `Server Version: ${serverVersion}`);
log(LOG_LEVEL_INFO, `API Version: ${apiVersion}`);

log(LOG_LEVEL_DEBUG, 'call initVault now...');
initVault().then(initedOk => {
  log(LOG_LEVEL_INFO, `initVault returned ${initedOk}`);
  if (initedOk) {
    log(LOG_LEVEL_DEBUG, 'call authenticateVaultAppRole now...');
    authenticateVaultAppRole()
      .then(token => {
        setVaultAppRoleToken(token);
        log(LOG_LEVEL_INFO, 'authenticateVaultAppRole finished ok');
        log(LOG_LEVEL_DEBUG, 'call updateConfigFromVault now...');
        updateConfigFromVault(config)
          .then(() => {
            log(LOG_LEVEL_INFO, 'updateConfigFromVault finished ok');
            initAndStartApp();
          })
          .catch(error => {
            log(LOG_LEVEL_ERROR, `updateConfigFromVault failed: ${error.message}`);
            initAndStartApp();
          });
      })
      .catch(error => {
        log(LOG_LEVEL_ERROR, `authenticateVaultAppRole failed: ${error.message || error.error.message}`);
        initAndStartApp();
      });
  } else {
    setVaultAppRoleToken(null); // null means no vault available
    initAndStartApp();
  }
});

const initAndStartApp = () => {
  setConfigForDb(config);
  setConfigForPlaylist(config);

  initDb();

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

  // current version of the playgen service
  // (accessed at GET http://localhost:<port>/api/version)
  defaultRouter.get('/version', (req, res) => {
    const returnJson = {
      serverVersion,
      apiVersion,
      message: `${serverVersion} is the current playgen server version, ${apiVersion} is the current API version`,
    };
    pingDb(healthCheckFlag => {
      returnJson.status = healthCheckFlag ? READY : OFFLINE;
      res.json(returnJson);
    });
  });

  // test route to make sure everything is working
  // (accessed at GET http://localhost:<port>/api/v1)
  defaultRouter.get('/v1', (req, res) => {
    res.json({ status: NOOP, message: 'v1 is the current API version.' });
  });

  // register our routes
  app.use('/api', defaultRouter);
  app.use('/api/v1/management', managementRoute);
  app.use('/api/v1/healthcheck', healthCheckRoute);
  app.use('/api/v1/playlists/:playlist_id/currentsong', currentSongRoute);
  app.use('/api/v1/playlists/:playlist_id/nextsong', nextSongRoute);
  app.use('/api/v1/playlists/:playlist_id/songs', songsRoute);
  app.use('/api/v1/playlists/:playlist_id/requests', requestsRoute);
  app.use('/api/v1/playlists/:playlist_id/history', historyRoute);
  app.use('/api/v1/playlists/:playlist_id/downloads', downloadsRoute);
  app.use('/api/v1/playlists', playlistsRoute);
  app.use('/api/v1/downloads', downloadsGlobalRoute);

  // catch all the rest as errors
  app.use((req, res) => {
    // special case of API version mismatch
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
  app.listen(port);
  log(LOG_LEVEL_INFO, `Listening on port ${port}`);
}
