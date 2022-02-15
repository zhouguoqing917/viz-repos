
import mv from 'mv';
import trash from 'trash';
import * as paths from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import touch from 'touch';
import { inject, injectable, optional } from 'inversify';
import URI from '@viz/core/lib/common/uri';
import { FileUri } from '@viz/core/lib/node/file-uri';
import { FileStat, FileSystem, FileSystemClient } from '../common/filesystem';
import { TextDocument } from 'vscode-languageserver-types';

@injectable()
export class FileSystemNodeOptions {

    encoding: string;
    recursive: boolean;
    overwrite: boolean;
    moveToTrash: true;

    public static DEFAULT: FileSystemNodeOptions = {
        encoding: 'utf8',
        overwrite: false,
        recursive: true,
        moveToTrash: true
    };

}

@injectable()
export class FileSystemNode implements FileSystem {

    constructor(
        @inject(FileSystemNodeOptions) @optional() protected readonly options: FileSystemNodeOptions = FileSystemNodeOptions.DEFAULT
    ) { }

    protected client: FileSystemClient | undefined;
    setClient(client: FileSystemClient | undefined): void {
        this.client = client;
    }

    async getFileStat(uri: string): Promise<FileStat | undefined> {
        const uri_ = new URI(uri);
        const stat = await this.doGetStat(uri_, 1);
        return stat;
    }

    async exists(uri: string): Promise<boolean> {
        return fs.pathExists(FileUri.fsPath(new URI(uri)));
    }

    async resolveContent(uri: string, options?: { encoding?: string }): Promise<{ stat: FileStat, content: string }> {
        const _uri = new URI(uri);
        const stat = await this.doGetStat(_uri, 0);
        if (!stat) {
            throw new Error(`Cannot find file under the given URI. URI: ${uri}.`);
        }
        if (stat.isDirectory) {
            throw new Error(`Cannot resolve the content of a directory. URI: ${uri}.`);
        }
        const encoding = await this.doGetEncoding(options);
        const content = await fs.readFile(FileUri.fsPath(_uri), { encoding });
        return { stat, content };
    }

    async setContent(file: FileStat, content: string, options?: { encoding?: string }): Promise<FileStat> {
        const _uri = new URI(file.uri);
        const stat = await this.doGetStat(_uri, 0);
        if (!stat) {
            throw new Error(`Cannot find file under the given URI. URI: ${file.uri}.`);
        }
        if (stat.isDirectory) {
            throw new Error(`Cannot set the content of a directory. URI: ${file.uri}.`);
        }
        if (!(await this.isInSync(file, stat))) {
            throw this.createOutOfSyncError(file, stat);
        }
        const encoding = await this.doGetEncoding(options) || 'utf8';
        await fs.writeFile(FileUri.fsPath(_uri), content, { encoding: encoding as any});
        const newStat = await this.doGetStat(_uri, 1);
        if (newStat) {
            return newStat;
        }
        throw new Error(`Error occurred while writing file content. The file does not exist under ${file.uri}.`);
    }

    async updateContent(file: FileStat, contentChanges: any[], options?: { encoding?: string }): Promise<FileStat> {
        const _uri = new URI(file.uri);
        const stat = await this.doGetStat(_uri, 0);
        if (!stat) {
            throw new Error(`Cannot find file under the given URI. URI: ${file.uri}.`);
        }
        if (stat.isDirectory) {
            throw new Error(`Cannot set the content of a directory. URI: ${file.uri}.`);
        }
        if (!this.checkInSync(file, stat)) {
            throw this.createOutOfSyncError(file, stat);
        }
        if (contentChanges.length === 0) {
            return stat;
        }
        const encoding = await this.doGetEncoding(options);
        const content = await fs.readFile(FileUri.fsPath(_uri), { encoding });
        const newContent = this.applyContentChanges(content, contentChanges);
        await fs.writeFile(FileUri.fsPath(_uri), newContent, { encoding:encoding as any });
        const newStat = await this.doGetStat(_uri, 1);
        if (newStat) {
            return newStat;
        }
        throw new Error(`Error occurred while writing file content. The file does not exist under ${file.uri}.`);
    }
    protected applyContentChanges(content: string, contentChanges: any[]): string {
        let document = TextDocument.create('', '', 1, content);
        for (const change of contentChanges) {
            let newContent = change.text;
            if (change.range) {
                const start = document.offsetAt(change.range.start);
                const end = document.offsetAt(change.range.end);
                newContent = document.getText().substr(0, start) + change.text + document.getText().substr(end);
            }
            document = TextDocument.create(document.uri, document.languageId, document.version, newContent);
        }
        return document.getText();
    }

    protected async isInSync(file: FileStat, stat: FileStat): Promise<boolean> {
        if (this.checkInSync(file, stat)) {
            return true;
        }
        return this.client ? this.client.shouldOverwrite(file, stat) : false;
    }
    protected checkInSync(file: FileStat, stat: FileStat): boolean {
        return stat.lastModification === file.lastModification && stat.size === file.size;
    }
    protected createOutOfSyncError(file: FileStat, stat: FileStat): Error {
        return new Error(`File is out of sync. URI: ${file.uri}.
Expected: ${JSON.stringify(stat)}.
Actual: ${JSON.stringify(file)}.`);
    }

    async move(sourceUri: string, targetUri: string, options?: { overwrite?: boolean }): Promise<FileStat> {
        const _sourceUri = new URI(sourceUri);
        const _targetUri = new URI(targetUri);
        const [sourceStat, targetStat, overwrite] = await Promise.all([this.doGetStat(_sourceUri, 1), this.doGetStat(_targetUri, 1), this.doGetOverwrite(options)]);
        if (!sourceStat) {
            throw new Error(`File does not exist under ${sourceUri}.`);
        }
        if (targetStat && !overwrite) {
            throw new Error(`File already exists under the '${targetUri}' target location. Did you set the 'overwrite' flag to true?`);
        }

        // Different types. Files <-> Directory.
        if (targetStat && sourceStat.isDirectory !== targetStat.isDirectory) {
            const label: (stat: FileStat) => string = stat => stat.isDirectory ? 'directory' : 'file';
            const message = `Cannot move a ${label(sourceStat)} to an existing ${label(targetStat)} location. Source URI: ${sourceUri}. Target URI: ${targetUri}.`;
            throw new Error(message);
        }

        const [sourceMightHaveChildren, targetMightHaveChildren] = await Promise.all([this.mayHaveChildren(_sourceUri), this.mayHaveChildren(_targetUri)]);
        // Handling special Windows case when source and target resources are empty folders.
        // Source should be deleted and target should be touched.
        if (overwrite && targetStat && targetStat.isDirectory && sourceStat.isDirectory && !sourceMightHaveChildren && !targetMightHaveChildren) {
            // The value should be a Unix timestamp in seconds.
            // For example, `Date.now()` returns milliseconds, so it should be divided by `1000` before passing it in.
            const now = Date.now() / 1000;
            await fs.utimes(FileUri.fsPath(_targetUri), now, now);
            await fs.rmdir(FileUri.fsPath(_sourceUri));
            const newStat = await this.doGetStat(_targetUri, 1);
            if (newStat) {
                return newStat;
            }
            throw new Error(`Error occurred when moving resource from ${sourceUri} to ${targetUri}. Resource does not exist at ${targetUri}.`);
        } else if (overwrite && targetStat && targetStat.isDirectory && sourceStat.isDirectory && !targetMightHaveChildren && sourceMightHaveChildren) {
            // Copy source to target, since target is empty. Then wipe the source content.
            const newStat = await this.copy(sourceUri, targetUri, { overwrite });
            await this.delete(sourceUri);
            return newStat;
        } else {
            return new Promise<FileStat>((resolve, reject) => {
                mv(FileUri.fsPath(_sourceUri), FileUri.fsPath(_targetUri), { mkdirp: true, clobber: overwrite }, async error => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(await this.doGetStat(_targetUri, 1) as any);
                });
            });
        }
    }

    async copy(sourceUri: string, targetUri: string, options?: { overwrite?: boolean, recursive?: boolean }): Promise<FileStat> {
        const _sourceUri = new URI(sourceUri);
        const _targetUri = new URI(targetUri);
        const [sourceStat, targetStat, overwrite, recursive] = await Promise.all([
            this.doGetStat(_sourceUri, 0),
            this.doGetStat(_targetUri, 0),
            this.doGetOverwrite(options),
            this.doGetRecursive(options)
        ]);
        if (!sourceStat) {
            throw new Error(`File does not exist under ${sourceUri}.`);
        }
        if (targetStat && !overwrite) {
            throw new Error(`File already exist under the '${targetUri}' target location. Did you set the 'overwrite' flag to true?`);
        }
        await fs.copy(FileUri.fsPath(_sourceUri), FileUri.fsPath(_targetUri), { overwrite, recursive });
        const newStat = await this.doGetStat(_targetUri, 1);
        if (newStat) {
            return newStat;
        }
        throw new Error(`Error occurred while copying ${sourceUri} to ${targetUri}. The file does not exist at ${targetUri}.`);
    }

    async createFile(uri: string, options?: { content?: string, encoding?: string }): Promise<FileStat> {
        const _uri = new URI(uri);
        const parentUri = _uri.parent;
        const [stat, parentStat] = await Promise.all([this.doGetStat(_uri, 0), this.doGetStat(parentUri, 0)]);
        if (stat) {
            throw new Error(`Error occurred while creating the file. File already exists at ${uri}.`);
        }
        if (!parentStat) {
            await fs.mkdirs(FileUri.fsPath(parentUri));
        }
        const content = await this.doGetContent(options);
        const encoding = await this.doGetEncoding(options);
        fs.writeFile(FileUri.fsPath(_uri), content, { encoding:encoding as any });
        const newStat = await this.doGetStat(_uri, 1);
        if (newStat) {
            return newStat;
        }
        throw new Error(`Error occurred while creating new file. The file does not exist at ${uri}.`);
    }

    async createFolder(uri: string): Promise<FileStat> {
        const _uri = new URI(uri);
        const stat = await this.doGetStat(_uri, 0);
        if (stat) {
            throw new Error(`Error occurred while creating the directory. File already exists at ${uri}.`);
        }
        await fs.mkdirs(FileUri.fsPath(_uri));
        const newStat = await this.doGetStat(_uri, 1);
        if (newStat) {
            return newStat;
        }
        throw new Error(`Error occurred while creating the directory. The directory does not exist at ${uri}.`);
    }

    async touchFile(uri: string): Promise<FileStat> {
        const _uri = new URI(uri);
        const stat = await this.doGetStat(_uri, 0);
        if (!stat) {
            return this.createFile(uri);
        } else {
            return new Promise<FileStat>((resolve, reject) => {
                // tslint:disable-next-line:no-any
                touch(FileUri.fsPath(_uri), async (error: any) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(await this.doGetStat(_uri, 1) as any);
                });
            });
        }
    }

    async delete(uri: string, options?: { moveToTrash?: boolean }): Promise<void> {
        const _uri = new URI(uri);
        const stat = await this.doGetStat(_uri, 0);
        if (!stat) {
            throw new Error(`File does not exist under ${uri}.`);
        }
        // Windows 10.
        // Deleting an empty directory throws `EPERM error` instead of `unlinkDir`.
        // https://github.com/paulmillr/chokidar/issues/566
        const moveToTrash = await this.doGetMoveToTrash(options);
        if (moveToTrash) {
            return trash([FileUri.fsPath(_uri)]);
        } else {
            return fs.remove(FileUri.fsPath(_uri));
        }
    }

    async getEncoding(uri: string): Promise<string> {
        const _uri = new URI(uri);
        const stat = await this.doGetStat(_uri, 0);
        if (!stat) {
            throw new Error(`File does not exist under ${uri}.`);
        }
        if (stat.isDirectory) {
            throw new Error(`Cannot get the encoding of a director. URI: ${uri}.`);
        }
        return this.options.encoding;
    }

    async getRoots(): Promise<FileStat[]> {
        const cwdRoot = paths.parse(process.cwd()).root;
        const rootUri = FileUri.create(cwdRoot);
        const root = await this.doGetStat(rootUri, 1);
        if (root) {
            return [root];
        }
        return [];
    }

    async getCurrentUserHome(): Promise<FileStat | undefined> {
        return this.getFileStat(FileUri.create(os.homedir()).toString());
    }

    dispose(): void {
        // NOOP
    }

    protected async doGetStat(uri: URI, depth: number): Promise<FileStat | undefined> {
        try {
            const stats = await fs.stat(FileUri.fsPath(uri));
            if (stats.isDirectory()) {
                return this.doCreateDirectoryStat(uri, stats, depth);
            }
            return this.doCreateFileStat(uri, stats);
        } catch (error) {
            if (isErrnoException(error)) {
                if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EBUSY' || error.code === 'EPERM') {
                    return undefined;
                }
            }
            throw error;
        }
    }

    protected async doCreateFileStat(uri: URI, stat: fs.Stats): Promise<FileStat> {
        return {
            uri: uri.toString(),
            lastModification: stat.mtime.getTime(),
            isDirectory: false,
            size: stat.size
        };
    }

    protected async doCreateDirectoryStat(uri: URI, stat: fs.Stats, depth: number): Promise<FileStat> {
        const children = depth > 0 ? await this.doGetChildren(uri, depth) : [];
        return {
            uri: uri.toString(),
            lastModification: stat.mtime.getTime(),
            isDirectory: true,
            children
        };
    }

    protected async doGetChildren(uri: URI, depth: number): Promise<FileStat[]> {
        const files = await fs.readdir(FileUri.fsPath(uri));
        const children = await Promise.all(files.map(fileName => uri.resolve(fileName)).map(childUri => this.doGetStat(childUri, depth - 1)));
        return children.filter(notEmpty);
    }

    /**
     * Return `true` if it's possible for this URI to have children.
     * It might not be possible to be certain because of permission problems or other filesystem errors.
     */
    protected async mayHaveChildren(uri: URI): Promise<boolean> {
        /* If there's a problem reading the root directory. Assume it's not empty to avoid overwriting anything.  */
        try {
            const rootStat = await this.doGetStat(uri, 0);
            if (rootStat === undefined) {
                return true;
            }
            /* Not a directory.  */
            if (rootStat !== undefined && rootStat.isDirectory === false) {
                return false;
            }
        } catch {
            return true;
        }

        /* If there's a problem with it's children then the directory must not be empty.  */
        try {
            const stat = await this.doGetStat(uri, 1);
            if (stat !== undefined && stat.children !== undefined) {
                return stat.children.length > 0;
            } else {
                return true;
            }
        } catch {
            return true;
        }
    }

    protected async doGetEncoding(option?: { encoding?: string }): Promise<string> {
        return option && typeof (option.encoding) !== 'undefined'  ? option.encoding  : this.options.encoding;
    }

    protected async doGetOverwrite(option?: { overwrite?: boolean }): Promise<boolean> {
        return option && typeof (option.overwrite) !== 'undefined'
            ? option.overwrite
            : this.options.overwrite;
    }

    protected async doGetRecursive(option?: { recursive?: boolean }): Promise<boolean> {
        return option && typeof (option.recursive) !== 'undefined'
            ? option.recursive
            : this.options.recursive;
    }

    protected async doGetMoveToTrash(option?: { moveToTrash?: boolean }): Promise<boolean> {
        return option && typeof (option.moveToTrash) !== 'undefined'
            ? option.moveToTrash
            : this.options.moveToTrash;
    }

    protected async doGetContent(option?: { content?: string }): Promise<string> {
        return (option && option.content) || '';
    }

}

// tslint:disable-next-line:no-any
function isErrnoException(error: any | NodeJS.ErrnoException): error is NodeJS.ErrnoException {
    return (<NodeJS.ErrnoException>error).code !== undefined && (<NodeJS.ErrnoException>error).errno !== undefined;
}

function notEmpty<T>(value: T | undefined): value is T {
    return value !== undefined;
}
