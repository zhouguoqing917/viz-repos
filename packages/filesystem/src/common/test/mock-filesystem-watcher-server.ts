
import { injectable } from 'inversify';
import { FileSystemWatcherClient, FileSystemWatcherServer, WatchOptions } from '../filesystem-watcher-protocol';

@injectable()
export class MockFilesystemWatcherServer implements FileSystemWatcherServer {

    dispose() { }

    watchFileChanges(uri: string, options?: WatchOptions): Promise<number> {
        return Promise.resolve(0);
    }

    unwatchFileChanges(watcher: number): Promise<void> {
        return Promise.resolve();
    }

    setClient(client: FileSystemWatcherClient) { }

}
