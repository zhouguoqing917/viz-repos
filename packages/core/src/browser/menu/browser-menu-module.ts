import { ContainerModule } from "inversify";
import { FrontendApplicationContribution } from "../frontend-application";
import { ContextMenuRenderer } from "../context-menu-renderer";
import { BrowserMainMenuFactory, BrowserMenuBarContribution } from "./browser-menu-plugin";
import { BrowserContextMenuRenderer } from "./browser-context-menu-renderer";


export default new ContainerModule(bind => {
    bind(BrowserMainMenuFactory).toSelf().inSingletonScope();
    bind(ContextMenuRenderer).to(BrowserContextMenuRenderer).inSingletonScope();
    bind(BrowserMenuBarContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(BrowserMenuBarContribution);
});