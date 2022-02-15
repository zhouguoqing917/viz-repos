import * as yargs from 'yargs';
import { JsonRpcProxyFactory } from '@viz/core';
import { FileSystemWatcherClient } from '../../common/filesystem-watcher-protocol';
import { NsfwFileSystemWatcherServer } from './nsfw-filesystem-watcher';
import { IPCEntryPoint } from '@viz/core/lib/node/messaging/ipc-protocol';

// tslint:disable:no-any

const options: {
    verbose: boolean
} = yargs.option('verbose', {
    default: false,
    alias: 'v',
    type: 'boolean'
}).argv as any;

export default <IPCEntryPoint>(connection => {
    const server = new NsfwFileSystemWatcherServer(options);
    const factory = new JsonRpcProxyFactory<FileSystemWatcherClient>(server);
    server.setClient(factory.createProxy());
    factory.listen(connection);
});
