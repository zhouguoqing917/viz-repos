import { inject, injectable, postConstruct } from 'inversify';
import { Emitter } from '../common/event';
import { Disposable, DisposableCollection } from '../common/disposable';
import { DidChangeLabelEvent, LabelProviderContribution } from './label-provider';

export interface IconThemeDefinition {
    readonly id: string
    readonly label: string
    readonly description?: string
    readonly hasFileIcons?: boolean;
    readonly hasFolderIcons?: boolean;
    readonly hidesExplorerArrows?: boolean;
}

export interface IconTheme extends IconThemeDefinition {
    activate(): Disposable;
}

@injectable()
export class NoneIconTheme implements IconTheme, LabelProviderContribution {

    readonly id = 'none';
    readonly label = 'None';
    readonly description = 'Disable file icons';
    readonly hasFileIcons = true;
    readonly hasFolderIcons = true;

    protected readonly onDidChangeEmitter = new Emitter<DidChangeLabelEvent>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    protected readonly toDeactivate = new DisposableCollection();

    activate(): Disposable {
        if (this.toDeactivate.disposed) {
            this.toDeactivate.push(Disposable.create(() => this.fireDidChange()));
            this.fireDidChange();
        }
        return this.toDeactivate;
    }

    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire({ affects: () => true });
    }

    canHandle(): number {
        if (this.toDeactivate.disposed) {
            return 0;
        }
        return Number.MAX_SAFE_INTEGER;
    }

    getIcon(): string {
        return '';
    }

}

@injectable()
export class IconThemeService {

    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    protected readonly _iconThemes = new Map<string, IconTheme>();
    get ids(): IterableIterator<string> {
        return this._iconThemes.keys();
    }
    get definitions(): IterableIterator<IconThemeDefinition> {
        return this._iconThemes.values();
    }
    getDefinition(id: string): IconThemeDefinition | undefined {
        return this._iconThemes.get(id);
    }

    @inject(NoneIconTheme)
    protected readonly noneIconTheme: NoneIconTheme;

    protected readonly onDidChangeCurrentEmitter = new Emitter<string>();
    readonly onDidChangeCurrent = this.onDidChangeCurrentEmitter.event;

    protected _default: IconTheme;

    protected readonly toDeactivate = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this._default = this.noneIconTheme;
        this.register(this.noneIconTheme);
    }

    register(iconTheme: IconTheme): Disposable {
        if (this._iconThemes.has(iconTheme.id)) {
            console.warn(new Error(`Icon theme '${iconTheme.id}' has already been registered, skipping.`));
            return Disposable.NULL;
        }
        this._iconThemes.set(iconTheme.id, iconTheme);
        this.onDidChangeEmitter.fire(undefined);
        if (this.toDeactivate.disposed
            && window.localStorage.getItem('iconTheme') === iconTheme.id) {
            this.setCurrent(iconTheme);
        }
        return Disposable.create(() => this.unregister(iconTheme.id));
    }

    unregister(id: string): IconTheme | undefined {
        const iconTheme = this._iconThemes.get(id);
        if (!iconTheme) {
            return undefined;
        }
        this._iconThemes.delete(id);
        if (this._default === iconTheme) {
            this._default = this.noneIconTheme;
        }
        if (window.localStorage.getItem('iconTheme') === id) {
            window.localStorage.removeItem('iconTheme');
            this.onDidChangeCurrentEmitter.fire(this._default.id);
        }
        this.onDidChangeEmitter.fire(undefined);
        return iconTheme;
    }

    get current(): string {
        return this.getCurrent().id;
    }

    set current(id: string) {
        const newCurrent = this._iconThemes.get(id) || this._default;
        if (this.getCurrent().id !== newCurrent.id) {
            this.setCurrent(newCurrent);
        }
    }

    protected getCurrent(): IconTheme {
        const id = window.localStorage.getItem('iconTheme');
        return id && this._iconThemes.get(id) || this._default;
    }

    protected setCurrent(current: IconTheme): void {
        window.localStorage.setItem('iconTheme', current.id);
        this.toDeactivate.dispose();
        this.toDeactivate.push(current.activate());
        this.onDidChangeCurrentEmitter.fire(current.id);
    }

    get default(): string {
        return this._default.id;
    }

    set default(id: string) {
        const newDefault = this._iconThemes.get(id) || this.noneIconTheme;
        if (this._default.id === newDefault.id) {
            return;
        }
        this._default = newDefault;
        if (!window.localStorage.getItem('iconTheme')) {
            this.onDidChangeCurrentEmitter.fire(newDefault.id);
        }
    }

    protected load(): string | undefined {
        return window.localStorage.getItem('iconTheme') || undefined;
    }

}
