
/* eslint-disable no-empty-function */
const initPlugin = () => {}; // nothing needed

const extract = songFilePath => {
  const index = songFilePath.lastIndexOf('/');
  if (index > -1) {
    const fileName = songFilePath.substring(index + 1)
      .replace(/.[A-Za-z0-9]+$/, '');
    const fields = fileName.split('-');
    return {
      title: fields[0],
      artist: fields[1],
      album: fields[2],
      label: fields[3],
      year: fields[4],
      detailsLoaded: true,
    };
  }
  return { title: songFilePath }; // bad but no other choice
};

module.exports = { initPlugin, extract };
