import { ContainerModule } from 'inversify';
import { WindowService } from '../../browser/window/window-service';
import { ElectronWindowService } from './electron-window-service';
import { FrontendApplicationContribution } from '../../browser/frontend-application';
import { ElectronClipboardService } from '../electron-clipboard-service';
import { ClipboardService } from '../../browser/clipboard-service';

export default new ContainerModule(bind => {
    bind(WindowService).to(ElectronWindowService).inSingletonScope();
    bind(FrontendApplicationContribution).toService(WindowService);
    bind(ClipboardService).to(ElectronClipboardService).inSingletonScope();
});
