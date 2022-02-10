import { interfaces } from 'inversify';

export const ContributionProvider = Symbol('ContributionProvider');

export interface ContributionProvider<T extends object> {

    /**
     * @param recursive `true` if the contributions should be collected from the parent containers as well. Otherwise, `false`. It is `false` by default.
     */
    getContributions(recursive?: boolean): T[]
}

class ContainerBasedContributionProvider<T extends object> implements ContributionProvider<T> {

    protected services: T[] | undefined;

    constructor(
        protected readonly serviceIdentifier: interfaces.ServiceIdentifier<T>,
        protected readonly container: interfaces.Container
    ) { }

    getContributions(recursive?: boolean): T[] {
        if (this.services === undefined) {
            const currentServices: T[] = [];
            let currentContainer: interfaces.Container | null = this.container; 
            while (currentContainer !== null) {
                if (currentContainer.isBound(this.serviceIdentifier)) {
                    try {
                        currentServices.push(...currentContainer.getAll(this.serviceIdentifier));
                    } catch (error) {
                        console.error(error);
                    }
                }
                currentContainer = recursive === true ? currentContainer.parent : null;
            }
            this.services = currentServices;
        }
        return this.services;
    }
}

export type Bindable = interfaces.Bind | interfaces.Container;
export namespace Bindable {
    export function isContainer(arg: Bindable): arg is interfaces.Container {
        return typeof arg !== 'function'
            // https://github.com/eclipse-theia/theia/issues/3204#issue-371029654
            // In InversifyJS `4.14.0` containers no longer have a property `guid`.
            && ('guid' in arg || 'parent' in arg);
    }
}

export function bindContributionProvider(bindable: Bindable, id: symbol): void {
    const bindingToSyntax = (Bindable.isContainer(bindable) ? bindable.bind(ContributionProvider) : bindable(ContributionProvider));
    bindingToSyntax
        .toDynamicValue(ctx => new ContainerBasedContributionProvider(id, ctx.container))
        .inSingletonScope().whenTargetNamed(id);
}
