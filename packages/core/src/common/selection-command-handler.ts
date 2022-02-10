import { CommandHandler } from './command';
import { SelectionService } from '../common/selection-service';

export class SelectionCommandHandler<S> implements CommandHandler {

    constructor(
        protected readonly selectionService: SelectionService,
        protected readonly toSelection: (arg: any) => S | undefined,
        protected readonly options: SelectionCommandHandler.Options<S>
    ) { }

    execute(...args: any[]): Object | undefined {
        const selection = this.getSelection(...args);
        return selection ? (this.options.execute as any)(selection, ...args) : undefined;
    }

    isVisible(...args: any[]): boolean {
        const selection = this.getSelection(...args);
        return !!selection && (!this.options.isVisible || (this.options.isVisible as any)(selection as any, ...args));
    }

    isEnabled(...args: any[]): boolean {
        const selection = this.getSelection(...args);
        return !!selection && (!this.options.isEnabled || (this.options.isEnabled as any)(selection as any, ...args));
    }

    protected isMulti(): boolean {
        return this.options && !!this.options.multi;
    }

    protected getSelection(...args: any[]): S | S[] | undefined {
        const givenSelection = args.length && this.toSelection(args[0]);
        if (givenSelection) {
            return this.isMulti() ? [givenSelection] : givenSelection;
        }
        const globalSelection = this.getSingleSelection(this.selectionService.selection);
        if (this.isMulti()) {
            return this.getMultiSelection(globalSelection);
        }
        return this.getSingleSelection(globalSelection);
    }

    protected getSingleSelection(arg: Object | undefined): S | undefined {
        let selection = this.toSelection(arg);
        if (selection) {
            return selection;
        }
        if (Array.isArray(arg)) {
            for (const element of arg) {
                selection = this.toSelection(element);
                if (selection) {
                    return selection;
                }
            }
        }
        return undefined;
    }

    protected getMultiSelection(arg: Object | undefined): S[] | undefined {
        let selection = this.toSelection(arg);
        if (selection) {
            return [selection];
        }
        const result = [];
        if (Array.isArray(arg)) {
            for (const element of arg) {
                selection = this.toSelection(element);
                if (selection) {
                    result.push(selection);
                }
            }
        }
        return result.length ? result : undefined;
    }
}
export namespace SelectionCommandHandler {
    export type Options<S> = SelectionOptions<false, S> | SelectionOptions<true, S[]>;
    export interface SelectionOptions<Multi extends boolean, T> {
        multi: Multi;
        execute(selection: T, ...args: any[]): any;
        isEnabled?(selection: T, ...args: any[]): boolean;
        isVisible?(selection: T, ...args: any[]): boolean;
    }
}
