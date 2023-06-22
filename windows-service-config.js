
const serviceConfig = {
  name: 'Playgen',
  description: 'Playgen random 24/7 playlist generator',
  // you will need to change this script path
  script: 'D:\\src\\playgen\\server.js',
  nodeOptions: [],
  env: [
    {
      name: 'IS_WINDOWS_SERVICE',
      value: 'true'
    },
    // uncomment the 'NODE_ENV' entry to run in production mode
    /* {
      name: 'NODE_ENV',
      value: 'production', // or 'development'
    }, */
  ],
  abortOnError: false, // change this if you are paranoid
  maxRetries: 5,
  maxRestarts: 5,
  wait: 2,
  grow: .5,
  //, workingDirectory: '...'
  //, allowServiceLogon: true
};

module.exports = {
  serviceConfig,
};
