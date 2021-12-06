
const Service = require('node-windows').Service;

const { serviceConfig } = require('./windows-service-config');

// Create a new service object
const svc = new Service(serviceConfig);

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', () => {
  svc.start();
});

svc.install();
