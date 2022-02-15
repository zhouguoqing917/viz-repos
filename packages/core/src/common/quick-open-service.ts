export enum QuickOpenHideReason {
    ELEMENT_SELECTED,
    FOCUS_LOST,
    CANCELED,
}

export type QuickOpenOptions = Partial<QuickOpenOptions.Resolved>;
export namespace QuickOpenOptions {
    export interface FuzzyMatchOptions {
        /**
         * Default: `false`
         */
        enableSeparateSubstringMatching?: boolean
    }
    export interface Resolved {
        readonly enabled: boolean;

        /** `true` means that input of quick open widget will be trimmed by default. */
        readonly trimInput: boolean;
        readonly prefix: string;
        readonly placeholder: string;
        readonly ignoreFocusOut: boolean;
        readonly valueSelection: Readonly<[number, number]>;

        readonly fuzzyMatchLabel: boolean | FuzzyMatchOptions;
        readonly fuzzyMatchDetail: boolean | FuzzyMatchOptions;
        readonly fuzzyMatchDescription: boolean | FuzzyMatchOptions;
        readonly fuzzySort: boolean;

        /** The amount of first symbols to be ignored by quick open widget (e.g. don't affect matching). */
        readonly skipPrefix: number;

        /**
         * Whether to display the items that don't have any highlight.
         */
        readonly showItemsWithoutHighlight: boolean;

        /**
         * `true` if the quick open widget provides a way for the user to securely enter a password.
         * Otherwise, `false`.
         */
        readonly password: boolean;

        selectIndex(lookFor: string): number;

        onClose(canceled: boolean): void;
    }
    export const defaultOptions: Resolved = Object.freeze({
        enabled: true,

        trimInput: true,
        prefix: '',
        placeholder: '',
        ignoreFocusOut: false,
        valueSelection: [-1, -1] as Readonly<[number, number]>,

        fuzzyMatchLabel: false,
        fuzzyMatchDetail: false,
        fuzzyMatchDescription: false,
        fuzzySort: false,

        skipPrefix: 0,

        showItemsWithoutHighlight: false,
        password: false,

        onClose: () => { /* no-op*/ },

        selectIndex: () => -1
    });
    export function resolve(options: QuickOpenOptions = {}, source: Resolved = defaultOptions): Resolved {
        return Object.assign({}, source, options);
    }
}
