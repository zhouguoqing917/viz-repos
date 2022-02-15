import { BackendApplicationConfig } from '@viz/application-package/lib/application-props';

export class BackendApplicationConfigProvider {

    private static KEY = Symbol('BackendApplicationConfigProvider');

    static get(): BackendApplicationConfig {
        const config = BackendApplicationConfigProvider.doGet();
        if (config === undefined) {
            throw new Error('The configuration is not set. Did you call BackendApplicationConfigProvider#set?');
        }
        return config;
    }

    static set(config: BackendApplicationConfig): void {
        if (BackendApplicationConfigProvider.doGet() !== undefined) {
            throw new Error('The configuration is already set.');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalObject = global as any;
        const key = BackendApplicationConfigProvider.KEY;
        globalObject[key] = config;
    }

    private static doGet(): BackendApplicationConfig | undefined {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalObject = global as any;
        const key = BackendApplicationConfigProvider.KEY;
        return globalObject[key];
    }

}
