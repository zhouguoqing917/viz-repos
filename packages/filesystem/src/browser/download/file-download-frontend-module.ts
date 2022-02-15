import { ContainerModule } from 'inversify';
import { CommandContribution } from '@viz/core/lib/common/command';
import { FileDownloadService } from './file-download-service';
import { FileDownloadCommandContribution } from './file-download-command-contribution';

export default new ContainerModule(bind => {
    bind(FileDownloadService).toSelf().inSingletonScope();
    bind(CommandContribution).to(FileDownloadCommandContribution).inSingletonScope();
});
