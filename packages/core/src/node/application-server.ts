import { inject, injectable } from 'inversify';
import { ApplicationInfo, ApplicationServer, ExtensionInfo } from '../common/application-protocol';
import { ApplicationPackage } from '@viz/application-package';
import { OS } from '../common/os';

@injectable()
export class ApplicationServerImpl implements ApplicationServer {

    @inject(ApplicationPackage)
    protected readonly applicationPackage: ApplicationPackage;

    getExtensionsInfos(): Promise<ExtensionInfo[]> {
        const extensions = this.applicationPackage.extensionPackages;
        const infos: ExtensionInfo[] = extensions.map(extension => ({ name: extension.name, version: extension.version }));
        return Promise.resolve(infos);
    }

    getApplicationInfo(): Promise<ApplicationInfo | undefined> {
        const pck = this.applicationPackage.pck;
        if (pck.name && pck.version) {
            const name = pck.name;
            const version = pck.version;

            return Promise.resolve({ name, version });
        }
        return Promise.resolve(undefined);
    }

    async getBackendOS(): Promise<OS.Type> {
        return OS.type();
    }
}
