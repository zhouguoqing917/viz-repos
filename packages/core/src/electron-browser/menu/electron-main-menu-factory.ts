
import * as electron from 'electron';
import { inject, injectable } from 'inversify';
import { ActionMenuNode, CommandRegistry, CompositeMenuNode, isOSX, MAIN_MENU_BAR, MenuModelRegistry, MenuPath } from '../../common';

@injectable()
export class ElectronMainMenuFactory {

    constructor(
        @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry,
        @inject(MenuModelRegistry) protected readonly menuProvider: MenuModelRegistry
    ) { }

    createMenuBar(): Electron.Menu {
        const menuModel = this.menuProvider.getMenu(MAIN_MENU_BAR);
        const template = this.fillMenuTemplate([], menuModel);
        if (isOSX) {
            template.unshift(this.createOSXMenu());
        }
        return electron.remote.Menu.buildFromTemplate(template);
    }

    createContextMenu(menuPath: MenuPath): Electron.Menu {
        const menuModel = this.menuProvider.getMenu(menuPath);
        const template = this.fillMenuTemplate([], menuModel);

        return electron.remote.Menu.buildFromTemplate(template);
    }

    protected fillMenuTemplate(items: Electron.MenuItemConstructorOptions[], menuModel: CompositeMenuNode): Electron.MenuItemConstructorOptions[] {
        for (const menu of menuModel.children) {
            if (menu instanceof CompositeMenuNode) {
                if (menu.label) {
                    // should we create a submenu?
                    items.push({
                        label: menu.label,
                        submenu: this.fillMenuTemplate([], menu)
                    });
                } else {
                    // or just a separator?
                    items.push({
                        type: 'separator'
                    });
                    // followed by the elements
                    this.fillMenuTemplate(items, menu);
                }
            } else if (menu instanceof ActionMenuNode) {
                // That is only a sanity check at application startup.
                if (!this.commandRegistry.getCommand(menu.action.commandId)) {
                    throw new Error(`Unknown command with ID: ${menu.action.commandId}.`);
                }
                items.push({
                    label: menu.label,
                    icon: menu.icon,
                    enabled: true, // https://github.com/theia-ide/theia/issues/446
                    visible: true,
                    click: () => this.execute(menu.action.commandId)
                });
            }
        }
        return items;
    }

    protected execute(command: string): void {
        this.commandRegistry.executeCommand(command).catch(() => { /* no-op */ });
    }

    protected createOSXMenu(): Electron.MenuItemConstructorOptions {
        return {
            label: 'Theia',
            submenu: [
                {
                    role: 'about'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'services',
                    submenu: []
                },
                {
                    type: 'separator'
                },
                {
                    role: 'hide'
                },
                {
                    role: 'hideOthers'
                },
                {
                    role: 'unhide'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'quit'
                }
            ]
        };
    }

}
