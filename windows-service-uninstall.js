
const Service = require('node-windows').Service;

const { serviceConfig } = require('./windows-service-config');

// Create a new service object
const svc = new Service(serviceConfig);

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall',function(){
  console.log('Uninstall complete.');
  console.log(`The service exists: ${svc.exists}`);
});

// Uninstall the service.
svc.uninstall();
