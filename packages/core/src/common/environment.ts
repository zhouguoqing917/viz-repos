export function isElectron(): boolean {
    // Renderer process
    if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
        return true;
    }

    // Main process
    if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!process.versions.electron) {
        return true;
    }

    // Detect the user agent when the `nodeIntegration` option is set to false
    if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
        return true;
    }

    return false;
}

export function isWindows():boolean {
    return process && (process.platform === 'win32' || /^(msys|cygwin)$/.test(process.env.OSTYPE||'')); 
}

/**
 * The electron specific environment.
 */
class ElectronEnv {

    /**
     * `true` if running in electron. Otherwise, `false`.
     *
     * Can be called from both the `main` and the render process. Also works for forked cluster workers.
     */
    is(): boolean {
        // When forking a new process from the cluster, we can rely neither on `process.versions` nor `process.argv`.
        // Se we look into the `process.env` as well. `is-electron` does not do it for us.
        return isElectron() || typeof process !== 'undefined' && typeof process.env === 'object' ;
    }

    /**
     * `true` if running in Electron in development mode. Otherwise, `false`.
     *
     * Cannot be used from the browser. From the browser, it is always `false`.
     */
    isDevMode(): boolean {
        return this.is()
            && typeof process !== 'undefined'
            // `defaultApp` does not exist on the Node.js API, but on electron (`electron.d.ts`).
            && ((process as any).defaultApp || /node_modules[/]electron[/]/.test(process.execPath)); // eslint-disable-line @typescript-eslint/no-explicit-any
    } 
 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runAsNodeEnv(env?: any): any & { ELECTRON_RUN_AS_NODE: 1 } {
        if (typeof process === 'undefined') {
            throw new Error("'process' cannot be undefined.");
        }
        return {
            ...(env === undefined ? process.env : env),
            ELECTRON_RUN_AS_NODE: 1
        };
    }

}

const electron = new ElectronEnv();
const environment: Readonly<{ electron: ElectronEnv }> = { electron };
export { environment };
export default { environment };