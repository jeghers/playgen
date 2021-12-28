
// give it a nicer name than this
const PLUGIN_NAME = 'newSongDetailsPlugin';

/* eslint-disable no-empty-function */
/* eslint-disable no-unused-vars */
// you can omit unneeded parameters
// (well, at least the trailing ones)
const initPlugin = (config, params) => {
  // nothing needed in this case, but if your plugin
  // needs some initialization, implement it here
};

const extract = songFilePath => {
  const o = { title: songFilePath, detailsLoaded: false };
  // use your own logic to add these additional fields to the object:
  // o.title = the song title
  // o.artist = the artist
  // o.album = the album the song came from
  // o.label = the record label (publisher)
  // o.year = the year it was released
  o.detailsLoaded = true;
  return o;
};

// make sure the export has the plugin name and all the implemented methods
module.exports = { name: PLUGIN_NAME, initPlugin, extract };
