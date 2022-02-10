import { injectable } from 'inversify';
import { JsonRpcServer } from './messaging/proxy-factory';

export const ILoggerServer = Symbol('ILoggerServer');

export const loggerPath = '/services/logger';

export interface ILoggerServer extends JsonRpcServer<ILoggerClient> {
    setLogLevel(name: string, logLevel: number): Promise<void>;
    getLogLevel(name: string): Promise<number>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log(name: string, logLevel: number, message: any, params: any[]): Promise<void>;
    child(name: string): Promise<void>;
}

export const ILoggerClient = Symbol('ILoggerClient');

export interface ILogLevelChangedEvent {
    loggerName: string;
    newLogLevel: number;
}

export interface ILoggerClient {
    onLogLevelChanged(event: ILogLevelChangedEvent): void;
}

@injectable()
export class DispatchingLoggerClient implements ILoggerClient {

    readonly clients = new Set<ILoggerClient>();

    onLogLevelChanged(event: ILogLevelChangedEvent): void {
        this.clients.forEach(client => client.onLogLevelChanged(event));
    }

}

export const rootLoggerName = 'root';

export enum LogLevel {
    FATAL = 60,
    ERROR = 50,
    WARN = 40,
    INFO = 30,
    DEBUG = 20,
    TRACE = 10
}
export namespace LogLevel {
    export const strings = new Map<LogLevel, string>([
        [LogLevel.FATAL, 'fatal'],
        [LogLevel.ERROR, 'error'],
        [LogLevel.WARN, 'warn'],
        [LogLevel.INFO, 'info'],
        [LogLevel.DEBUG, 'debug'],
        [LogLevel.TRACE, 'trace']
    ]);

    export function toString(level: LogLevel): string | undefined {
        return strings.get(level);
    }

    export function fromString(levelStr: string): LogLevel | undefined {
        for (const pair of strings) {
            if (pair[1] === levelStr) {
                return pair[0];
            }
        }

        return undefined;
    }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export namespace ConsoleLogger {
    type Console = (message?: any, ...optionalParams: any[]) => void;
    const originalConsoleLog = console.log;
    const consoles = new Map<LogLevel, Console>([
        [LogLevel.FATAL, console.error],
        [LogLevel.ERROR, console.error],
        [LogLevel.WARN, console.warn],
        [LogLevel.INFO, console.info],
        [LogLevel.DEBUG, console.debug],
        [LogLevel.TRACE, console.trace]
    ]);
    export function reset(): void {
        console.error = consoles.get(LogLevel.ERROR)!;
        console.warn = consoles.get(LogLevel.WARN)!;
        console.info = consoles.get(LogLevel.INFO)!;
        console.debug = consoles.get(LogLevel.DEBUG)!;
        console.trace = consoles.get(LogLevel.TRACE)!;
        console.log = originalConsoleLog;
    }
    export function log(name: string, logLevel: number, message: string, params: any[]): void {
        const console = consoles.get(logLevel) || originalConsoleLog;
        const severity = (LogLevel.strings.get(logLevel) || 'unknown').toUpperCase();
        console(`${name} ${severity} ${message}`, ...params);
    }
}
