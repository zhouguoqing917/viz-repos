
import { inject, injectable, named } from 'inversify';
import { Emitter, Event, WaitUntilEvent } from './event';
import { Disposable, DisposableCollection } from './disposable';
import { ContributionProvider } from './contribution-provider';

/**
 * A command is a unique identifier of a function
 * which can be executed by a user via a keyboard shortcut,
 * a menu action or directly.
 */
export interface Command {
    /**
     * A unique identifier of this command.
     */
    id: string;
    /**
     * A label of this command.
     */
    label?: string;
    /**
     * An icon class of this command.
     */
    iconClass?: string;
    /**
     * A category of this command.
     */
    category?: string;
}

export namespace Command {
    /* Determine whether object is a Command */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(arg: Command | any): arg is Command {
        return !!arg && arg === Object(arg) && 'id' in arg;
    }

    /** Comparator function for when sorting commands */
    export function compareCommands(a: Command, b: Command): number {
        if (a.label && b.label) {
            const aCommand = (a.category) ? a.category + a.label : a.label;
            const bCommand = (b.category) ? b.category + b.label : b.label;
            return (aCommand).localeCompare(bCommand);
        } else {
            return 0;
        }
    }

    /**
     * Determine if two commands are equal.
     *
     * @param a the first command for comparison.
     * @param b the second command for comparison.
     */
    export function equals(a: Command, b: Command): boolean {
        return (
            a.id === b.id &&
            a.label === b.label &&
            a.iconClass === b.iconClass &&
            a.category === b.category
        );
    }
}

/**
 * A command handler is an implementation of a command.
 *
 * A command can have multiple handlers
 * but they should be active in different contexts,
 * otherwise first active will be executed.
 */
export interface CommandHandler {
    /**
     * Execute this handler.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute(...args: any[]): any;
    /**
     * Test whether this handler is enabled (active).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isEnabled?(...args: any[]): boolean;
    /**
     * Test whether menu items for this handler should be visible.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isVisible?(...args: any[]): boolean;
    /**
     * Test whether menu items for this handler should be toggled.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isToggled?(...args: any[]): boolean;
}

export const CommandContribution = Symbol('CommandContribution');
/**
 * The command contribution should be implemented to register custom commands and handler.
 */
export interface CommandContribution {
    /**
     * Register commands and handlers.
     */
    registerCommands(commands: CommandRegistry): void;
}

export interface WillExecuteCommandEvent extends WaitUntilEvent {
    commandId: string;
}

export const commandServicePath = '/services/commands';
export const CommandService = Symbol('CommandService');
/**
 * The command service should be used to execute commands.
 */
export interface CommandService {
    /**
     * Execute the active handler for the given command and arguments.
     *
     * Reject if a command cannot be executed.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executeCommand<T>(command: string, ...args: any[]): Promise<T | undefined>;
    /**
     * An event is emitted when a command is about to be executed.
     *
     * It can be used to install or activate a command handler.
     */
    readonly onWillExecuteCommand: Event<WillExecuteCommandEvent>;
}

/**
 * The command registry manages commands and handlers.
 */
@injectable()
export class CommandRegistry implements CommandService {

    protected readonly _commands: { [id: string]: Command } = {};
    protected readonly _handlers: { [id: string]: CommandHandler[] } = {};

    protected readonly toUnregisterCommands = new Map<string, Disposable>();

    // List of recently used commands.
    protected _recent: Command[] = [];

    protected readonly onWillExecuteCommandEmitter = new Emitter<WillExecuteCommandEvent>();
    readonly onWillExecuteCommand = this.onWillExecuteCommandEmitter.event;

    constructor(
        @inject(ContributionProvider) @named(CommandContribution)
        protected readonly contributionProvider: ContributionProvider<CommandContribution>
    ) { }

    onStart(): void {
        const contributions = this.contributionProvider.getContributions();
        for (const contrib of contributions) {
            contrib.registerCommands(this);
        }
    }

    /**
     * Register the given command and handler if present.
     *
     * Throw if a command is already registered for the given command identifier.
     */
    registerCommand(command: Command, handler?: CommandHandler): Disposable {
        if (this._commands[command.id]) {
            console.warn(`A command ${command.id} is already registered.`);
            return Disposable.NULL;
        }
        const toDispose = new DisposableCollection(this.doRegisterCommand(command));
        if (handler) {
            toDispose.push(this.registerHandler(command.id, handler));
        }
        this.toUnregisterCommands.set(command.id, toDispose);
        toDispose.push(Disposable.create(() => this.toUnregisterCommands.delete(command.id)));
        return toDispose;
    }

    protected doRegisterCommand(command: Command): Disposable {
        this._commands[command.id] = command;
        return {
            dispose: () => {
                delete this._commands[command.id];
            }
        };
    }

    /**
     * Unregister command from the registry
     *
     * @param command
     */
    unregisterCommand(command: Command): void;
    /**
     * Unregister command from the registry
     *
     * @param id
     */
    unregisterCommand(id: string): void;
    unregisterCommand(commandOrId: Command | string): void {
        const id = Command.is(commandOrId) ? commandOrId.id : commandOrId;
        const toUnregister = this.toUnregisterCommands.get(id);
        if (toUnregister) {
            toUnregister.dispose();
        }
    }

    /**
     * Register the given handler for the given command identifier.
     */
    registerHandler(commandId: string, handler: CommandHandler): Disposable {
        let handlers = this._handlers[commandId];
        if (!handlers) {
            this._handlers[commandId] = handlers = [];
        }
        handlers.push(handler);
        return {
            dispose: () => {
                const idx = handlers.indexOf(handler);
                if (idx >= 0) {
                    handlers.splice(idx, 1);
                }
            }
        };
    }

    /**
     * Test whether there is an active handler for the given command.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isEnabled(command: string, ...args: any[]): boolean {
        return typeof this.getActiveHandler(command, ...args) !== 'undefined';
    }

    /**
     * Test whether there is a visible handler for the given command.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isVisible(command: string, ...args: any[]): boolean {
        return typeof this.getVisibleHandler(command, ...args) !== 'undefined';
    }

    /**
     * Test whether there is a toggled handler for the given command.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isToggled(command: string, ...args: any[]): boolean {
        return typeof this.getToggledHandler(command, ...args) !== 'undefined';
    }

    /**
     * Execute the active handler for the given command and arguments.
     *
     * Reject if a command cannot be executed.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async executeCommand<T>(commandId: string, ...args: any[]): Promise<T | undefined> {
        await this.fireWillExecuteCommand(commandId);
        const handler = this.getActiveHandler(commandId, ...args);
        if (handler) {
            const result = await handler.execute(...args);
            const command = this.getCommand(commandId);
            if (command) {
                this.addRecentCommand(command);
            }
            return result;
        }
        const argsMessage = args && args.length > 0 ? ` (args: ${JSON.stringify(args)})` : '';
        // eslint-disable-next-line max-len
        throw Object.assign(new Error(`The command '${commandId}' cannot be executed. There are no active handlers available for the command.${argsMessage}`), { code: 'NO_ACTIVE_HANDLER' });
    }

    protected async fireWillExecuteCommand(commandId: string): Promise<void> {
        await WaitUntilEvent.fire(this.onWillExecuteCommandEmitter, { commandId }, 30000);
    }

    /**
     * Get a visible handler for the given command or `undefined`.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getVisibleHandler(commandId: string, ...args: any[]): CommandHandler | undefined {
        const handlers = this._handlers[commandId];
        if (handlers) {
            for (const handler of handlers) {
                try {
                    if (!handler.isVisible || handler.isVisible(...args)) {
                        return handler;
                    }
                } catch (error) {
                    console.error(error);
                }
            }
        }
        return undefined;
    }

    /**
     * Get an active handler for the given command or `undefined`.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getActiveHandler(commandId: string, ...args: any[]): CommandHandler | undefined {
        const handlers = this._handlers[commandId];
        if (handlers) {
            for (const handler of handlers) {
                try {
                    if (!handler.isEnabled || handler.isEnabled(...args)) {
                        return handler;
                    }
                } catch (error) {
                    console.error(error);
                }
            }
        }
        return undefined;
    }

    /**
     * Get a toggled handler for the given command or `undefined`.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getToggledHandler(commandId: string, ...args: any[]): CommandHandler | undefined {
        const handlers = this._handlers[commandId];
        if (handlers) {
            for (const handler of handlers) {
                try {
                    if (handler.isToggled && handler.isToggled(...args)) {
                        return handler;
                    }
                } catch (error) {
                    console.error(error);
                }
            }
        }
        return undefined;
    }

    /**
     * Returns with all handlers for the given command. If the command does not have any handlers,
     * or the command is not registered, returns an empty array.
     */
    getAllHandlers(commandId: string): CommandHandler[] {
        const handlers = this._handlers[commandId];
        return handlers ? handlers.slice() : [];
    }

    /**
     * Get all registered commands.
     */
    get commands(): Command[] {
        const commands: Command[] = [];
        for (const id of this.commandIds) {
            const cmd = this.getCommand(id);
            if (cmd) {
                commands.push(cmd);
            }
        }
        return commands;
    }

    /**
     * Get a command for the given command identifier.
     */
    getCommand(id: string): Command | undefined {
        return this._commands[id];
    }

    /**
     * Get all registered commands identifiers.
     */
    get commandIds(): string[] {
        return Object.keys(this._commands);
    }

    /**
     * Get the list of recently used commands.
     */
    get recent(): Command[] {
        return this._recent;
    }

    /**
     * Set the list of recently used commands.
     * @param commands the list of recently used commands.
     */
    set recent(commands: Command[]) {
        this._recent = commands;
    }

    /**
     * Adds a command to recently used list.
     * Prioritizes commands that were recently executed to be most recent.
     *
     * @param recent a recent command, or array of recent commands.
     */
    addRecentCommand(recent: Command | Command[]): void {
        if (Array.isArray(recent)) {
            recent.forEach((command: Command) => this.addRecentCommand(command));
        } else {
            // Determine if the command currently exists in the recently used list.
            const index = this._recent.findIndex((command: Command) => Command.equals(recent, command));
            // If the command exists, remove it from the array so it can later be placed at the top.
            if (index >= 0) { this._recent.splice(index, 1); }
            // Add the recent command to the beginning of the array (most recent).
            this._recent.unshift(recent);
        }
    }

    /**
     * Clear the list of recently used commands.
     */
    clearCommandHistory(): void {
        this.recent = [];
    }

}
