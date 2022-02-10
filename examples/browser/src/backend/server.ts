import 'reflect-metadata';
import * as path from 'path';
import { Container, injectable } from "inversify";
import * as express from 'express';
import { BackendApplication, BackendApplicationContribution, applicationModule } from "theia-core/lib/application/node";
import { fileSystemServerModule } from "theia-core/lib/filesystem/node";
import { messagingModule } from "theia-core/lib/messaging/node";
import { backendLanguagesModule } from 'theia-core/lib/languages/node';
import { backendJavaModule } from 'theia-core/lib/java/node';
import { backendPythonModule } from 'theia-core/lib/python/node';
import { backendCppModule } from 'theia-core/lib/cpp/node';
import terminalBackendModule from 'theia-core/lib/terminal/node/terminal-backend-module'

// FIXME introduce default error handler contribution
process.on('uncaughtException', function (err: any) {
    console.error('Uncaught Exception: ', err.toString());
    if (err.stack) {
        console.error(err.stack);
    }
});

@injectable()
class StaticServer implements BackendApplicationContribution {
    configure(app: express.Application): void {
        app.use(express.static(path.join(__dirname, '..'), {
            index: path.join('frontend', 'index.html')
        }));
    }
}

const container = new Container();
container.load(applicationModule);
container.load(messagingModule);
container.load(fileSystemServerModule);
container.load(backendLanguagesModule);
container.load(terminalBackendModule);
container.load(backendJavaModule);
container.load(backendPythonModule);
container.load(backendCppModule);
container.bind(BackendApplicationContribution).to(StaticServer);
const application = container.get(BackendApplication);
application.start();