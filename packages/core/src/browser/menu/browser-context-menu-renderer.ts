import { inject, injectable } from "inversify";
import { MenuPath } from '../../common/menu';
import { Anchor, ContextMenuRenderer } from "../context-menu-renderer";
import { BrowserMainMenuFactory } from "./browser-menu-plugin";

@injectable()
export class BrowserContextMenuRenderer implements ContextMenuRenderer {

    constructor( @inject(BrowserMainMenuFactory) private menuFactory: BrowserMainMenuFactory) {
    }

    render(menuPath: MenuPath, anchor: Anchor, onHide?: () => void): void {
        const contextMenu = this.menuFactory.createContextMenu(menuPath);
        const { x, y } = anchor instanceof MouseEvent ? { x: anchor.clientX, y: anchor.clientY } : anchor;
        if (onHide) {
            contextMenu.aboutToClose.connect(() => onHide());
        }
        contextMenu.open(x, y);
    }

}
