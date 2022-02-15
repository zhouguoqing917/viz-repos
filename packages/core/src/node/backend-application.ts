import * as path from 'path';
import * as http from 'http';
import * as https from 'https'; 
import * as yargs from 'yargs';
import * as fs from 'fs-extra';
import { inject, injectable, named, postConstruct } from 'inversify';
import { ContributionProvider, ILogger, MaybePromise } from '../common';
import { CliContribution } from './cli';
import { Deferred } from '../common/promise-util';
import { environment } from '../common/index';
import { AddressInfo } from 'net'; 
import { ProcessUtils } from './process-utils';
import express from 'express';
import { ApplicationPackage } from '@viz/application-package';


 
export const BackendApplicationContribution = Symbol('BackendApplicationContribution');
export interface BackendApplicationContribution {
    initialize?(): MaybePromise<void>;
    configure?(app: express.Application): MaybePromise<void>;
    onStart?(server: http.Server | https.Server): MaybePromise<void>;

    /**
     * Called when the backend application shuts down. Contributions must perform only synchronous operations.
     * Any kind of additional asynchronous work queued in the event loop will be ignored and abandoned.
     */
    onStop?(app?: express.Application): void;
}

export const BackendApplicationServer = Symbol('BackendApplicationServer');
export interface BackendApplicationServer extends BackendApplicationContribution { }

const defaultPort = environment.electron.is() ? 0 : 3000;
const defaultHost = 'localhost';
const defaultSSL = false;

const appProjectPath = 'app-project-path';

@injectable()
export class BackendApplicationCliContribution implements CliContribution {

    port: number;
    hostname: string | undefined;
    ssl: boolean | undefined;
    cert: string | undefined;
    certkey: string | undefined;
    projectPath: string;

    configure(conf: yargs.Argv): void {
        conf.option('port', { alias: 'p', description: 'The port the backend server listens on.', type: 'number', default: defaultPort });
        conf.option('hostname', { alias: 'h', description: 'The allowed hostname for connections.', type: 'string', default: defaultHost });
        conf.option('ssl', { description: 'Use SSL (HTTPS), cert and certkey must also be set', type: 'boolean', default: defaultSSL });
        conf.option('cert', { description: 'Path to SSL certificate.', type: 'string' });
        conf.option('certkey', { description: 'Path to SSL certificate key.', type: 'string' });
        conf.option(appProjectPath, { description: 'Sets the application project directory', default: this.appProjectPath() });
    }

    setArguments(args: yargs.Arguments): void {
        this.port = args.port;
        this.hostname = args.hostname;
        this.ssl = args.ssl;
        this.cert = args.cert;
        this.certkey = args.certkey;
        this.projectPath = args[appProjectPath];
    }

    protected appProjectPath(): string {
        if (environment.electron.is()) {
            if (process.env.APP_PROJECT_PATH) {
                return process.env.APP_PROJECT_PATH;
            }
            throw new Error('The \'APP_PROJECT_PATH\' environment variable must be set when running in electron.');
        }
        return process.cwd();
    }

}

/**
 * The main entry point for Theia applications.
 */
@injectable()
export class BackendApplication {

    protected readonly app: express.Application = express();

    @inject(ApplicationPackage)
    protected readonly applicationPackage: ApplicationPackage;

    @inject(ProcessUtils)
    protected readonly processUtils: ProcessUtils;
 
    constructor(
        @inject(ContributionProvider) @named(BackendApplicationContribution)
        protected readonly contributionsProvider: ContributionProvider<BackendApplicationContribution>,
        @inject(BackendApplicationCliContribution) protected readonly cliParams: BackendApplicationCliContribution,
        @inject(ILogger) protected readonly logger: ILogger
    ) {
        process.on('uncaughtException', error => {
            if (error) {
                logger.error('Uncaught Exception: ', error.toString());
                if (error.stack) {
                    logger.error(error.stack);
                }
            }
        });

        process.on('SIGPIPE', () => {
            console.error(new Error('Unexpected SIGPIPE'));
        });
         /**
         * Kill the current process tree on exit.
         */
        function signalHandler(signal: NodeJS.Signals): never {
            process.exit(1);
        }

        // Handles normal process termination.
        process.on('exit', () => this.onStop());
        // Handles `Ctrl+C`.
        process.on('SIGINT', () => signalHandler);
        // Handles `kill pid`.
        process.on('SIGTERM', () => signalHandler);

        this.initialize();
    }

    protected async initialize(): Promise<void> {
        for (const contribution of this.contributionsProvider.getContributions()) {
            if (contribution.initialize) {
                try {
                    await this.measure(contribution.constructor.name + '.initialize',
                        () => contribution.initialize!()
                    );
                } catch (error) {
                    console.error('Could not initialize contribution', error);
                }
            }
        }
    }

    @postConstruct()
    protected async init(): Promise<void> {
        this.app.get('*.js', this.serveGzipped.bind(this, 'text/javascript'));
        this.app.get('*.js.map', this.serveGzipped.bind(this, 'application/json'));
        this.app.get('*.css', this.serveGzipped.bind(this, 'text/css'));
        this.app.get('*.wasm', this.serveGzipped.bind(this, 'application/wasm'));
        this.app.get('*.gif', this.serveGzipped.bind(this, 'image/gif'));
        this.app.get('*.png', this.serveGzipped.bind(this, 'image/png'));
        this.app.get('*.svg', this.serveGzipped.bind(this, 'image/svg+xml'));

        for (const contribution of this.contributionsProvider.getContributions()) {
            if (contribution.configure) {
                try {
               
                 await this.measure(contribution.constructor.name + '.configure',
                    () => contribution.configure!(this.app)
                  );
                } catch (error) {
                    this.logger.error('Could not configure contribution', error);
                }
            }
        }
    }

    use(...handlers: express.Handler[]): void {
        this.app.use(...handlers);
    }

    async start(aPort?: number, aHostname?: string): Promise<http.Server | https.Server> {
        const hostname = aHostname !== undefined ? aHostname : this.cliParams.hostname;
        const port = aPort !== undefined ? aPort : this.cliParams.port;

        const deferred = new Deferred<http.Server | https.Server>();
        let server: http.Server | https.Server;

        if (this.cliParams.ssl) {

            if (this.cliParams.cert === undefined) {
                throw new Error('Missing --cert option, see --help for usage');
            }

            if (this.cliParams.certkey === undefined) {
                throw new Error('Missing --certkey option, see --help for usage');
            }

            let key: Buffer;
            let cert: Buffer;
            try {
                key = await fs.readFile(this.cliParams.certkey as string);
            } catch (err) {
                await this.logger.error("Can't read certificate key");
                throw err;
            }

            try {
                cert = await fs.readFile(this.cliParams.cert as string);
            } catch (err) {
                await this.logger.error("Can't read certificate");
                throw err;
            }
            server = https.createServer({ key, cert }, this.app);
        } else {
            server = http.createServer(this.app);
        }

        server.on('error', error => {
            deferred.reject(error);
            /* The backend might run in a separate process,
             * so we defer `process.exit` to let time for logging in the parent process */
            setTimeout(process.exit, 0, 1);
        });

        server.listen(port, hostname, () => {
            const scheme = this.cliParams.ssl ? 'https' : 'http';
            this.logger.info(`backend app listening on ${scheme}://${hostname || 'localhost'}:${(server.address() as AddressInfo).port}.`);
            deferred.resolve(server);
        });

        /* Allow any number of websocket servers.  */
        server.setMaxListeners(0);

        for (const contrib of this.contributionsProvider.getContributions()) {
            if (contrib.onStart) {
                try {
                    await contrib.onStart(server);
                } catch (error) {
                    this.logger.error('Could not start contribution', error);
                }
            }
        }
        return deferred.promise;
    }
 
    protected onStop(): void {
        console.info('>>> Stopping backend contributions...');
        for (const contrib of this.contributionsProvider.getContributions()) {
            if (contrib.onStop) {
                try {
                    contrib.onStop(this.app);
                } catch (error) {
                    console.error('Could not stop contribution', error);
                }
            }
        }
        console.info('<<< All backend contributions have been stopped.'); 
        this.processUtils.terminateProcessTree(process.pid);
    }

    protected appProjectPath(): string {
        if (environment.electron.is()) {
            if (process.env.APP_PROJECT_PATH) {
                return process.env.APP_PROJECT_PATH;
            } 
        }
        return process.cwd();
    }

    protected async serveGzipped(contentType: string, req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        const acceptedEncodings = req.acceptsEncodings();

        const gzUrl = `${req.url}.gz`;
        const gzPath = path.join(this.appProjectPath(), 'lib', gzUrl);
        if (acceptedEncodings.indexOf('gzip') === -1 || !(await fs.pathExists(gzPath))) {
            next();
            return;
        }

        req.url = gzUrl;

        res.set('Content-Encoding', 'gzip');
        res.set('Content-Type', contentType);

        next();
    }

    protected async measure<T>(name: string, fn: () => MaybePromise<T>): Promise<T> {
        const startMark = name + '-start';
        const endMark = name + '-end';
        performance.mark(startMark);
        const result = await fn();
        performance.mark(endMark);
        performance.measure(name, startMark, endMark);
        // Observer should immediately log the measurement, so we can clear it
        performance.clearMarks(name);
        return result;
    }

}
