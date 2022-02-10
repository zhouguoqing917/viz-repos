 
'use-strict'; 
const cp = require('child_process'); 
/** @type {LernaPackage[]} */
const LERNA_SORT = JSON.parse(cp.execSync('yarn --silent lerna ls --sort --json').toString());

/** @type {{ [key: string]: YarnWorkspace  }} */
const YARN_WORKSPACES = JSON.parse(cp.execSync('yarn --silent workspaces info').toString());

// reverse topology order
LERNA_SORT.reverse();

for (const package of LERNA_SORT) {
    const workspace = YARN_WORKSPACES[package.name];
    const command = process.argv[2];
    const args = process.argv.slice(3).map(arg => arg.replace(/__PACKAGE__/g, package.name));
    console.log(`${package.name}: $ ${command} ${args.join(' ')}`);
    cp.spawnSync(command, args, {
        stdio: ['ignore', 'ignore', 'inherit'],
        cwd: workspace.location,
    });
}

/**
 * @typedef LernaPackage
 * @property {string} name
 */

/**
 * @typedef YarnWorkspace
 * @property {string} location
 */
