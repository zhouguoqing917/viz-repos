import { QuickOpenHideReason } from './quick-open-service';
import { QuickOpenItem, QuickOpenItemOptions, QuickTitleButton } from './quick-open-model';
import { Event } from './event';

export type QuickPickItem<T> = QuickPickValue<T> | QuickPickSeparator;

export interface QuickPickSeparator {
    type: 'separator'
    label: string
}
export namespace QuickPickSeparator {
    export function is(item: string | QuickPickItem<Object>): item is QuickPickSeparator {
        return typeof item === 'object' && 'type' in item && item['type'] === 'separator';
    }
}

export interface QuickPickValue<T> {
    label: string
    value: T
    description?: string
    detail?: string
    iconClass?: string
}

export interface QuickPickOptions {
    placeholder?: string
    /**
     * default: true
     */
    fuzzyMatchLabel?: boolean
    /**
     * default: true
     */
    fuzzyMatchDescription?: boolean

    /**
     * Current step count
     */
    step?: number | undefined

    /**
     * The title of the input
     */
    title?: string | undefined

    /**
     * Total number of steps
     */
    totalSteps?: number | undefined

    /**
     * Buttons that are displayed on the title panel
     */
    buttons?: ReadonlyArray<QuickTitleButton>

    /**
     * Set to `true` to keep the input box open when focus moves to another part of the editor or to another window.
     */
    ignoreFocusOut?: boolean

    /**
     * The prefill value.
     */
    value?: string;

    /**
     * Determines if the quick pick with a single item should
     * execute the item instead of displaying. The default is `true`.
     */
    runIfSingle?: boolean;
}

export const quickPickServicePath = '/services/quickPick';
export const QuickPickService = Symbol('QuickPickService');
export interface QuickPickService {

    show(elements: string[], options?: QuickPickOptions): Promise<string | undefined>;

    show<T>(elements: QuickPickItem<T>[], options?: QuickPickOptions): Promise<T | undefined>;

    setItems(items: QuickOpenItem[]): void;

    hide(reason?: QuickOpenHideReason): void

    readonly onDidAccept: Event<void>;
    readonly onDidChangeValue: Event<string>;
    readonly onDidChangeActiveItems: Event<QuickOpenItem<QuickOpenItemOptions>[]>;
}
