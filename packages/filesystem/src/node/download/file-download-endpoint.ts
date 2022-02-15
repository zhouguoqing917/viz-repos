import { inject, injectable, named } from 'inversify';
import { json } from 'body-parser';
import { Application, Router } from 'express';
import { BackendApplicationContribution } from '@viz/core/lib/node/backend-application';
import { FileDownloadHandler } from './file-download-handler';

@injectable()
export class FileDownloadEndpoint implements BackendApplicationContribution {

    protected static PATH = '/files';

    @inject(FileDownloadHandler)
    @named(FileDownloadHandler.SINGLE)
    protected readonly singleFileDownloadHandler: FileDownloadHandler;

    @inject(FileDownloadHandler)
    @named(FileDownloadHandler.MULTI)
    protected readonly multiFileDownloadHandler: FileDownloadHandler;

    configure(app: Application): void {
        const router = Router();
        router.get('/', (request, response) => this.singleFileDownloadHandler.handle(request, response));
        router.put('/', (request, response) => this.multiFileDownloadHandler.handle(request, response));
        // Content-Type: application/json
        app.use(json());
        app.use(FileDownloadEndpoint.PATH, router);
    }

}
