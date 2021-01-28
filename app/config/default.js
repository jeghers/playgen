module.exports = {
  session: {
    port: 3000,
    secure: false, // use this later?
  },
  db: {
    host: 'localhost',
    user: 'some_user',
    password: 'some_password',
    database: 'some_db_schema',
    reconnectTime: 1000,
  },
  playlists: {
    songHistoryLimit: 500,
    duplicateReplacementRetries: 10,
  },
  log: 'info', // use this later
};
