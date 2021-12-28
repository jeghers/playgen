
const jsmediatags = require('jsmediatags');

const { log } = require('../../utils');
const { LOG_LEVEL_ERROR } = require('../../constants');

const PLUGIN_NAME = 'mp3Tags';

/* eslint-disable no-empty-function */
const initPlugin = () => {
}; // nothing needed

const extract = songFilePath => {
  const o = { title: songFilePath, detailsLoaded: false };
  jsmediatags.read(songFilePath, {
    onSuccess: tagInfo => {
      const { tags } = tagInfo;
      o.title = tags.title;
      o.artist = tags.artist;
      o.album = tags.album;
      o.label = tags.TPUB && tags.TPUB.data;
      o.year = tags.year;
      o.detailsLoaded = true;
    },
    onError: error => {
      log(LOG_LEVEL_ERROR, `'** Failed - error type ${error.type} - ${error.info}`);
    }
  });
  return o; // bad but no other choice
};

module.exports = { name: PLUGIN_NAME, initPlugin, extract };
