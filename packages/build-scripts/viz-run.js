#!/usr/bin/env node

const path = require('path');

// See: https://github.com/eclipse-theia/theia/issues/8779#issuecomment-733747340
const filter = require('os').platform() === 'win32'
    ? arg => arg.indexOf(path.join('build-scripts', 'viz-run.js')) !== -1
    : arg => arg.indexOf(path.join('.bin', 'run')) !== -1
let index = process.argv.findIndex(filter);
if (index === -1) {
    // Fall back to the original logic.
    // https://github.com/eclipse-theia/theia/blob/6ef08676314a2ceca93023ddd149579493ae7914/dev-packages/ext-scripts/theia-run.js#L21
    index = process.argv.findIndex(arg => arg.indexOf('run') !== -1);
}
const args = process.argv.slice(index + 1);
const scopedArgs = args.length > 1 ? [args[0], '--scope', ...args.slice(1)] : args;
process.argv = [...process.argv.slice(0, index + 1), 'run', ...scopedArgs];

require(path.resolve(__dirname, '..', '..', 'scripts', 'lerna'));
