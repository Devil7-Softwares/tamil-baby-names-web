const Module = require('module');
const { join } = require('path');

// The host installs from the deployed package.json, and its node_modules does
// not survive a `file:` dependency, so point @tbn/shared at the copy shipped
// beside this file instead of leaving it to the package manager.
const sharedDir = join(__dirname, 'vendor', 'shared');
const resolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, ...args) {
    if (request === '@tbn/shared') {
        return resolveFilename.call(this, sharedDir, ...args);
    }

    if (request.startsWith('@tbn/shared/')) {
        return resolveFilename.call(
            this,
            join(sharedDir, request.slice('@tbn/shared/'.length)),
            ...args,
        );
    }

    return resolveFilename.call(this, request, ...args);
};

require('./main.js');
