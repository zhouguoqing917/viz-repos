import { ContainerModule } from 'inversify';
import { BackendApplicationContribution } from '@viz/core/lib/node/backend-application';
import { FileDownloadEndpoint } from './file-download-endpoint';
import { FileDownloadHandler, MultiFileDownloadHandler, SingleFileDownloadHandler } from './file-download-handler';
import { DirectoryArchiver } from './directory-archiver';

export default new ContainerModule(bind => {
    bind(FileDownloadEndpoint).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(FileDownloadEndpoint);
    bind(FileDownloadHandler).to(SingleFileDownloadHandler).inSingletonScope().whenTargetNamed(FileDownloadHandler.SINGLE);
    bind(FileDownloadHandler).to(MultiFileDownloadHandler).inSingletonScope().whenTargetNamed(FileDownloadHandler.MULTI);
    bind(DirectoryArchiver).toSelf().inSingletonScope();
});
