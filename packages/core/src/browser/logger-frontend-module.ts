/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { Container, ContainerModule } from 'inversify';
import { ILoggerServer, loggerPath } from '../common/logger-protocol';
import { ILogger, Logger, LoggerFactory, setRootLogger } from '../common/logger';
import { LoggerWatcher } from '../common/logger-watcher';
import { WebSocketConnectionProvider } from './messaging';
import { FrontendApplicationContribution } from './frontend-application';

export const loggerFrontendModule = new ContainerModule(bind => {
    bind(FrontendApplicationContribution).toDynamicValue(ctx =>
        ({
            initialize() {
                setRootLogger(ctx.container.get<ILogger>(ILogger));
            }
        }));

    bind(ILogger).to(Logger).inSingletonScope();
    bind(LoggerWatcher).toSelf().inSingletonScope();
    bind(ILoggerServer).toDynamicValue(ctx => {
        const loggerWatcher = ctx.container.get(LoggerWatcher);
        const connection = ctx.container.get(WebSocketConnectionProvider);
        return connection.createProxy<ILoggerServer>(loggerPath, loggerWatcher.getLoggerClient());
    }).inSingletonScope();
    bind(LoggerFactory).toFactory(ctx =>
        (options?: any) => {
            const child = new Container({ defaultScope: 'Singleton' });
            child.parent = ctx.container;
            child.bind(ILogger).to(Logger).inTransientScope();
            return child.get(ILogger);
        }
    );
});
