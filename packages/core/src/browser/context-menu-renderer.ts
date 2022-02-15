import { MenuPath } from "../common/menu";

export type Anchor = MouseEvent | { x: number, y: number };

export function toAnchor(anchor: HTMLElement | { x: number, y: number }): Anchor {
    return anchor instanceof HTMLElement ? { x: anchor.offsetLeft, y: anchor.offsetTop } : anchor;
}

export const ContextMenuRenderer = Symbol("ContextMenuRenderer");
export interface ContextMenuRenderer {  
    render(menuPath: MenuPath, anchor: Anchor, onHide?: () => void): void;
}
export interface RenderContextMenuOptions {
    menuPath: MenuPath
    anchor: Anchor
    args?: any[]
    onHide?: () => void
}
export namespace RenderContextMenuOptions {
    export function resolve(arg: MenuPath | RenderContextMenuOptions, anchor?: Anchor, onHide?: () => void): RenderContextMenuOptions {
        let menuPath: MenuPath;
        let args: any[];
        if (Array.isArray(arg)) {
            menuPath = arg;
            args = [anchor!];
        } else {
            menuPath = arg.menuPath;
            anchor = arg.anchor;
            onHide = arg.onHide;
            args = arg.args ? [...arg.args, anchor] : [anchor];
        }
        return {
            menuPath,
            anchor: anchor!,
            onHide,
            args
        };
    }
}
