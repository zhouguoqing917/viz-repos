import { inject, injectable, named } from 'inversify';
import { FrontendApplicationContribution } from './frontend-application';
import { ContributionProvider } from '../common/contribution-provider';
import { IconTheme, IconThemeService } from './icon-theme-service';
import { MaybePromise } from '../common/types';
import { Disposable } from '../common/disposable';

export const IconThemeContribution = Symbol('IconThemeContribution');
export interface IconThemeContribution {
    registerIconThemes(iconThemes: IconThemeService): MaybePromise<void>;
}

@injectable()
export class IconThemeApplicationContribution implements FrontendApplicationContribution {

    @inject(IconThemeService)
    protected readonly iconThemes: IconThemeService;

    @inject(ContributionProvider) @named(IconThemeContribution)
    protected readonly iconThemeContributions: ContributionProvider<IconThemeContribution>;

    async onStart(): Promise<void> {
        for (const contribution of this.iconThemeContributions.getContributions()) {
            await contribution.registerIconThemes(this.iconThemes);
        }
    }

}

@injectable()
export class DefaultFileIconThemeContribution implements IconTheme, IconThemeContribution {

    readonly id = 'file-icons';
    readonly label = 'File Icons';
    readonly hasFileIcons = true;
    readonly hasFolderIcons = true;

    registerIconThemes(iconThemes: IconThemeService): MaybePromise<void> {
        iconThemes.register(this);
        iconThemes.default = this.id;
    }

    /* rely on behaviour before for backward-compatibility */
    activate(): Disposable {
        return Disposable.NULL;
    }

}
