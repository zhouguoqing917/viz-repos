import { inject, injectable } from "inversify";
import URI from '@viz/core/lib/common/uri';
import { CompositeTreeNode, ExpandableTreeNode, SelectableTreeNode, TreeImpl, TreeNode } from "@viz/core/lib/browser";
import { FileStat, FileSystem } from "../../common";
import { LabelProvider } from "@viz/core/lib/browser/label-provider";
import { UriSelection } from '@viz/core/lib/common/selection';

@injectable()
export class FileTree extends TreeImpl {

    @inject(FileSystem) protected readonly fileSystem: FileSystem;
    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;

    async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (FileStatNode.is(parent)) {
            const fileStat = await this.resolveFileStat(parent);
            if (fileStat) {
                return this.toNodes(fileStat, parent);
            }

            return [];
        }
        return super.resolveChildren(parent);
    }

    protected resolveFileStat(node: FileStatNode): Promise<FileStat | undefined> {
        return this.fileSystem.getFileStat(node.fileStat.uri).then(fileStat => {
            if (fileStat) {
                node.fileStat = fileStat;
                return fileStat;
            }
            return undefined;
        });
    }

    protected async toNodes(fileStat: FileStat, parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (!fileStat.children) {
            return [];
        }
        const result = await Promise.all(fileStat.children.map(async child =>
            await this.toNode(child, parent)
        ));
        return result.sort(DirNode.compare);
    }

    protected async toNode(fileStat: FileStat, parent: CompositeTreeNode): Promise<FileNode | DirNode> {
        const uri = new URI(fileStat.uri);
        const name = await this.labelProvider.getName(uri);
        const icon = await this.labelProvider.getIcon(fileStat);
        const id = fileStat.uri;
        const node = this.getNode(id);
        if (fileStat.isDirectory) {
            if (DirNode.is(node)) {
                node.fileStat = fileStat;
                return node;
            }
            return <DirNode>{
                id, uri, fileStat, name, icon, parent,
                expanded: false,
                selected: false,
                children: []
            };
        }
        if (FileNode.is(node)) {
            node.fileStat = fileStat;
            return node;
        }
        return <FileNode>{
            id, uri, fileStat, name, icon, parent,
            selected: false
        };
    }

}

export interface FileStatNode extends SelectableTreeNode, UriSelection {
    fileStat: FileStat;
}
export namespace FileStatNode {
    export function is(node: TreeNode | undefined): node is FileStatNode {
        return !!node && 'fileStat' in node;
    }
}

export type FileNode = FileStatNode;
export namespace FileNode {
    export function is(node: TreeNode | undefined): node is FileNode {
        return FileStatNode.is(node) && !node.fileStat.isDirectory;
    }
}

export type DirNode = FileStatNode & ExpandableTreeNode;
export namespace DirNode {
    export function is(node: TreeNode | undefined): node is DirNode {
        return FileStatNode.is(node) && node.fileStat.isDirectory;
    }

    export function compare(node: TreeNode, node2: TreeNode): number {
        return DirNode.dirCompare(node, node2) || node.name.localeCompare(node2.name);
    }

    export function dirCompare(node: TreeNode, node2: TreeNode): number {
        const a = DirNode.is(node) ? 1 : 0;
        const b = DirNode.is(node2) ? 1 : 0;
        return b - a;
    }

    export function createRoot(fileStat: FileStat, name: string, icon: string): DirNode {
        const uri = new URI(fileStat.uri);
        const id = fileStat.uri;
        return {
            id, uri, fileStat,
            name,
            icon,
            visible: true,
            parent: undefined,
            children: [],
            expanded: true,
            selected: false
        };
    }

    export function getContainingDir(node: TreeNode | undefined): DirNode | undefined {
        let containing = node;
        while (!!containing && !is(containing)) {
            containing = containing.parent;
        }
        return containing;
    }
}
