const fs = require('fs');
const _ = require('lodash');

const {
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_ERROR,
  OK,
  ERROR_NOENT,
  DOWNLOAD_LINK_PREFIX,
} = require('./constants');
const { log } = require('./utils');
const config = require('./config');

const filePathDelimiter = process.platform === 'win32' ? '\\' : '/';

const getCwd = () => process.cwd();

const relativeToAbsolutePath = path => {
  if (path.startsWith('/')) {
    return path;
  }
  let finalPath = path;
  let cwdBase = getCwd();
  while (finalPath.charAt(0) === '.') {
    if (finalPath.startsWith('./')) {
      finalPath = finalPath.substring(2);
    } else if (finalPath.startsWith('../')) {
      let lastDelimiterIndex = cwdBase.lastIndexOf('\\');
      if (lastDelimiterIndex === -1) {
        lastDelimiterIndex = cwdBase.lastIndexOf('/');
      }
      if (lastDelimiterIndex > -1) {
        cwdBase = cwdBase.substring(0, lastDelimiterIndex);
        finalPath = finalPath.substring(3);
      }
    }
  }
  finalPath = `${cwdBase}${filePathDelimiter}${finalPath}`;
  return finalPath;
};

const constructLinkPath = (playlistName, index, title) => {
  return `${config.downloads.downloadsPath}/${DOWNLOAD_LINK_PREFIX}${playlistName}-${index}-${title.replace(/ /g, '_')}.mp3`;
};

const parseLinkPath = linkPath => {
  const pathAndFields = linkPath.split(DOWNLOAD_LINK_PREFIX);
  if (pathAndFields.length < 2) {
    return null;
  }
  const path = pathAndFields[0];
  const fileFields = pathAndFields[1];
  const fields = fileFields.split('-');
  const playlist = fields[0];
  const index = parseInt(fields[1], 10);
  const title = fields[2].replace(/_/g, ' ').replace('.mp3', '');
  return { path, playlist, index, title };
};

const getAllSymLinks = (downloadsPath, playlist) => {
  const absDownloadsPath = relativeToAbsolutePath(downloadsPath);
  let symLinks = fs.readdirSync(absDownloadsPath);
  log(LOG_LEVEL_DEBUG, 'Symbolic link files...');
  log(LOG_LEVEL_DEBUG, symLinks);
  if (!_.isUndefined(playlist)) {
    symLinks = _.filter(symLinks, link => {
      return link.startsWith(`song-${playlist}-`);
    });
  }
  const playlistLinkMap = {};
  const playlistNames = _.filter(_.uniq(_.map(symLinks, link => {
    const linkInfo = parseLinkPath(link);
    if (linkInfo === null) {
      return null;
    }
    if (_.isUndefined(playlistLinkMap[linkInfo.playlist])) {
      playlistLinkMap[linkInfo.playlist] = [];
    }
    const { index } = linkInfo;
    const linkPath = `${absDownloadsPath}${filePathDelimiter}${link}`;
    const url = `${config.downloads.webServerBaseUrl}/${link}`;
    playlistLinkMap[linkInfo.playlist].push({
      songIndex: index,
      linkPath,
      url,
      songPath: symLinkPath(linkPath),
    });
    return linkInfo.playlist;
  })), link => link !== null);
  return _.map(playlistNames, playlistName => {
    const linkList = playlistLinkMap[playlistName].sort((link1, link2) => {
      if (link1.songIndex < link2.songIndex) {
        return -1;
      } else if (link1.songIndex > link2.songIndex) {
        return 1;
      }
      return 0;
    });
    _.forEach(linkList, (link, index) => { link.downloadIndex = index; });
    return { playlistName, downloadLinks: linkList, downloadsCount: linkList.length };
  });
};

const makeSymLink = (target, link) => {
  let targetPath = target;
  if (targetPath.charAt(0) === '.') {
    targetPath = relativeToAbsolutePath(targetPath);
  }
  if (!fs.existsSync(targetPath)) {
    log(LOG_LEVEL_ERROR, `Song file ${targetPath} does not exist`);
    return ERROR_NOENT;
  }
  let linkPath = link;
  if (linkPath.charAt(0) === '.') {
    linkPath = relativeToAbsolutePath(linkPath);
  }
  try {
    fs.symlinkSync(targetPath, linkPath, 'file');
    log(LOG_LEVEL_INFO, `Symbolic link created: ${targetPath} linked to ${linkPath}`);
    return OK;
  } catch (error) {
    log(LOG_LEVEL_ERROR, `Symbolic link creation failed: ${targetPath} was not linked to ${linkPath}`);
    log(LOG_LEVEL_ERROR, error);
    return error.code;
  }
};

const symLinkPath = link => {
  try {
    const symlinkPath = fs.readlinkSync(link);
    if (!fs.existsSync(symlinkPath)) {
      log(LOG_LEVEL_ERROR, `Link target song file ${symlinkPath} does not exist`);
      return null;
    }
    log(LOG_LEVEL_INFO, `Symlink ${link} points to ${symlinkPath}`);
    return symlinkPath;
  } catch (error) {
    log(LOG_LEVEL_ERROR, `Failed to read link ${link}: ${error}`);
    return null;
  }
};

const downloadCleanupTask = (absDownloadsPath, expireTimeMs) => {
  const now = Date.now();
  const symLinks = fs.readdirSync(absDownloadsPath);
  _.forEach(symLinks, symLink => {
    const fileStats = fs.lstatSync(`${absDownloadsPath}/${symLink}`);
    const ctimeMs = Math.round(fileStats.ctimeMs);
    const age = now - ctimeMs;
    if (age > expireTimeMs) {
      const downloadLinkToDelete = `${absDownloadsPath}/${symLink}`;
      fs.unlinkSync(downloadLinkToDelete);
    }
  });
}

const startDownloadCleanupService = () => {
  const { downloads } = config;
  if (!downloads.enabled) {
    log(LOG_LEVEL_INFO, 'Download links are not enabled, cleanup service will not be started');
    return;
  }
  if (_.isUndefined(downloads.downloadsPath)) {
    log(LOG_LEVEL_INFO, 'Download links are not configured, cleanup service will not be started');
    return;
  }
  let expireTimeSec = 0;
  if (downloads.expireTimeMinutes) {
    expireTimeSec += downloads.expireTimeMinutes * 60;
  }
  if (downloads.expireTimeHours) {
    expireTimeSec += downloads.expireTimeHours * 60 * 60;
  }
  if (downloads.expireTimeDays) {
    expireTimeSec += downloads.expireTimeDays * 60 * 60 * 24;
  }
  const scanIntervalMinutes = downloads.scanIntervalMinutes || 5;
  if (expireTimeSec < 2 * 60) {
    log(LOG_LEVEL_INFO, 'Download link cleanup shorter than 2 minutes will churn too much, cleanup service will not be started');
    return;
  }
  if (expireTimeSec > 0) {
    const absDownloadsPath = relativeToAbsolutePath(downloads.downloadsPath);
    setInterval(downloadCleanupTask, scanIntervalMinutes * 60 * 1000, absDownloadsPath, expireTimeSec * 1000);
  }
};

module.exports = {
  getCwd,
  relativeToAbsolutePath,
  constructLinkPath,
  parseLinkPath,
  getAllSymLinks,
  makeSymLink,
  symLinkPath,
  startDownloadCleanupService,
};
