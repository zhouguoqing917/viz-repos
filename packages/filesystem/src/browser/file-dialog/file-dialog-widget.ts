import { inject, injectable } from "inversify";
import { ContextMenuRenderer, TreeProps } from "@viz/core/lib/browser";
import { FileTreeWidget } from "../file-tree";
import { FileDialogModel } from "./file-dialog-model";

export const FILE_DIALOG_CLASS = 'theia-FileDialog';

@injectable()
export class FileDialogWidget extends FileTreeWidget {

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(FileDialogModel) readonly model: FileDialogModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer
    ) {
        super(props, model, contextMenuRenderer);
        this.addClass(FILE_DIALOG_CLASS);
    }

}
