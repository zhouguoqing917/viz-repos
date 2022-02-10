

import * as fs from 'fs-extra';
import * as path from 'path';
import * as cp from 'child_process';
import { ApplicationPackage, ApplicationPackageOptions } from "./application-package"; 
import { ApplicationProcess } from './application-process';

export class ApplicationPackageManager {

    readonly pck: ApplicationPackage;
    readonly process: ApplicationProcess;
    protected readonly __process: ApplicationProcess;
 

    constructor(options: ApplicationPackageOptions) {
        this.pck = new ApplicationPackage(options);
        this.process = new ApplicationProcess(this.pck, options.projectPath); 
        this.__process = new ApplicationProcess(this.pck, path.join(__dirname, '..'));
     
    }

    protected async remove(path: string): Promise<void> {
        if (await fs.pathExists(path)) {
            await fs.remove(path);
        }
    }

    async clean(): Promise<void> {
        await this.remove(this.pck.lib());
    }


    async copy(): Promise<void> {
        await fs.ensureDir(this.pck.lib());
        await fs.copy(this.pck.frontend('index.html'), this.pck.lib('index.html'));
    }

    async build(args: string[] = []): Promise<void> {
        await this.copy();
        return this.__process.run('webpack', args);
    }

    start(args: string[] = []): cp.ChildProcess {
        if (this.pck.isElectron()) {
            return this.startElectron(args);
        }
        return this.startBrowser(args);
    } 

    startElectron(args: string[]): cp.ChildProcess {
        const { mainArgs, options } = this.adjustArgs([this.pck.frontend('electron-main.js'), ...args]);
        const electronCli = require.resolve('electron/cli.js', { paths: [this.pck.projectPath] });
        return this.__process.fork(electronCli, mainArgs, options);
    }

    startBrowser(args: string[]): cp.ChildProcess {
        const { mainArgs, options } = this.adjustArgs(args);
        return this.__process.fork(this.pck.backend('main.js'), mainArgs, options);
    }

    private adjustArgs(args: string[], forkOptions: cp.ForkOptions = {}): Readonly<{ mainArgs: string[]; options: cp.ForkOptions }> {
        const options = {
            ...this.forkOptions,
            forkOptions
        };
        const mainArgs = [...args];
        const inspectIndex = mainArgs.findIndex(v => v.startsWith('--inspect'));
        if (inspectIndex !== -1) {
            const inspectArg = mainArgs.splice(inspectIndex, 1)[0];
            options.execArgv = ['--nolazy', inspectArg];
        }
        return {
            mainArgs,
            options
        };
    }

    private get forkOptions(): cp.ForkOptions {
        return {
            stdio: [0, 1, 2, 'ipc'],
            env: {
                ...process.env,
                VIZ_PARENT_PID: String(process.pid)
            }
        };
    }

}
