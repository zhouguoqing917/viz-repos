import URI from './uri';
import { Keybinding } from '../browser/keybinding';
import { Disposable } from './disposable';

export interface Highlight {
    start: number
    end: number
}

export enum QuickOpenMode {
    PREVIEW,
    OPEN,
    OPEN_IN_BACKGROUND
}

export interface QuickOpenItemOptions {
    tooltip?: string;
    label?: string;
    labelHighlights?: Highlight[];
    description?: string;
    descriptionHighlights?: Highlight[];
    detail?: string;
    detailHighlights?: Highlight[];
    hidden?: boolean;
    uri?: URI;
    iconClass?: string;
    keybinding?: Keybinding;
    run?(mode: QuickOpenMode): boolean;
}
export interface QuickOpenGroupItemOptions extends QuickOpenItemOptions {
    groupLabel?: string;
    showBorder?: boolean;
}

export class QuickOpenItem<T extends QuickOpenItemOptions = QuickOpenItemOptions> {

    constructor(
        protected options: T = {} as T
    ) { }

    getTooltip(): string | undefined {
        return this.options.tooltip || this.getLabel();
    }
    getLabel(): string | undefined {
        return this.options.label;
    }
    getLabelHighlights(): Highlight[] {
        return this.options.labelHighlights || [];
    }
    getDescription(): string | undefined {
        return this.options.description;
    }
    getDescriptionHighlights(): Highlight[] | undefined {
        return this.options.descriptionHighlights;
    }
    getDetail(): string | undefined {
        return this.options.detail;
    }
    getDetailHighlights(): Highlight[] | undefined {
        return this.options.detailHighlights;
    }
    isHidden(): boolean {
        return this.options.hidden || false;
    }
    getUri(): URI | undefined {
        return this.options.uri;
    }
    getIconClass(): string | undefined {
        return this.options.iconClass;
    }
    getKeybinding(): Keybinding | undefined {
        return this.options.keybinding;
    }
    run(mode: QuickOpenMode): boolean {
        if (!this.options.run) {
            return false;
        }
        return this.options.run(mode);
    }
}

export class QuickOpenGroupItem<T extends QuickOpenGroupItemOptions = QuickOpenGroupItemOptions> extends QuickOpenItem<T> {

    getGroupLabel(): string | undefined {
        return this.options.groupLabel;
    }
    showBorder(): boolean {
        return this.options.showBorder || false;
    }
}

export interface QuickOpenModel {
    onType(lookFor: string, acceptor: (items: QuickOpenItem[], actionProvider?: QuickOpenActionProvider) => void): void;
}

export interface QuickOpenActionProvider {
    hasActions(item: QuickOpenItem): boolean;
    getActions(item: QuickOpenItem): ReadonlyArray<QuickOpenAction>;
}

export interface QuickOpenActionOptions {
    id: string;
    label?: string;
    tooltip?: string;
    class?: string | undefined;
    enabled?: boolean;
    checked?: boolean;
    radio?: boolean;
}

export interface QuickOpenAction extends QuickOpenActionOptions, Disposable {
    run(item?: QuickOpenItem): PromiseLike<void>;
}

export enum QuickTitleButtonSide {
    LEFT = 0,
    RIGHT = 1
}

export interface QuickTitleButton {
    icon: string; // a background image coming from a url
    iconClass?: string; // a class such as one coming from font awesome
    tooltip?: string | undefined;
    side: QuickTitleButtonSide
}
