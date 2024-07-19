const http = require('http');
const httpStatus = require('http-status-codes');

const options = {
    host: 'localhost',
    port: '3000',
    path: '/api/v1/healthcheck',
    timeout: 5000,
};

const request = http.request(options, res => {
    console.log(`STATUS: ${res.statusCode}`);
    if (res.statusCode === httpStatus.OK) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

request.on('error', () => {
    console.log('ERROR');
    process.exit(1);
});

request.end();
