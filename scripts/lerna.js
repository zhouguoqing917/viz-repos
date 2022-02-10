 
const path = require('path'); 
const lernaPath = path.resolve(__dirname, '..', 'node_modules', 'lerna', 'bin', 'lerna');

if (process.argv.indexOf('--reject-cycles') === -1) {
    process.argv.push('--reject-cycles');
}
require(lernaPath);
