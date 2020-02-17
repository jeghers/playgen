/*
 * Playlist support
 */

const fs = require('fs');

const config = require('../config');

function Playlist (data) {
  this.name = data.name;
  this.filePath = data.filePath;
  this.description = data.description;
  this.redundantTitleThreshold = data.redundantTitleThreshold;
  this.partialTitleDelimiters = data.partialTitleDelimiters;
  this.redundantArtistThreshold = data.redundantArtistThreshold;
  if ((data.hasOwnProperty('_songsToPlay')) && (data._songsToPlay)) {
    this._fileLoaded = true;
    this._songsToPlay = data._songsToPlay;
    this._songCount = data._songsToPlay.length;
    this._randomSongIndices = data._randomSongIndices;
    this._currentSongIdxIdx = data._currentSongIdxIdx;
    this._currentSongIdx = data._currentSongIdx;
    this._currentSong = data._currentSong;
    this._songHistory = data._songHistory;
    this._titleHistory = data._titleHistory;
    this._artistHistory = data._artistHistory;
  }
  else {
    this._fileLoaded = false;
    this._songsToPlay = null;
    this._songCount = 0;
    this._randomSongIndices = null;
    this._currentSongIdxIdx = null;
    this._currentSongIdx = null;
    this._currentSong = null;
    this._songHistory = null;
    this._titleHistory = null;
    this._artistHistory = null;
  }
  this._partialTitleDelimiters = null;
  this._filePath = null;
}

Playlist.prototype.count = function () {
  return this._songCount;
};

Playlist.prototype.loadFile = function () {
  const thisPlaylist = this;
  if (this.filePath) {
    try {
      fs.accessSync(this.filePath, fs.R_OK);
      console.log(`${this.filePath} is a DIR`);
      if (fs.statSync(this.filePath).isDirectory()) {
        // directory
        return new Promise(function (resolve, reject) {
          try {
            const files = fs.readdirSync(thisPlaylist.filePath);
            console.log(`Files in directory ${thisPlaylist.filePath}...`);
            console.log(files);
            files.forEach((file, index) => {
              thisPlaylist._processLine(`${thisPlaylist.filePath}/${file}`, index);
            });
            thisPlaylist._fileLoaded = true;
            thisPlaylist._songCount =
              (thisPlaylist._songsToPlay) ? thisPlaylist._songsToPlay.length : 0;
            if (thisPlaylist._songCount > 0) {
              thisPlaylist._buildRandomIndex();
              thisPlaylist._clearSongHistory();
            }
            resolve(thisPlaylist);
          }
          catch (err) {
            reject(err);
          }
        });
      }
      console.log('Playlist ' + thisPlaylist.name + ' song file ' +
        thisPlaylist.filePath + ' DOES exist and is readable');
      return new Promise(function (resolve, reject) {
        const fileInput = fs.createReadStream(thisPlaylist.filePath);
        thisPlaylist._readLines(fileInput, resolve, reject);
      });
    }
    catch (err) {
      console.log('Playlist ' + thisPlaylist.name + ' song file ' +
        thisPlaylist.filePath +
        ' DOES NOT exist or is not readable');
      return null;
    }
  }
  else {
    console.log('Playlist ' + thisPlaylist.name + ' has no file to load');
    return null;
  }
};

Playlist.prototype._readLines = function (fileInput, resolve, reject) {
  const thisPlaylist = this;
  let remaining = '';
  let lineIndex = 0;

  fileInput.on('data', function (data) {
    remaining += data;
    let index = remaining.indexOf('\n');
    while (index > -1) {
      const line = remaining.substring(0, index);
      remaining = remaining.substring(index + 1);
      thisPlaylist._processLine(line, lineIndex);
      lineIndex++;
      index = remaining.indexOf('\n');
    }
  });

  fileInput.on('end', function () {
    if (remaining.length > 0) {
      thisPlaylist._processLine(remaining, lineIndex);
    }
    else {
      thisPlaylist._fileLoaded = true;
      thisPlaylist._songCount =
        (thisPlaylist._songsToPlay) ? thisPlaylist._songsToPlay.length : 0;
      if (thisPlaylist._songCount > 0) {
        thisPlaylist._buildRandomIndex();
        thisPlaylist._clearSongHistory();
      }
      /*console.log('Playlist ' + thisPlaylist.name +
                  ' song count is ' + thisPlaylist._songCount);*/
      resolve(thisPlaylist);
    }
  });

  fileInput.on('error', function (err) {
    thisPlaylist._fileLoaded = false;
    thisPlaylist._songsToPlay = null;
    thisPlaylist._songCount = 0;
    thisPlaylist._randomSongIndices = null;
    thisPlaylist._currentSongIdxIdx = null;
    thisPlaylist._currentSongIdx = null;
    thisPlaylist._currentSong = null;
    thisPlaylist._titleHistory = null;
    thisPlaylist._artistHistory = null;
    console.log('Failed to load ' + thisPlaylist._filePath + ' - ' + err);
    reject(err);
  });
};

Playlist.prototype._processLine = function (songFile, lineIndex) {
  console.log('Song file: ' + songFile);
  if (!this._songsToPlay) { this._songsToPlay = []; }
  const o = { file: songFile.replace(/\r/, '') };
  const index = songFile.lastIndexOf('/');
  if (index > -1) {
    const fileName = songFile.substring(index + 1)
      .replace(/.[A-Za-z0-9]+$/, '')
      .replace(/\r/, '');
    const fields = fileName.split('-');
    o.index = lineIndex;
    o.title = fields[0];
    o.artist = fields[1];
    o.album = fields[2];
    o.label = fields[3];
    o.year = fields[4];
  }
  this._songsToPlay.push(o);
};

Playlist.prototype._buildRandomIndex = function () {
  this._randomSongIndices = [];
  for (let i = 0; i < this._songCount; i++) {
    this._randomSongIndices.push(
      {
        randomIndex: Math.random(),
        songIndex: i
      });
  }
  this._randomSongIndices.sort(function compare (a, b) {
    if (a.randomIndex < b.randomIndex) { return -1; }
    else if (a.randomIndex > b.randomIndex) { return 1; }
    else { return 0; }
  });
  // console.log('this._randomIndices...');
  // console.log(this._randomIndices);
  this._currentSongIdxIdx = null;
  this._currentSongIdx = null;
  this._currentSong = null;
};

Playlist.prototype._getNextSong = function () {
  if ((!this._fileLoaded) || (!this._songsToPlay) || (!this._randomSongIndices)) {
    return null;
  }

  let nextSong;
  let isDuplicate;
  let retries = config.playlists.duplicateReplacementRetries;
  do {
    isDuplicate = false;
    if ((this._currentSongIdxIdx === null) ||
      (this._currentSongIdxIdx >= this._songCount - 1)) {
      this._currentSongIdxIdx = 0;
    }
    else { this._currentSongIdxIdx++; }
    console.log('this._currentSongIdxIdx = ' + this._currentSongIdxIdx);
    this._currentSongIdx =
      this._randomSongIndices[this._currentSongIdxIdx].songIndex;
    console.log('this._currentSongIdx = ' + this._currentSongIdx);
    nextSong = this._songsToPlay[this._currentSongIdx];
    // check if this new "current song" is redundant
    if (this.redundantTitleThreshold > 0) {
      let idx, ch, nextTitle = nextSong.title;
      if (this._partialTitleDelimiters) {
        for (let i = 0; i < this._partialTitleDelimiters.length; i++) {
          ch = this._partialTitleDelimiters.charAt(i);
          if (/\s/.test(ch)) { continue; }
          idx = nextTitle.indexOf(ch);
          if (idx > -1) {
            nextTitle = nextTitle.substring(0, idx).trim();
          }
        }
      }
      nextTitle = nextTitle.toLowerCase();
      for (let i = 0; i < this._titleHistory.length; i++) {
        let recentTitle = this._titleHistory[i];
        if (this._partialTitleDelimiters) {
          for (let j = 0; j < this._partialTitleDelimiters.length; j++) {
            ch = this._partialTitleDelimiters.charAt(j);
            if (/\s/.test(ch)) { continue; }
            idx = recentTitle.indexOf(ch);
            if (idx > -1) {
              recentTitle = recentTitle.substring(0, idx).trim();
            }
          }
        }
        console.log('Comparing ' + recentTitle.toLowerCase() + ' to ' + nextTitle);
        if (recentTitle.toLowerCase() === nextTitle) {
          isDuplicate = true;
          console.log(nextTitle + ' is a duplicate title');
          break;
        }
      }
    }
    if ((!isDuplicate) && (this.redundantArtistThreshold > 0)) {
      for (let i = 0; i < this._artistHistory.length; i++) {
        if (this._artistHistory[i] === nextSong.artist) {
          isDuplicate = true;
          console.log(nextSong.artist + ' is a duplicate artist');
          break;
        }
      }
    }
    if (isDuplicate) {
      const randomIndexEntry = this._randomSongIndices[this._currentSongIdxIdx];
      // console.log('randomIndexEntry...');
      // console.log(randomIndexEntry);
      // console.log('this._randomSongIndices...');
      // console.log(this._randomSongIndices);
      let newIndex;
      if (this._currentSongIdxIdx > this._songCount / 2) {
        // duplicate is in 2nd half of list,
        // move it back towards the front
        this._randomSongIndices.splice(this._currentSongIdxIdx, 1);
        newIndex =
          this._currentSongIdxIdx - Math.floor(this._songCount * 3 / 7);
        console.log('Moving entry from ' +
          this._currentSongIdxIdx + ' to ' + newIndex);
        this._randomSongIndices.splice(newIndex, 0, randomIndexEntry);
        //console.log('this._randomSongIndices...');
        //console.log(this._randomSongIndices);

        // on next iteration, this._currentSongIdxIdx will get
        // incremented and point happily at the next entry in the list
      }
      else {
        // duplicate is in 1st half of list,
        // move it forward towards the end
        this._randomSongIndices.splice(this._currentSongIdxIdx, 1);
        newIndex =
          this._currentSongIdxIdx + Math.floor(this._songCount * 3 / 7);
        console.log('Moving entry from ' +
          this._currentSongIdxIdx + ' to ' + newIndex);
        this._randomSongIndices.splice(newIndex, 0, randomIndexEntry);
        //console.log('this._randomSongIndices...');
        //console.log(this._randomSongIndices);

        // on next iteration, this._currentSongIdxIdx needs to
        // stay pointed at this index (where the next entry will
        // now reside), so it needs to be decremented now in order
        // to cancel out the increment of the next iteration
        this._currentSongIdxIdx--;
      }
      // throw it back for another
      console.log(`Try again for a non-duplicate - retry ${config.playlists.duplicateReplacementRetries + 1 - retries}`);
    }
    retries--;
  }
  while (isDuplicate && (retries > 0));
  if (retries === 0) {
    console.log(`Giving up after ${config.playlists.duplicateReplacementRetries} tries, just use the duplicate song`);
  }

  this._currentSong = nextSong;

  this._updateSongHistory(this._currentSong, this._currentSongIdx);

  console.log('this._currentSong - ' + this._currentSong.title);
  return this._getCurrentSong();
};

Playlist.prototype._getCurrentSong = function () {
  return { index: this._currentSongIdx, song: this._currentSong };
};

Playlist.prototype._getSongHistory = function () {
  return this._songHistory;
};

Playlist.prototype._updateSongHistory = function (song, index) {
  // save this song info into history
  if (song) {

    this._songHistory.unshift({ index: index, song: song, timestamp: Date.now() });
    if (this._songHistory.length > config.playlists.songHistoryLimit) {
      this._songHistory = this._songHistory.slice(0, config.playlists.songHistoryLimit);
    }
    /* console.log('Song history...');
    var songHistoryString = '';
    for (var i = 0; i < this._songHistory.length; i++)
    {
        songHistoryString += '(' + this._songHistory[i].title + ') ';
    }
    console.log(songHistoryString); */

    if (song.title) {
      this._titleHistory.unshift(song.title);
      if (this.redundantTitleThreshold && (this._titleHistory.length > this.redundantTitleThreshold)) {
        this._titleHistory = this._titleHistory.slice(0, this.redundantTitleThreshold);
      }
    }
    /* console.log('Title history...');
    var titleHistoryString = '';
    for (var i = 0; i < this._titleHistory.length; i++)
    {
        titleHistoryString += '(' + this._titleHistory[i] + ') ';
    }
    console.log(titleHistoryString); */

    if (song.artist) {
      this._artistHistory.unshift(song.artist);
      if (this.redundantArtistThreshold && (this._artistHistory.length > this.redundantArtistThreshold)) {
        this._artistHistory = this._artistHistory.slice(0, this.redundantArtistThreshold);
      }
    }
    /* console.log('Artist history...');
    var artistHistoryString = '';
    for (var i = 0; i < this._artistHistory.length; i++)
    {
        artistHistoryString += '(' + this._artistHistory[i] + ') ';
    }
    console.log(artistHistoryString); */
  }
};

Playlist.prototype._clearSongHistory = function () {
  this._songHistory = []; // start with empty array for history
  this._titleHistory = []; // start with empty array for history
  this._artistHistory = []; // start with empty array for history
  console.log('History cleared');
};

module.exports = Playlist;
