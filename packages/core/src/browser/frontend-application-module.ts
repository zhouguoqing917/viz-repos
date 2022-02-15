/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import '../../src/browser/style/index.css';
import 'font-awesome/css/font-awesome.min.css';
import 'file-icons-js/css/style.css';

import { ContainerModule } from "inversify";
import {
    bindContributionProvider,
    CommandContribution,
    CommandRegistry, CommandService, DefaultResourceProvider,
    MenuContribution, MenuModelRegistry, MessageClient,
    MessageService, ResourceProvider,
    ResourceResolver,
    SelectionService
} from "../common";
import { KeybindingContext, KeybindingContribution, KeybindingRegistry } from "./keybinding";
import { DefaultFrontendApplicationContribution, FrontendApplication, FrontendApplicationContribution } from './frontend-application';
import { DefaultOpenerService, OpenerService, OpenHandler } from './opener-service';
import { HttpOpenHandler } from './http-open-handler';
import { CommonFrontendContribution } from './common-frontend-contribution';
import { QuickCommandFrontendContribution, QuickCommandService, QuickOpenService } from './quick-open';
import { LocalStorageService, StorageService } from './storage-service';
import { WidgetFactory, WidgetManager } from './widget-manager';
import {
    ApplicationShell, ApplicationShellOptions, DockPanelRenderer, DockPanelRendererFactory,
    ShellLayoutRestorer, SidePanelHandler, SidePanelHandlerFactory, SplitPositionHandler, TabBarRenderer, TabBarRendererFactory
} from './shell';
import { StatusBar, StatusBarImpl } from "./status-bar/status-bar";
import { LabelParser } from './label-parser';
import { DefaultUriLabelProviderContribution, LabelProvider, LabelProviderContribution } from "./label-provider";
import {
    PreferenceProvider, PreferenceProviders,
    PreferenceScope, PreferenceService, PreferenceServiceImpl
} from './preferences';
import { ContextMenuRenderer } from './context-menu-renderer';
import { BuiltinThemeProvider, ThemeService, ThemingCommandContribution } from './theming';
import { ApplicationConnectionStatusContribution, ConnectionStatusService, FrontendConnectionStatusService, PingService } from './connection-status-service';
import { DiffUriLabelProviderContribution } from './diff-uris';
import { applicationPath, ApplicationServer } from "../common/application-protocol";
import { ContributionFilterRegistry, ContributionFilterRegistryImpl } from '../common/contribution-filter';
import { WebSocketConnectionProvider } from "./messaging";
import { AboutDialog, AboutDialogProps } from "./about-dialog";
import { envVariablesPath, EnvVariablesServer } from "./../common/env-variables";
import { FrontendApplicationStateService } from './frontend-application-state';

export const frontendApplicationModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    const themeService = ThemeService.get();
    themeService.register(...BuiltinThemeProvider.themes);
    themeService.startupTheme();

    bind(FrontendApplication).toSelf().inSingletonScope();
    bind(FrontendApplicationStateService).toSelf().inSingletonScope();
    bind(DefaultFrontendApplicationContribution).toSelf();
    bindContributionProvider(bind, FrontendApplicationContribution);

    bind(ApplicationShellOptions).toConstantValue({});
    bind(ApplicationShell).toSelf().inSingletonScope();
    bind(SidePanelHandlerFactory).toAutoFactory(SidePanelHandler);
    bind(SidePanelHandler).toSelf();
    bind(SplitPositionHandler).toSelf().inSingletonScope();

    bind(DockPanelRendererFactory).toAutoFactory(DockPanelRenderer);
    bind(DockPanelRenderer).toSelf();
    bind(TabBarRendererFactory).toFactory(context => () => {
        const contextMenuRenderer = context.container.get<ContextMenuRenderer>(ContextMenuRenderer);
        return new TabBarRenderer(contextMenuRenderer);
    });

    bindContributionProvider(bind, OpenHandler);
    bind(DefaultOpenerService).toSelf().inSingletonScope();
    bind(OpenerService).toDynamicValue(context => context.container.get(DefaultOpenerService));
    bind(HttpOpenHandler).toSelf().inSingletonScope();
    bind(OpenHandler).toDynamicValue(ctx => ctx.container.get(HttpOpenHandler)).inSingletonScope();

    bindContributionProvider(bind, WidgetFactory);
    bind(WidgetManager).toSelf().inSingletonScope();
    bind(ShellLayoutRestorer).toSelf().inSingletonScope();
    bind(CommandContribution).toDynamicValue(ctx => ctx.container.get(ShellLayoutRestorer));

    bind(DefaultResourceProvider).toSelf().inSingletonScope();
    bind(ResourceProvider).toProvider(context =>
        uri => context.container.get(DefaultResourceProvider).get(uri)
    );
    bindContributionProvider(bind, ResourceResolver);

    bind(SelectionService).toSelf().inSingletonScope();
    bind(CommandRegistry).toSelf().inSingletonScope();
    bind(CommandService).toDynamicValue(context => context.container.get(CommandRegistry));
    bindContributionProvider(bind, CommandContribution);

    bind(MenuModelRegistry).toSelf().inSingletonScope();
    bindContributionProvider(bind, MenuContribution);

    bind(KeybindingRegistry).toSelf().inSingletonScope();
    bindContributionProvider(bind, KeybindingContext);
    bindContributionProvider(bind, KeybindingContribution);

    bind(MessageClient).toSelf().inSingletonScope();
    bind(MessageService).toSelf().inSingletonScope();

    bind(CommonFrontendContribution).toSelf().inSingletonScope();
    [CommandContribution, KeybindingContribution, MenuContribution].forEach(serviceIdentifier =>
        bind(serviceIdentifier).toDynamicValue(ctx => ctx.container.get(CommonFrontendContribution)).inSingletonScope()
    );

    bind(QuickOpenService).toSelf().inSingletonScope();
    bind(QuickCommandService).toSelf().inSingletonScope();
    bind(QuickCommandFrontendContribution).toSelf().inSingletonScope();
    [CommandContribution, KeybindingContribution].forEach(serviceIdentifier =>
        bind(serviceIdentifier).toDynamicValue(ctx => ctx.container.get(QuickCommandFrontendContribution)).inSingletonScope()
    );

    bind(LocalStorageService).toSelf().inSingletonScope();
    bind(StorageService).toService(LocalStorageService);

    bind(StatusBarImpl).toSelf().inSingletonScope();
    bind(StatusBar).toDynamicValue(ctx => ctx.container.get(StatusBarImpl)).inSingletonScope();
    bind(LabelParser).toSelf().inSingletonScope();

    bindContributionProvider(bind, LabelProviderContribution);
    bind(LabelProvider).toSelf().inSingletonScope();
    bind(LabelProviderContribution).to(DefaultUriLabelProviderContribution).inSingletonScope();
    bind(LabelProviderContribution).to(DiffUriLabelProviderContribution).inSingletonScope();

    bind(PreferenceProvider).toSelf().inSingletonScope().whenTargetNamed(PreferenceScope.User);
    bind(PreferenceProvider).toSelf().inSingletonScope().whenTargetNamed(PreferenceScope.Workspace);
    bind(PreferenceProviders).toFactory(ctx => (scope: PreferenceScope) => ctx.container.getNamed(PreferenceProvider, scope));
    bind(PreferenceServiceImpl).toSelf().inSingletonScope();
    for (const serviceIdentifier of [PreferenceService, FrontendApplicationContribution]) {
        bind(serviceIdentifier).toDynamicValue(ctx => ctx.container.get(PreferenceServiceImpl)).inSingletonScope();
    }

    bind(PingService).toDynamicValue(ctx => {
        // let's reuse a simple and cheap service from this package
        const envServer: EnvVariablesServer = ctx.container.get(EnvVariablesServer);
        return {
            ping() {
                return envServer.getValue('does_not_matter');
            }
        };
    });
    bind(FrontendConnectionStatusService).toSelf().inSingletonScope();
    bind(ConnectionStatusService).toDynamicValue(ctx => ctx.container.get(FrontendConnectionStatusService)).inSingletonScope();
    bind(FrontendApplicationContribution).toDynamicValue(ctx => ctx.container.get(FrontendConnectionStatusService)).inSingletonScope();
    bind(ApplicationConnectionStatusContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toDynamicValue(ctx => ctx.container.get(ApplicationConnectionStatusContribution)).inSingletonScope();

    bind(ApplicationServer).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<ApplicationServer>(applicationPath);
    }).inSingletonScope();
    bind(ContributionFilterRegistry).to(ContributionFilterRegistryImpl).inSingletonScope();

    bind(AboutDialog).toSelf().inSingletonScope();
    bind(AboutDialogProps).toConstantValue({ title: 'Theia' });

    bind(EnvVariablesServer).toDynamicValue(ctx => {
        const connection = ctx.container.get(WebSocketConnectionProvider);
        return connection.createProxy<EnvVariablesServer>(envVariablesPath);
    }).inSingletonScope();

    bind(ThemeService).toDynamicValue(() => ThemeService.get());
    bind(CommandContribution).to(ThemingCommandContribution).inSingletonScope();
});
