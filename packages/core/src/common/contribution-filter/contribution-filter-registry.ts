import { injectable, multiInject, optional } from 'inversify';
import { ContributionFilterRegistry, ContributionType, FilterContribution } from './contribution-filter';
import { Filter } from './filter';

/**
 * Registry of contribution filters.
 *
 * Implement/bind to the `FilterContribution` interface/symbol to register your contribution filters.
 */
@injectable()
export class ContributionFilterRegistryImpl implements ContributionFilterRegistry {

    protected initialized = false;
    protected genericFilters: Filter<Object>[] = [];
    protected typeToFilters = new Map<ContributionType, Filter<Object>[]>();

    constructor(
        @multiInject(FilterContribution) @optional() contributions: FilterContribution[] = []
    ) {
        for (const contribution of contributions) {
            contribution.registerContributionFilters(this);
        }
        this.initialized = true;
    }

    addFilters(types: '*' | ContributionType[], filters: Filter<Object>[]): void {
        if (this.initialized) {
            throw new Error('cannot add filters after initialization is done.');
        } else if (types === '*') {
            this.genericFilters.push(...filters);
        } else {
            for (const type of types) {
                this.getOrCreate(type).push(...filters);
            }
        }
    }

    applyFilters<T extends Object>(toFilter: T[], type: ContributionType): T[] {
        const filters = this.getFilters(type);
        if (filters.length === 0) {
            return toFilter;
        }
        return toFilter.filter(
            object => filters.every(filter => filter(object))
        );
    }

    protected getOrCreate(type: ContributionType): Filter<Object>[] {
        let value = this.typeToFilters.get(type);
        if (value === undefined) {
            this.typeToFilters.set(type, value = []);
        }
        return value;
    }

    protected getFilters(type: ContributionType): Filter<Object>[] {
        return [
            ...this.typeToFilters.get(type) || [],
            ...this.genericFilters
        ];
    }
}

