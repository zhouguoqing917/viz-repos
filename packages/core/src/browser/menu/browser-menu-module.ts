/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from "inversify";
import { FrontendApplicationContribution } from "../frontend-application";
import { ContextMenuRenderer } from "../context-menu-renderer";
import { BrowserMainMenuFactory, BrowserMenuBarContribution } from "./browser-menu-plugin";
import { BrowserContextMenuRenderer } from "./browser-context-menu-renderer";

export default new ContainerModule(bind => {
    bind(BrowserMainMenuFactory).toSelf().inSingletonScope();
    bind(ContextMenuRenderer).to(BrowserContextMenuRenderer).inSingletonScope();
    bind(FrontendApplicationContribution).to(BrowserMenuBarContribution).inSingletonScope();
});