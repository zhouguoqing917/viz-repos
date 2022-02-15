/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from "inversify";
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from "@theia/core/lib/common";
import URI from "@theia/core/lib/common/uri";
import { open, OpenerService, CommonMenus, StorageService } from '@theia/core/lib/browser';
import { DirNode, FileDialogFactory, FileStatNode } from '@theia/filesystem/lib/browser';
import { FileSystem } from '@theia/filesystem/lib/common';
import { WorkspaceService } from './workspace-service';
import { LabelProvider } from "@theia/core/lib/browser/label-provider";

export namespace WorkspaceCommands {
    export const OPEN: Command = {
        id: 'workspace:open',
        label: 'Open...'
    };
}

@injectable()
export class WorkspaceFrontendContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(FileSystem) protected readonly fileSystem: FileSystem,
        @inject(FileDialogFactory) protected readonly fileDialogFactory: FileDialogFactory,
        @inject(OpenerService) protected readonly openerService: OpenerService,
        @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService,
        @inject(StorageService) protected readonly workspaceStorage: StorageService,
        @inject(LabelProvider) protected readonly labelProvider: LabelProvider
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(WorkspaceCommands.OPEN, {
            isEnabled: () => true,
            execute: () => this.showFileDialog()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.FILE_OPEN, {
            commandId: WorkspaceCommands.OPEN.id
        });
    }

    protected showFileDialog(): void {
        this.workspaceService.root.then(async resolvedRoot => {
            const root = resolvedRoot || await this.fileSystem.getCurrentUserHome();
            if (root) {
                const rootUri = new URI(root.uri).parent;
                const rootStat = await this.fileSystem.getFileStat(rootUri.toString());
                const name = this.labelProvider.getName(rootUri);
                const label = await this.labelProvider.getIcon(root);
                const rootNode = DirNode.createRoot(rootStat, name, label);
                const dialog = this.fileDialogFactory({ title: WorkspaceCommands.OPEN.label! });
                dialog.model.navigateTo(rootNode);
                const node = await dialog.open();
                this.openFile(node);
            }
        });
    }

    protected openFile(node: Readonly<FileStatNode> | undefined): void {
        if (!node) {
            return;
        }
        if (node.fileStat.isDirectory) {
            this.workspaceService.open(node.uri);
        } else {
            open(this.openerService, node.uri);
        }
    }

}
