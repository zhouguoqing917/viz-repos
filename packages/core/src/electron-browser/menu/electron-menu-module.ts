import { ContainerModule } from 'inversify';
import { CommandContribution, MenuContribution } from "../../common";
import { ContextMenuRenderer, FrontendApplicationContribution, KeybindingContext, KeybindingContribution } from '../../browser';
import { ElectronMainMenuFactory } from './electron-main-menu-factory';
import { ElectronContextMenuRenderer } from "./electron-context-menu-renderer";
import { ElectronMenuContribution } from "./electron-menu-contribution";

export default new ContainerModule(bind => {
    bind(ElectronMainMenuFactory).toSelf().inSingletonScope();
    bind(ContextMenuRenderer).to(ElectronContextMenuRenderer).inSingletonScope();
    bind(KeybindingContext).toConstantValue({
        id: "theia.context",
        isEnabled: true
    });

    bind(ElectronMenuContribution).toSelf().inSingletonScope();
    for (const serviceIdentifier of [FrontendApplicationContribution, KeybindingContribution, CommandContribution, MenuContribution]) {
        bind(serviceIdentifier).toDynamicValue(ctx => ctx.container.get(ElectronMenuContribution)).inSingletonScope();
    }
});
