import { FrontendApplicationConfig } from '@viz/application-package';

export class FrontendApplicationConfigProvider {

    private static KEY = Symbol('FrontendApplicationConfigProvider');

    static get(): FrontendApplicationConfig {
        const config = FrontendApplicationConfigProvider.doGet();
        if (config === undefined) {
            throw new Error('The configuration is not set. Did you call FrontendApplicationConfigProvider#set?');
        }
        return config;
    }

    static set(config: FrontendApplicationConfig): void {
        if (FrontendApplicationConfigProvider.doGet() !== undefined) {
            throw new Error('The configuration is already set.');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalObject = window as any;
        const key = FrontendApplicationConfigProvider.KEY;
        globalObject[key] = config;
    }

    private static doGet(): FrontendApplicationConfig | undefined {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalObject = window as any;
        const key = FrontendApplicationConfigProvider.KEY;
        return globalObject[key];
    }

}
