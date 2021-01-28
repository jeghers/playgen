
/* eslint-disable max-params */
module.exports = {
  handleError: (res, status, error, message) => {
    console.log('****** handleError');
    console.log(message);
    res.status(status);
    res.json({ status: error, message: message });
  },
  watchPromise: p => {
    if (p) {
      p.then((responsePlaylist) => {
        console.log('Playlist ' + responsePlaylist.name + ' loaded ' +
          responsePlaylist.count() + ' songs successfully');
        console.log('Playlist...');
        console.log(responsePlaylist);
      }, (error) => {
        console.error('Promise failed.', error);
      });
    }
  },
};
