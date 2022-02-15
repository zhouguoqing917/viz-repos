import { clipboard } from 'electron';
import { injectable } from 'inversify';
import { ClipboardService } from '../browser/clipboard-service';

@injectable()
export class ElectronClipboardService implements ClipboardService {

    readText(): string {
        return clipboard.readText();
    }

    writeText(value: string): void {
        clipboard.writeText(value);
    }

}
