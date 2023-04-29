
const rsyslog = require('node-rsyslog');

const options = {
  host: '192.168.0.245',
  appname: 'playgen',
  method: 'TCP',
};
const { WARNING } = rsyslog.SEVERITY;
const logger = new rsyslog.RSyslog(options);

logger.send(WARNING, 'Playgen test');
logger.disconnect();
