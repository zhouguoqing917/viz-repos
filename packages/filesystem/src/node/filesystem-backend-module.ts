import * as cluster from 'cluster';
import { ContainerModule, interfaces } from "inversify";
import { ConnectionHandler, ILogger, JsonRpcConnectionHandler } from "@viz/core/lib/common";
import { FileSystemNode } from './node-filesystem';
import { FileSystem, FileSystemClient, fileSystemPath } from "../common";
import { FileSystemWatcherClient, fileSystemWatcherPath, FileSystemWatcherServer } from '../common/filesystem-watcher-protocol';
import { FileSystemWatcherServerClient } from './filesystem-watcher-client';
import { NsfwFileSystemWatcherServer } from './nsfw-watcher/nsfw-filesystem-watcher';

export function bindFileSystem(bind: interfaces.Bind): void {
    bind(FileSystemNode).toSelf().inSingletonScope();
    bind(FileSystem).toDynamicValue(ctx => ctx.container.get(FileSystemNode)).inSingletonScope();
}

export function bindFileSystemWatcherServer(bind: interfaces.Bind): void {
    if (cluster.isMaster) {
        bind(FileSystemWatcherServer).toDynamicValue(ctx => {
            const logger = ctx.container.get<ILogger>(ILogger);
            return new NsfwFileSystemWatcherServer({
                info: (message, ...args) => logger.info(message, ...args),
                error: (message, ...args) => logger.error(message, ...args)
            });
        });
    } else {
        bind(FileSystemWatcherServerClient).toSelf();
        bind(FileSystemWatcherServer).toDynamicValue(ctx =>
            ctx.container.get(FileSystemWatcherServerClient)
        );
    }
}

export default new ContainerModule(bind => {
    bindFileSystem(bind);
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler<FileSystemClient>(fileSystemPath, client => {
            const server = ctx.container.get<FileSystem>(FileSystem);
            server.setClient(client);
            client.onDidCloseConnection(() => server.dispose());
            return server;
        })
    ).inSingletonScope();

    bindFileSystemWatcherServer(bind);
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler<FileSystemWatcherClient>(fileSystemWatcherPath, client => {
            const server = ctx.container.get<FileSystemWatcherServer>(FileSystemWatcherServer);
            server.setClient(client);
            client.onDidCloseConnection(() => server.dispose());
            return server;
        })
    ).inSingletonScope();
});
