
import { inject, injectable, named } from 'inversify';
import { Disposable } from './disposable';
import { Command, CommandRegistry } from './command';
import { ContributionProvider } from './contribution-provider';

export interface MenuAction {
    commandId: string
    /**
     * In addition to the mandatory command property, an alternative command can be defined.
     * It will be shown and invoked when pressing Alt while opening a menu.
     */
    alt?: string;
    label?: string
    icon?: string
    order?: string
    when?: string
}

export namespace MenuAction {
    /* Determine whether object is a MenuAction */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(arg: MenuAction | any): arg is MenuAction {
        return !!arg && arg === Object(arg) && 'commandId' in arg;
    }
}

export interface SubMenuOptions {
    iconClass: string
}

export type MenuPath = string[];

export const MAIN_MENU_BAR: MenuPath = ['menubar'];

export const MenuContribution = Symbol('MenuContribution');

/**
 * Representation of a menu contribution.
 */
export interface MenuContribution {
    /**
     * Registers menus.
     * @param menus the menu model registry.
     */
    registerMenus(menus: MenuModelRegistry): void;
}

@injectable()
export class MenuModelRegistry {
    protected readonly root = new CompositeMenuNode('');

    constructor(
        @inject(ContributionProvider) @named(MenuContribution)
        protected readonly contributions: ContributionProvider<MenuContribution>,
        @inject(CommandRegistry) protected readonly commands: CommandRegistry
    ) { }

    onStart(): void {
        for (const contrib of this.contributions.getContributions()) {
            contrib.registerMenus(this);
        }
    }

    registerMenuAction(menuPath: MenuPath, item: MenuAction): Disposable {
        const parent = this.findGroup(menuPath);
        const actionNode = new ActionMenuNode(item, this.commands);
        return parent.addNode(actionNode);
    }

    registerSubmenu(menuPath: MenuPath, label: string, options?: SubMenuOptions): Disposable {
        if (menuPath.length === 0) {
            throw new Error('The sub menu path cannot be empty.');
        }
        const index = menuPath.length - 1;
        const menuId = menuPath[index];
        const groupPath = index === 0 ? [] : menuPath.slice(0, index);
        const parent = this.findGroup(groupPath);
        let groupNode = this.findSubMenu(parent, menuId);
        if (!groupNode) {
            groupNode = new CompositeMenuNode(menuId, label, options ? options.iconClass : undefined);
            return parent.addNode(groupNode);
        } else {
            if (!groupNode.label) {
                groupNode.label = label;
            } else if (groupNode.label !== label) {
                throw new Error("The group '" + menuPath.join('/') + "' already has a different label.");
            }
            if (!groupNode.iconClass && options) {
                groupNode.iconClass = options.iconClass;
            }
            return { dispose: () => { } };
        }
    }

    /**
     * Unregister menu item from the registry
     *
     * @param item
     */
    unregisterMenuAction(item: MenuAction, menuPath?: MenuPath): void;
    /**
     * Unregister menu item from the registry
     *
     * @param command
     */
    unregisterMenuAction(command: Command, menuPath?: MenuPath): void;
    /**
     * Unregister menu item from the registry
     *
     * @param id
     */
    unregisterMenuAction(id: string, menuPath?: MenuPath): void;
    unregisterMenuAction(itemOrCommandOrId: MenuAction | Command | string, menuPath?: MenuPath): void {
        const id = MenuAction.is(itemOrCommandOrId) ? itemOrCommandOrId.commandId
            : Command.is(itemOrCommandOrId) ? itemOrCommandOrId.id
                : itemOrCommandOrId;

        if (menuPath) {
            const parent = this.findGroup(menuPath);
            parent.removeNode(id);
            return;
        }

        // Recurse all menus, removing any menus matching the id
        const recurse = (root: CompositeMenuNode) => {
            root.children.forEach(node => {
                if (node instanceof CompositeMenuNode) {
                    node.removeNode(id);
                    recurse(node);
                }
            });
        };
        recurse(this.root);
    }

    protected findGroup(menuPath: MenuPath): CompositeMenuNode {
        let currentMenu = this.root;
        for (const segment of menuPath) {
            currentMenu = this.findSubMenu(currentMenu, segment);
        }
        return currentMenu;
    }

    protected findSubMenu(current: CompositeMenuNode, menuId: string): CompositeMenuNode {
        const sub = current.children.find(e => e.id === menuId);
        if (sub instanceof CompositeMenuNode) {
            return sub;
        }
        if (sub) {
            throw new Error(`'${menuId}' is not a menu group.`);
        }
        const newSub = new CompositeMenuNode(menuId);
        current.addNode(newSub);
        return newSub;
    }

    getMenu(menuPath: MenuPath = []): CompositeMenuNode {
        return this.findGroup(menuPath);
    }
}

export interface MenuNode {
    readonly label?: string
    /**
     * technical identifier
     */
    readonly id: string

    readonly sortString: string
}

export class CompositeMenuNode implements MenuNode {
    protected readonly _children: MenuNode[] = [];
    constructor(
        public readonly id: string,
        public label?: string,
        public iconClass?: string
    ) { }

    get children(): ReadonlyArray<MenuNode> {
        return this._children;
    }

    public addNode(node: MenuNode): Disposable {
        this._children.push(node);
        this._children.sort((m1, m2) => {
            // The navigation group is special as it will always be sorted to the top/beginning of a menu.
            if (CompositeMenuNode.isNavigationGroup(m1)) {
                return -1;
            }
            if (CompositeMenuNode.isNavigationGroup(m2)) {
                return 1;
            }
            if (m1.sortString < m2.sortString) {
                return -1;
            } else if (m1.sortString > m2.sortString) {
                return 1;
            } else {
                return 0;
            }
        });
        return {
            dispose: () => {
                const idx = this._children.indexOf(node);
                if (idx >= 0) {
                    this._children.splice(idx, 1);
                }
            }
        };
    }

    public removeNode(id: string): void {
        const node = this._children.find(n => n.id === id);
        if (node) {
            const idx = this._children.indexOf(node);
            if (idx >= 0) {
                this._children.splice(idx, 1);
            }
        }
    }

    get sortString(): string {
        return this.id;
    }

    get isSubmenu(): boolean {
        return this.label !== undefined;
    }

    static isNavigationGroup(node: MenuNode): node is CompositeMenuNode {
        return node instanceof CompositeMenuNode && node.id === 'navigation';
    }
}

export class ActionMenuNode implements MenuNode {

    readonly altNode: ActionMenuNode | undefined;

    constructor(
        public readonly action: MenuAction,
        protected readonly commands: CommandRegistry
    ) {
        if (action.alt) {
            this.altNode = new ActionMenuNode({ commandId: action.alt }, commands);
        }
    }

    get id(): string {
        return this.action.commandId;
    }

    get label(): string {
        if (this.action.label) {
            return this.action.label;
        }
        const cmd = this.commands.getCommand(this.action.commandId);
        if (!cmd) {
            throw new Error(`A command with id '${this.action.commandId}' does not exist.`);
        }
        return cmd.label || cmd.id;
    }

    get icon(): string | undefined {
        if (this.action.icon) {
            return this.action.icon;
        }
        const command = this.commands.getCommand(this.action.commandId);
        return command && command.iconClass;
    }

    get sortString(): string {
        return this.action.order || this.label;
    }
}
