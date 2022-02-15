/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
import { Container, ContainerModule, interfaces } from 'inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '../common/messaging';
import { ILogger, Logger, LoggerFactory, LoggerName, rootLoggerName, setRootLogger } from '../common/logger';
import { DispatchingLoggerClient, ILoggerClient, ILoggerServer, loggerPath } from '../common/logger-protocol';
import { ConsoleLoggerServer } from './console-logger-server';
import { LoggerWatcher } from '../common/logger-watcher';
import { BackendApplicationContribution } from './backend-application';
import { CliContribution } from './cli';
import { LogLevelCliContribution } from './logger-cli-contribution';

export function bindLogger(bind: interfaces.Bind, props?: {
    onLoggerServerActivation?: (context: interfaces.Context, server: ILoggerServer) => void
}): void {
    bind(LoggerName).toConstantValue(rootLoggerName);
    bind(ILogger).to(Logger).inSingletonScope().whenTargetIsDefault();
    bind(LoggerWatcher).toSelf().inSingletonScope();
    bind<ILoggerServer>(ILoggerServer).to(ConsoleLoggerServer).inSingletonScope().onActivation((context, server) => {
        if (props && props.onLoggerServerActivation) {
            props.onLoggerServerActivation(context, server);
        }
        return server;
    });
    bind(LogLevelCliContribution).toSelf().inSingletonScope();
    bind(CliContribution).toService(LogLevelCliContribution);
    bind(LoggerFactory).toFactory(ctx =>
        (name: string) => {
            const child = new Container({ defaultScope: 'Singleton' });
            child.parent = ctx.container;
            child.bind(ILogger).to(Logger).inTransientScope();
            child.bind(LoggerName).toConstantValue(name);
            return child.get(ILogger);
        }
    );
}

/**
 * IMPORTANT: don't use in tests, since it overrides console
 */
export const loggerBackendModule = new ContainerModule(bind => {
    bind(BackendApplicationContribution).toDynamicValue(ctx =>
        ({
            initialize(): void {
                setRootLogger(ctx.container.get<ILogger>(ILogger));
            }
        }));

    bind(DispatchingLoggerClient).toSelf().inSingletonScope();
    bindLogger(bind, {
        onLoggerServerActivation: ({ container }, server) => {
            server.setClient(container.get(DispatchingLoggerClient));
            server.setClient = () => {
                throw new Error('use DispatchingLoggerClient');
            };
        }
    });

    bind(ConnectionHandler).toDynamicValue(({ container }) =>
        new JsonRpcConnectionHandler<ILoggerClient>(loggerPath, client => {
            const dispatching = container.get(DispatchingLoggerClient);
            dispatching.clients.add(client);
            client.onDidCloseConnection(() => dispatching.clients.delete(client));
            return container.get<ILoggerServer>(ILoggerServer);
        })
    ).inSingletonScope();
});
