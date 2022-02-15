import { inject, injectable, postConstruct } from "inversify";
import URI from '@viz/core/lib/common/uri';
import { CompositeTreeNode, ConfirmDialog, TreeModelImpl, TreeNode } from "@viz/core/lib/browser";
import { FileSystem, } from "../../common";
import { FileChange, FileChangeType, FileSystemWatcher } from '../filesystem-watcher';
import { DirNode, FileNode, FileStatNode } from "./file-tree";
import { LocationService } from '../location';
import { LabelProvider } from "@viz/core/lib/browser/label-provider";
import * as base64 from 'base64-js';

@injectable()
export class FileTreeModel extends TreeModelImpl implements LocationService {

    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;
    @inject(FileSystem) protected readonly fileSystem: FileSystem;
    @inject(FileSystemWatcher) protected readonly watcher: FileSystemWatcher;

    @postConstruct()
    protected init(): void {
        super.init();
        this.toDispose.push(this.watcher.onFilesChanged(changes => this.onFilesChanged(changes)));
    }

    get location(): URI | undefined {
        const root = this.root;
        if (FileStatNode.is(root)) {
            return root.uri;
        }
        return undefined;
    }

    set location(uri: URI | undefined) {
        if (uri) {
            this.fileSystem.getFileStat(uri.toString()).then(async fileStat => {
                if (fileStat) {
                    const label = this.labelProvider.getName(uri);
                    const icon = await this.labelProvider.getIcon(fileStat);
                    const node = DirNode.createRoot(fileStat, label, icon);
                    this.navigateTo(node);
                }
            });
        } else {
            this.navigateTo(undefined);
        }
    }

    get selectedFileStatNodes(): Readonly<FileStatNode>[] {
        return this.selectedNodes.filter(FileStatNode.is);
    }

    protected onFilesChanged(changes: FileChange[]): void {
        const affectedNodes = this.getAffectedNodes(changes);
        if (affectedNodes.length !== 0) {
            affectedNodes.forEach(node => this.refresh(node));
        } else if (this.isRootAffected(changes)) {
            this.refresh();
        }
    }

    protected isRootAffected(changes: FileChange[]): boolean {
        const root = this.root;
        if (FileStatNode.is(root)) {
            return changes.some(change =>
                change.type < FileChangeType.DELETED && change.uri.toString() === root.uri.toString()
            );
        }
        return false;
    }

    protected getAffectedNodes(changes: FileChange[]): CompositeTreeNode[] {
        const nodes = new Map<string, CompositeTreeNode>();
        for (const change of changes) {
            this.collectAffectedNodes(change, node => nodes.set(node.id, node));
        }
        return [...nodes.values()];
    }

    protected collectAffectedNodes(change: FileChange, accept: (node: CompositeTreeNode) => void): void {
        if (this.isFileContentChanged(change)) {
            return;
        }
        const parent = this.getNode(change.uri.parent.toString());
        if (DirNode.is(parent) && parent.expanded) {
            accept(parent);
        }
    }
    protected isFileContentChanged(change: FileChange): boolean {
        return change.type === FileChangeType.UPDATED && FileNode.is(this.getNode(change.uri.toString()));
    }

    copy(uri: URI): boolean {
        if (uri.scheme !== 'file') {
            return false;
        }
        const node = this.selectedFileStatNodes[0];
        if (!node) {
            return false;
        }
        const targetUri = node.uri.resolve(uri.path.base);
        this.fileSystem.copy(uri.toString(), targetUri.toString());
        return true;
    }

    /**
     * Move the given source file or directory to the given target directory.
     */
    async move(source: TreeNode, target: TreeNode) {
        if (DirNode.is(target) && FileStatNode.is(source)) {
            const sourceUri = source.uri.toString();
            if (target.uri.toString() === sourceUri) { /*  Folder on itself */
                return;
            }
            const targetUri = target.uri.resolve(source.name).toString();
            if (sourceUri !== targetUri) { /*  File not on itself */
                const fileExistsInTarget = await this.fileSystem.exists(targetUri);
                if (!fileExistsInTarget || await this.shouldReplace(source.name)) {
                    await this.fileSystem.move(sourceUri, targetUri, { overwrite: true });
                    // to workaround https://github.com/Axosoft/nsfw/issues/42
                    this.refresh(target);
                }
            }
        }
    }

    protected async shouldReplace(fileName: string): Promise<boolean> {
        const dialog = new ConfirmDialog({
            title: 'Replace file',
            msg: `File '${fileName}' already exists in the destination folder. Do you want to replace it?`,
            ok: 'Yes',
            cancel: 'No'
        });
        return dialog.open();
    }

    upload(node: DirNode, items: DataTransferItemList): void {
        for (let i = 0; i < items.length; i++) { 
            const entry = items[i].webkitGetAsEntry();
            this.uploadEntry(node.uri, entry);
        }
    }

    protected uploadEntry(base: URI, entry:any): void {
        if (!entry) {
            return;
        }
        if (entry.isDirectory) {
            this.uploadDirectoryEntry(base, entry as any);
        } else {
            this.uploadFileEntry(base, entry as any);
        }
    }

    protected async uploadDirectoryEntry(base: URI, entry: any): Promise<void> {
        const newBase = base.resolve(entry.name);
        const uri = newBase.toString();
        if (!await this.fileSystem.exists(uri)) {
            await this.fileSystem.createFolder(uri);
        }
        this.readEntries(entry, items => this.uploadEntries(newBase, items));
    }

    /**
     *  Read all entries within a folder by block of 100 files or folders until the
     *  whole folder has been read.
     */
    protected readEntries(entry: any, cb: (items: any) => void): void {
        const reader = entry.createReader();
        const getEntries = () => {
            reader.readEntries((results:any) => {
                if (results) {
                    cb(results);
                    getEntries(); // loop to read all entries
                }
            });
        };
        getEntries();
    }

    protected uploadEntries(base: URI, entries: any[]): void {
        for (let i = 0; i < entries.length; i++) {
            this.uploadEntry(base, entries[i]);
        }
    }

    protected uploadFileEntry(base: URI, entry: any): void {
        entry.file((file:any) => this.uploadFile(base, file as any));
    }

    protected uploadFile(base: URI, file: File): void {
        const reader = new FileReader();
        reader.onload = () => this.uploadFileContent(base.resolve(file.name), reader.result as any);
        reader.readAsArrayBuffer(file);
    }

    protected async uploadFileContent(base: URI, fileContent: Iterable<number>): Promise<void> {
        const uri = base.toString();
        const encoding = 'base64';
        const content = base64.fromByteArray(new Uint8Array(fileContent));
        const stat = await this.fileSystem.getFileStat(uri);
        if (stat) {
            if (!stat.isDirectory) {
                await this.fileSystem.setContent(stat, content, { encoding });
            }
        } else {
            await this.fileSystem.createFile(uri, { content, encoding });
        }
    }
}
