import { ContainerModule } from 'inversify';
import { WindowService } from '../../browser/window/window-service';
import { DefaultWindowService } from '../../browser/window/default-window-service';
import { FrontendApplicationContribution } from '../frontend-application';


export default new ContainerModule(bind => {
    bind(DefaultWindowService).toSelf().inSingletonScope();
    bind(WindowService).toService(DefaultWindowService);
    bind(FrontendApplicationContribution).toService(DefaultWindowService);
 
});
