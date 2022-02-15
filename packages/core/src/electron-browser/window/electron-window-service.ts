import { injectable } from 'inversify';
import { ipcRenderer } from 'electron';
import { DefaultWindowService } from '../../browser/window/default-window-service';
import { NewWindowOptions } from 'src/browser/window/window-service';

@injectable()
export class ElectronWindowService extends DefaultWindowService {

    openNewWindow(url: string, { external }: NewWindowOptions = {}): undefined {
        if (external) {
            ipcRenderer.send('open-external', url);
        } else {
            ipcRenderer.send('create-new-window', url);
        }
        return undefined;
    }

    protected preventUnload(event: BeforeUnloadEvent): string | void {
        // The user will be shown a confirmation dialog by the will-prevent-unload handler in the Electron main script
        event.returnValue = false;
    }

}
