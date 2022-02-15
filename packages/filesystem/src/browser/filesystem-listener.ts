

import { injectable } from "inversify";
import { ConfirmDialog } from "@viz/core/lib/browser";
import { FileStat, FileSystem, FileSystemClient } from "../common";

@injectable()
export class FileSystemListener implements FileSystemClient {

    protected filesystem: FileSystem;
    listen(filesystem: FileSystem): void {
        filesystem.setClient(this);
        this.filesystem = filesystem;
    }

    async shouldOverwrite(file: FileStat, stat: FileStat): Promise<boolean> {
        const dialog = new ConfirmDialog({
            title: `The file '${file.uri}' has been changed on the file system.`,
            msg: 'Do you want to overwrite the changes made on the file system?',
            ok: 'Yes',
            cancel: 'No'
        });
        return dialog.open();
    }

}
