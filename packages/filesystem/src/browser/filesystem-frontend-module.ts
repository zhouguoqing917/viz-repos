import { ContainerModule } from 'inversify';
import { ResourceResolver } from '@viz/core/lib/common';
import { WebSocketConnectionProvider } from '@viz/core/lib/browser';
import { FileSystem, fileSystemPath } from "../common";
import {
    fileSystemWatcherPath, FileSystemWatcherServer,
    FileSystemWatcherServerProxy, ReconnectingFileSystemWatcherServer
} from '../common/filesystem-watcher-protocol';
import { FileResourceResolver } from './file-resource';
import { FileSystemListener } from './filesystem-listener';
import { bindFileSystemPreferences } from './filesystem-preferences';
import { FileSystemWatcher } from './filesystem-watcher';

import "../../src/browser/style/index.css";

export default new ContainerModule(bind => {
    bindFileSystemPreferences(bind);

    bind(FileSystemWatcherServerProxy).toDynamicValue(ctx =>
        WebSocketConnectionProvider.createProxy(ctx.container, fileSystemWatcherPath)
    );
    bind(FileSystemWatcherServer).to(ReconnectingFileSystemWatcherServer);
    bind(FileSystemWatcher).toSelf().inSingletonScope();

    bind(FileSystemListener).toSelf().inSingletonScope();
    bind(FileSystem).toDynamicValue(ctx => {
        const filesystem = WebSocketConnectionProvider.createProxy<FileSystem>(ctx.container, fileSystemPath);
        ctx.container.get(FileSystemListener).listen(filesystem);
        return filesystem;
    }).inSingletonScope();

    bind(FileResourceResolver).toSelf().inSingletonScope();
    bind(ResourceResolver).toDynamicValue(ctx => ctx.container.get(FileResourceResolver));
});
