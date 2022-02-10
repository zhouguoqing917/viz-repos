import { OS } from './os';

export const applicationPath = '/services/application';

export const ApplicationServer = Symbol('ApplicationServer');

export interface ApplicationServer {
    getExtensionsInfos(): Promise<ExtensionInfo[]>;
    getApplicationInfo(): Promise<ApplicationInfo | undefined>;
    getBackendOS(): Promise<OS.Type>;
}

export interface ExtensionInfo {
    name: string;
    version: string;
}

export interface ApplicationInfo {
    name: string;
    version: string;
}
