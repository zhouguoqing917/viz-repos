import { inject, injectable, postConstruct } from "inversify";
import { Emitter, Event } from "@viz/core/lib/common";
import { TreeNode } from "@viz/core/lib/browser";
import { DirNode, FileNode, FileTree, FileTreeModel } from '../file-tree';

@injectable()
export class FileDialogModel extends FileTreeModel {

    @inject(FileTree) protected readonly tree: FileTree;
    protected readonly onDidOpenFileEmitter = new Emitter<void>();

    @postConstruct()
    protected init(): void {
        super.init();
        this.toDispose.push(this.onDidOpenFileEmitter);
    }

    get onDidOpenFile(): Event<void> {
        return this.onDidOpenFileEmitter.event;
    }

    protected doOpenNode(node: TreeNode): void {
        if (FileNode.is(node)) {
            this.onDidOpenFileEmitter.fire(undefined);
        } else if (DirNode.is(node)) {
            this.navigateTo(node);
        } else {
            super.doOpenNode(node);
        }
    }

}
