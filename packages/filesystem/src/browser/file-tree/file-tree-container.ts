import { Container, interfaces } from 'inversify';
import { createTreeContainer, Tree, TreeImpl, TreeModel, TreeModelImpl, TreeWidget } from "@viz/core/lib/browser";
import { FileTree } from "./file-tree";
import { FileTreeModel } from './file-tree-model';
import { FileTreeWidget } from "./file-tree-widget";

export function createFileTreeContainer(parent: interfaces.Container): Container {
    const child = createTreeContainer(parent);

    child.unbind(TreeImpl);
    child.bind(FileTree).toSelf();
    child.rebind(Tree).toDynamicValue(ctx => ctx.container.get(FileTree));

    child.unbind(TreeModelImpl);
    child.bind(FileTreeModel).toSelf();
    child.rebind(TreeModel).toDynamicValue(ctx => ctx.container.get(FileTreeModel));

    child.unbind(TreeWidget);
    child.bind(FileTreeWidget).toSelf();

    return child;
}
