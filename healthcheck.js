var http = require('http');

var options = {
    host: 'localhost',
    port: '3000',
    path: '/api/v1/healthcheck',
    timeout: 5000,
};

var request = http.request(options, res => {
    console.log(`STATUS: ${res.statusCode}`);
    if (res.statusCode == 200) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

request.on('error', err => {
    console.log('ERROR');
    process.exit(1);
});

request.end();

