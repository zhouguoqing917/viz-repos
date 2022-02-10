import * as fs from 'fs-extra';
import * as paths from 'path';
import { readJsonFile, writeJsonFile } from './json-file';
import { NodePackage, NpmRegistry, NpmRegistryConfig, PublishedNodePackage, sortByKey } from './npm-registry';
import { Extension, ExtensionPackage, RawExtensionPackage } from './extension-package';
import { ExtensionPackageCollector } from './extension-package-collector';
 

export type ApplicationPackageTarget = 'browser' | 'electron';
export class ApplicationPackageConfig extends NpmRegistryConfig {
    readonly target: ApplicationPackageTarget;
}

export type ApplicationLog = (message?: any, ...optionalParams: any[]) => void;
export class ApplicationPackageOptions {
    readonly projectPath: string;
    readonly log?: ApplicationLog;
    readonly error?: ApplicationLog;
    readonly registry?: NpmRegistry;
}

export type ApplicationModuleResolver = (modulePath: string) => string;

export class ApplicationPackage {

    static defaultConfig: ApplicationPackageConfig = {
        ...NpmRegistry.defaultConfig,
        target: 'browser'
    };

    readonly projectPath: string;
    readonly log: ApplicationLog;
    readonly error: ApplicationLog;

    constructor(
        protected readonly options: ApplicationPackageOptions
    ) {
        this.projectPath = options.projectPath;
        this.log = options.log || console.log.bind(console);
        this.error = options.error || console.error.bind(console);
    }

    protected _registry: NpmRegistry | undefined;
    get registry(): NpmRegistry {
        if (this._registry) {
            return this._registry;
        }
        this._registry = this.options.registry || new NpmRegistry();
        this._registry.updateConfig(this.config);
        return this._registry;
    }

    get target(): ApplicationPackageTarget {
        return this.config.target;
    }

    protected _config: ApplicationPackageConfig | undefined;
    get config(): ApplicationPackageConfig {
        if (this._config) {
            return this._config;
        }
        const theia = this.pck.theia || {};
        return this._config = { ...ApplicationPackage.defaultConfig, ...theia };
    }

    protected _pck: NodePackage | undefined;
    get pck(): NodePackage {
        if (this._pck) {
            return this._pck;
        }
        return this._pck = readJsonFile(this.packagePath);
    }

    protected _frontendModules: Map<string, string> | undefined;
    protected _frontendElectronModules: Map<string, string> | undefined;
    protected _backendModules: Map<string, string> | undefined;
    protected _backendElectronModules: Map<string, string> | undefined;
    protected _extensionPackages: ReadonlyArray<ExtensionPackage> | undefined;

    /**
     * Extension packages in the topological order.
     */
    get extensionPackages(): ReadonlyArray<ExtensionPackage> {
        if (!this._extensionPackages) {
            const collector = new ExtensionPackageCollector(
                raw => this.newExtensionPackage(raw),
                this.resolveModule
            );
            this._extensionPackages = collector.collect(this.pck);
        }
        return this._extensionPackages;
    }

    getExtensionPackage(extension: string): ExtensionPackage | undefined {
        return this.extensionPackages.find(pck => pck.name === extension);
    }

    async findExtensionPackage(extension: string): Promise<ExtensionPackage | undefined> {
        return this.getExtensionPackage(extension) || await this.resolveExtensionPackage(extension);
    }

    async resolveExtensionPackage(extension: string): Promise<ExtensionPackage | undefined> {
        const raw = await RawExtensionPackage.view(this.registry, extension);
        return raw ? this.newExtensionPackage(raw) : undefined;
    }

    protected newExtensionPackage(raw: PublishedNodePackage): ExtensionPackage {
        return new ExtensionPackage(raw, this.registry);
    }

    get frontendModules(): Map<string, string> {
        if (!this._frontendModules) {
            this._frontendModules = this.computeModules('frontend');
        }
        return this._frontendModules;
    }

    get frontendElectronModules(): Map<string, string> {
        if (!this._frontendElectronModules) {
            this._frontendElectronModules = this.computeModules('frontendElectron', 'frontend');
        }
        return this._frontendElectronModules;
    }

    get backendModules(): Map<string, string> {
        if (!this._backendModules) {
            this._backendModules = this.computeModules('backend');
        }
        return this._backendModules;
    }

    get backendElectronModules(): Map<string, string> {
        if (!this._backendElectronModules) {
            this._backendElectronModules = this.computeModules('backendElectron', 'backend');
        }
        return this._backendElectronModules;
    }

    protected computeModules<P extends keyof Extension, S extends keyof Extension = P>(primary: P, secondary?: S): Map<string, string> {
        const result = new Map<string, string>();
        let moduleIndex = 1;
        for (const extensionPackage of this.extensionPackages) {
            const extensions = extensionPackage.extensions;
            if (extensions) {
                for (const extension of extensions) {
                    const modulePath = extension[primary] || (secondary && extension[secondary]);
                    if (typeof modulePath === 'string') {
                        const extensionPath = paths.join(extensionPackage.name, modulePath).split(paths.sep).join('/');
                        result.set(`${primary}_${moduleIndex}`, extensionPath);
                        moduleIndex = moduleIndex + 1;
                    }
                }
            }
        }
        return result;
    }

    relative(path: string): string {
        return paths.relative(this.projectPath, path);
    }

    path(...segments: string[]): string {
        return paths.resolve(this.projectPath, ...segments);
    }

    get packagePath(): string {
        return this.path('package.json');
    }

    lib(...segments: string[]): string {
        return this.path('lib', ...segments);
    }
    src(...segments: string[]): string {
        return this.path('src', ...segments);
    }

    backend(...segments: string[]): string {
        return this.src('backend', ...segments);
    }

    frontend(...segments: string[]): string {
        return this.src('frontend', ...segments);
    }

    isBrowser(): boolean {
        return this.target === 'browser';
    }

    isElectron(): boolean {
        return this.target === 'electron';
    }

    ifBrowser<T>(value: T): T | undefined;
    ifBrowser<T>(value: T, defaultValue: T): T;
    ifBrowser<T>(value: T, defaultValue?: T): T | undefined {
        return this.isBrowser() ? value : defaultValue;
    }

    ifElectron<T>(value: T): T | undefined;
    ifElectron<T>(value: T, defaultValue: T): T;
    ifElectron<T>(value: T, defaultValue?: T): T | undefined {
        return this.isElectron() ? value : defaultValue;
    }

    get targetBackendModules(): Map<string, string> {
        return this.ifBrowser(this.backendModules, this.backendElectronModules);
    }

    get targetFrontendModules(): Map<string, string> {
        return this.ifBrowser(this.frontendModules, this.frontendElectronModules);
    }

    setDependency(name: string, version: string | undefined): boolean {
        const dependencies = this.pck.dependencies || {};
        const currentVersion = dependencies[name];
        if (currentVersion === version) {
            return false;
        }
        if (version) {
            dependencies[name] = version;
        } else {
            delete dependencies[name];
        }
        this.pck.dependencies = sortByKey(dependencies);
        return true;
    }

    save(): Promise<void> {
        return writeJsonFile(this.packagePath, this.pck, {
            detectIndent: true
        });
    }

    protected _moduleResolver: undefined | ApplicationModuleResolver;
    /**
     * A node module resolver in the context of the application package.
     */
    get resolveModule(): ApplicationModuleResolver {
        if (!this._moduleResolver) {
            const loaderPath = this.path('.application-module-loader.js');
            fs.writeFileSync(loaderPath, 'module.exports = modulePath => require.resolve(modulePath);');
            this._moduleResolver = require(loaderPath) as ApplicationModuleResolver;
            fs.removeSync(loaderPath);
        }
        return this._moduleResolver!;
    }

    resolveModulePath(moduleName: string, ...segments: string[]): string {
        return paths.resolve(this.resolveModule(moduleName + '/package.json'), '..', ...segments);
    }

}
