import { inject, injectable } from 'inversify';
import { Command, CommandContribution, CommandHandler, CommandRegistry } from '../common/command';
import { Emitter, Event } from '../common/event';
import { QuickOpenItem, QuickOpenMode, QuickOpenModel } from './quick-open/quick-open-model';
import { QuickOpenService } from './quick-open/quick-open-service';

export const ThemeServiceSymbol = Symbol('ThemeService');

export interface Theme {
    id: string;
    label: string;
    description?: string;
    editorTheme?: string;
    activate(): void;
    deactivate(): void;
}

export interface ThemeChangeEvent {
    newTheme: Theme;
    oldTheme?: Theme;
}

export class ThemeService {

    private themes: { [id: string]: Theme } = {};
    private activeTheme: Theme | undefined;
    private readonly themeChange = new Emitter<ThemeChangeEvent>();

    readonly onThemeChange: Event<ThemeChangeEvent> = this.themeChange.event;

    static get() {
        const global = window as any; // tslint:disable-line
        return global[ThemeServiceSymbol] || new ThemeService();
    }

    protected constructor(
        public defaultTheme: string = 'dark'
    ) {
        const global = window as any; // tslint:disable-line
        global[ThemeServiceSymbol] = this;
    }

    register(...themes: Theme[]) {
        for (const theme of themes) {
            this.themes[theme.id] = theme;
        }
    }

    getThemes() {
        const result = [];
        for (const o in this.themes) {
            if (this.themes.hasOwnProperty(o)) {
                result.push(this.themes[o]);
            }
        }
        return result;
    }

    getTheme(themeId: string) {
        return this.themes[themeId] || this.themes[this.defaultTheme];
    }

    startupTheme() {
        const theme = this.getCurrentTheme();
        theme.activate();
    }

    loadUserTheme() {
        const theme = this.getCurrentTheme();
        this.setCurrentTheme(theme.id);
    }

    setCurrentTheme(themeId: string) {
        const newTheme = this.getTheme(themeId);
        const oldTheme = this.activeTheme;
        if (oldTheme) {
            oldTheme.deactivate();
        }
        newTheme.activate();
        this.activeTheme = newTheme;
        window.localStorage.setItem('theme', themeId);
        this.themeChange.fire({
            newTheme, oldTheme
        });
    }

    getCurrentTheme(): Theme {
        const themeId = window.localStorage.getItem('theme') || this.defaultTheme;
        return this.themes[themeId] || this.themes[this.defaultTheme];
    }

}

@injectable()
export class ThemingCommandContribution implements CommandContribution, CommandHandler, Command, QuickOpenModel {

    id = 'change_theme';
    label = 'Change Color Theme';
    private resetTo: string | undefined;

    @inject(ThemeService)
    protected readonly themeService: ThemeService;

    @inject(QuickOpenService)
    protected readonly openService: QuickOpenService;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(this, this);
    }

    execute() {
        this.resetTo = this.themeService.getCurrentTheme().id;
        this.openService.open(this, {
            placeholder: 'Select Color Theme (Up/Down Keys to Preview)',
            fuzzyMatchLabel: true,
            selectIndex: () => this.activeIndex(),
            onClose: () => {
                if (this.resetTo) {
                    this.themeService.setCurrentTheme(this.resetTo);
                }
            }
        });
    }

    private activeIndex() {
        const current = this.themeService.getCurrentTheme().id;
        const themes = this.themeService.getThemes();
        return themes.findIndex(theme => theme.id === current);
    }

    onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
        const items = this.themeService.getThemes().map(t =>
            new QuickOpenItem({
                label: t.label,
                description: t.description,
                run: (mode: QuickOpenMode) => {
                    if (mode === QuickOpenMode.OPEN) {
                        this.resetTo = undefined;
                    }
                    this.themeService.setCurrentTheme(t.id);
                    return true;
                }
            }));
        acceptor(items);
    }
}

export class BuiltinThemeProvider {

    // Webpack converts these `require` in some Javascript object that wraps the `.css` files
    static readonly darkCss = require('../../src/browser/style/variables-dark.useable.css');
    static readonly lightCss = require('../../src/browser/style/variables-bright.useable.css');

    static readonly darkTheme = {
        id: 'dark',
        label: 'Dark Theme',
        description: 'Bright fonts on dark backgrounds.',
        editorTheme: 'vs-dark',
        activate() {
            BuiltinThemeProvider.darkCss.use();
        },
        deactivate() {
            BuiltinThemeProvider.darkCss.unuse();
        }
    };

    static readonly lightTheme = {
        id: 'light',
        label: 'Light Theme',
        description: 'Dark fonts on light backgrounds.',
        editorTheme: 'vs',
        activate() {
            BuiltinThemeProvider.lightCss.use();
        },
        deactivate() {
            BuiltinThemeProvider.lightCss.unuse();
        }
    };

    static readonly themes = [
        BuiltinThemeProvider.darkTheme,
        BuiltinThemeProvider.lightTheme,
    ];
}
