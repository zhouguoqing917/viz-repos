#!/usr/bin/env node
'use-strict';

// @ts-check

const fs = require('fs');
const path = require('path');

async function main() {
    const electronCodecTestLogPath = path.resolve('post-install.log');
    if (fs.existsSync(electronCodecTestLogPath)) {
        console.log('electron last logs:');
        console.log(fs.readFileSync(electronCodecTestLogPath, { encoding: 'utf8' }).trimRight());
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
