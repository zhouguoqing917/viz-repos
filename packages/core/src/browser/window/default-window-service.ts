 

import { inject, injectable, named } from 'inversify';

import { ContributionProvider } from '../../common/contribution-provider';
import { FrontendApplication, FrontendApplicationContribution } from '../frontend-application';
import { WindowService } from './window-service';

@injectable()
export class DefaultWindowService implements WindowService, FrontendApplicationContribution {

    protected frontendApplication: FrontendApplication;

    @inject(ContributionProvider)
    @named(FrontendApplicationContribution)
    protected readonly contributions: ContributionProvider<FrontendApplicationContribution>;

    onStart(app: FrontendApplication): void {
        this.frontendApplication = app;
        window.addEventListener('beforeunload', event => {
            if (!this.canUnload()) {
                return this.preventUnload(event);
            }
        });
    }

    openNewWindow(url: string): undefined {
        window.open(url, undefined, 'noopener');
        return undefined;
    }

    canUnload(): boolean {
     
        for (const contribution of this.contributions.getContributions()) {
            if (contribution.onWillStop) {
                if (contribution.onWillStop(this.frontendApplication)) {
                    return false;
                }
            }
        }
        return true;
       
    }

    /**
     * Ask the user to confirm if they want to unload the window. Prevent it if they do not.
     * @param event The beforeunload event
     */
    protected preventUnload(event: BeforeUnloadEvent): string | void {
        event.returnValue = '';
        event.preventDefault();
        return '';
    }

}
