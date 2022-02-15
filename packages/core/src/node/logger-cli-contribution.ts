
import * as yargs from 'yargs';
import { injectable } from 'inversify';
import { LogLevel } from '../common/logger';
import { CliContribution } from './cli';
import * as fs from 'fs-extra';
import nsfw from 'nsfw';
import { Emitter, Event } from '../common/event';
import * as path from 'path';
 

/** Maps logger names to log levels.  */
export interface LogLevels {
    [key: string]: LogLevel,
}

/**
 * Parses command line switches related to log levels, then watches the log
 * levels file (if specified) for changes.  This is the source of truth for
 * what the log level per logger should be.
 */
@injectable()
export class LogLevelCliContribution implements CliContribution {

    protected _logLevels: LogLevels = {};

    /**
     * Log level to use for loggers not specified in `logLevels`.
     */
    protected _defaultLogLevel: LogLevel = LogLevel.INFO;

    protected logConfigChangedEvent: Emitter<void> = new Emitter<void>();

    get defaultLogLevel(): LogLevel {
        return this._defaultLogLevel;
    }

    get logLevels(): LogLevels {
        return this._logLevels;
    }

    configure(conf: yargs.Argv): void {
        conf.option('log-level', {
            description: 'Sets the default log level',
            choices: Array.from(LogLevel.strings.values()),
            nargs: 1,
        });

        conf.option('log-config', {
            description: 'Path to the JSON file specifying the configuration of various loggers',
            type: 'string',
            nargs: 1,
        });
    }

    async setArguments(args: yargs.Arguments): Promise<void> {
        if (args['log-level'] !== undefined && args['log-config'] !== undefined) {
            throw new Error('--log-level and --log-config are mutually exclusive.');
        }

        if (args['log-level'] !== undefined) {
            this._defaultLogLevel = this.readLogLevelString(args['log-level'], 'Unknown log level passed to --log-level');
        }

        if (args['log-config'] !== undefined) {
            let filename = args['log-config'];
            try {
                filename = path.resolve(filename);

                await this.slurpLogConfigFile(filename);
                await this.watchLogConfigFile(filename);
            } catch (e) {
                console.error(`Error reading log config file ${filename}: ${e}`);
            }
        }
    }

    protected watchLogConfigFile(filename: string): Promise<void> {
        return nsfw(filename, async (events: nsfw.FileChangeEvent[]) => {
            try {
                for (const event of events) {
                    switch (event.action) {
                        case nsfw.actions.CREATED:
                        case nsfw.actions.MODIFIED:
                            await this.slurpLogConfigFile(filename);
                            this.logConfigChangedEvent.fire(undefined);
                            break;
                    }
                }
            } catch (e) {
                console.error(`Error reading log config file ${filename}: ${e}`);
            }
        }).then((watcher: nsfw.NSFW) => {
            watcher.start();
        });
    }

    protected async slurpLogConfigFile(filename: string): Promise<void> {
        try {
            const content = await fs.readFile(filename, 'utf-8');
            const data = JSON.parse(content);

            let newDefaultLogLevel: LogLevel = LogLevel.INFO;

            if ('defaultLevel' in data) {
                newDefaultLogLevel = this.readLogLevelString(data['defaultLevel'], `Unknown default log level in ${filename}`);
            }

            const newLogLevels: { [key: string]: LogLevel } = {};

            if ('levels' in data) {
                const loggers = data['levels'];
                for (const logger of Object.keys(loggers)) {
                    const levelStr = loggers[logger];
                    newLogLevels[logger] = this.readLogLevelString(levelStr, `Unknown log level for logger ${logger} in ${filename}`);
                }
            }

            this._defaultLogLevel = newDefaultLogLevel;
            this._logLevels = newLogLevels;

            console.log(`Successfully read new log config from ${filename}.`);
        } catch (e) {
            throw new Error(`Error reading log config file ${filename}: ${e.message}`);
        }
    }

    get onLogConfigChanged(): Event<void> {
        return this.logConfigChangedEvent.event;
    }

    logLevelFor(loggerName: string): LogLevel {
        const level = this._logLevels[loggerName];

        if (level !== undefined) {
            return level;
        } else {
            return this.defaultLogLevel;
        }
    }

    /**
     * Converts the string to a `LogLevel`. Throws an error if invalid.
     */
    protected readLogLevelString(levelStr: string, errMessagePrefix: string): LogLevel {
        const level = LogLevel.fromString(levelStr);

        if (level === undefined) {
            throw new Error(`${errMessagePrefix}: "${levelStr}".`);
        }

        return level;
    }
}
