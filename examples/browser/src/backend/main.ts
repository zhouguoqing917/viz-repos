const { BackendApplicationConfigProvider } = require('@viz/core/lib/node/backend-application-config-provider');
const main = require('@viz/core/lib/node/main');

BackendApplicationConfigProvider.set({
    "singleInstance": false
});

const serverModule = require('./server');
const serverAddress = main.start(serverModule());

serverAddress.then(({ port, address }) => {
    if (process && process.send) {
        process.send({ port, address });
    }
});

module.exports = serverAddress;