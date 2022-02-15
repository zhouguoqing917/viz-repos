import { Container, interfaces } from "inversify";
import { TreeModel } from "@viz/core/lib/browser";
import { createFileTreeContainer, FileTreeModel, FileTreeWidget } from '../file-tree';
import { FileDialog, FileDialogProps } from "./file-dialog";
import { FileDialogModel } from "./file-dialog-model";
import { FileDialogWidget } from './file-dialog-widget';

export function createFileDialogContainer(parent: interfaces.Container): Container {
    const child = createFileTreeContainer(parent);

    child.unbind(FileTreeModel);
    child.bind(FileDialogModel).toSelf();
    child.rebind(TreeModel).toDynamicValue(ctx => ctx.container.get(FileDialogModel));

    child.unbind(FileTreeWidget);
    child.bind(FileDialogWidget).toSelf();

    child.bind(FileDialog).toSelf();

    return child;
}

export function createFileDialog(parent: interfaces.Container, props: FileDialogProps): FileDialog {
    const container = createFileDialogContainer(parent);
    container.bind(FileDialogProps).toConstantValue(props);
    return container.get(FileDialog);
}
