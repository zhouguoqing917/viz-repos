import { inject, injectable } from "inversify";
import { MenuPath } from "../../common";
import { Anchor, ContextMenuRenderer } from "../../browser";
import { ElectronMainMenuFactory } from "./electron-main-menu-factory";

@injectable()
export class ElectronContextMenuRenderer implements ContextMenuRenderer {

    constructor( @inject(ElectronMainMenuFactory) private menuFactory: ElectronMainMenuFactory) {
    }

    render(menuPath: MenuPath, anchor: Anchor, onHide?: () => void): void {
        const menu = this.menuFactory.createContextMenu(menuPath);
        menu.popup();
        if (onHide) {
            onHide();
        }
    }

}
