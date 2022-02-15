/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */


import { ContainerModule, decorate, injectable } from 'inversify';
import { ApplicationPackage } from '@viz/application-package';
import {
    bindContributionProvider, CommandService, commandServicePath, ConnectionHandler, JsonRpcConnectionHandler,
    MessageClient, MessageService, messageServicePath
} from '../common';
import { BackendApplication, BackendApplicationCliContribution, BackendApplicationContribution, BackendApplicationServer } from './backend-application';
import { CliContribution, CliManager } from './cli';
import { IPCConnectionProvider } from './messaging';
import { ApplicationServerImpl } from './application-server';
import { applicationPath, ApplicationServer } from '../common/application-protocol';
import { envVariablesPath, EnvVariablesServer } from './../common/env-variables';
import { EnvVariablesServerImpl } from './env-variables';
import { ConnectionContainerModule } from './messaging/connection-container-module';
import { QuickPickService, quickPickServicePath } from '../common/quick-pick-service';
import { WsRequestValidator, WsRequestValidatorContribution } from './ws-request-validators'; 
import { ContributionFilterRegistry, ContributionFilterRegistryImpl } from '../common/contribution-filter';
import { EnvironmentUtils } from './environment-utils';
import { ProcessUtils } from './process-utils';

decorate(injectable(), ApplicationPackage);

const commandConnectionModule = ConnectionContainerModule.create(({ bindFrontendService }) => {
    bindFrontendService(commandServicePath, CommandService);
});

const messageConnectionModule = ConnectionContainerModule.create(({ bind, bindFrontendService }) => {
    bindFrontendService(messageServicePath, MessageClient);
    bind(MessageService).toSelf().inSingletonScope();
});

const quickPickConnectionModule = ConnectionContainerModule.create(({ bindFrontendService }) => {
    bindFrontendService(quickPickServicePath, QuickPickService);
});

export const backendApplicationModule = new ContainerModule(bind => {
    bind(ConnectionContainerModule).toConstantValue(commandConnectionModule);
    bind(ConnectionContainerModule).toConstantValue(messageConnectionModule);
    bind(ConnectionContainerModule).toConstantValue(quickPickConnectionModule);

    bind(CliManager).toSelf().inSingletonScope();
    bindContributionProvider(bind, CliContribution);

    bind(BackendApplicationCliContribution).toSelf().inSingletonScope();
    bind(CliContribution).toService(BackendApplicationCliContribution);

    bind(BackendApplication).toSelf().inSingletonScope();
    bindContributionProvider(bind, BackendApplicationContribution);
    // Bind the BackendApplicationServer as a BackendApplicationContribution
    // and fallback to an empty contribution if never bound.
    bind(BackendApplicationContribution).toDynamicValue(ctx => {
        if (ctx.container.isBound(BackendApplicationServer)) {
            return ctx.container.get(BackendApplicationServer);
        } else {
            console.warn('no BackendApplicationServer is set, frontend might not be available');
            return {};
        }
    }).inSingletonScope();

    bind(IPCConnectionProvider).toSelf().inSingletonScope();

    bind(ApplicationServerImpl).toSelf().inSingletonScope();
    bind(ApplicationServer).toService(ApplicationServerImpl);
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(applicationPath, () =>
            ctx.container.get(ApplicationServer)
        )
    ).inSingletonScope();

    bind(EnvVariablesServer).to(EnvVariablesServerImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(envVariablesPath, () => {
            const envVariablesServer = ctx.container.get<EnvVariablesServer>(EnvVariablesServer);
            return envVariablesServer;
        })
    ).inSingletonScope();

    bind(ApplicationPackage).toDynamicValue(({ container }) => {
        const { projectPath } = container.get(BackendApplicationCliContribution);
        return new ApplicationPackage({ projectPath });
    }).inSingletonScope();

    bind(WsRequestValidator).toSelf().inSingletonScope();
    bindContributionProvider(bind, WsRequestValidatorContribution);
   
    bind(ContributionFilterRegistry).to(ContributionFilterRegistryImpl).inSingletonScope(); 
    bind(EnvironmentUtils).toSelf().inSingletonScope();
    bind(ProcessUtils).toSelf().inSingletonScope();
});
