module.exports = {
  session: {
    port: 3000,
    secure: false, // use this later?
  },
  db: {
    host: 'localhost',
    user: 'dbuser',
    password: 'dbpassword',
    database: 'MyDatabase',
    reconnectTime: 1000,
  },
  playlists: {
    songHistoryLimit: 40,
    duplicateReplacementRetries: 10,
  },
  log: "info", // use this later
};
