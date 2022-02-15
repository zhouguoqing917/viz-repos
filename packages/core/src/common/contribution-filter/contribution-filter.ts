import { interfaces } from 'inversify';
import { Filter } from './filter';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContributionType = interfaces.ServiceIdentifier<any>;

export const ContributionFilterRegistry = Symbol('ContributionFilterRegistry');
export interface ContributionFilterRegistry {

    /**
     * Add filters to be applied for every type of contribution.
     */
    addFilters(types: '*', filters: Filter<Object>[]): void;

    /**
     * Given a list of contribution types, register filters to apply.
     * @param types types for which to register the filters.
     */
    addFilters(types: ContributionType[], filters: Filter<Object>[]): void;

    /**
     * Applies the filters for the given contribution type. Generic filters will be applied on any given type.
     * @param toFilter the elements to filter
     * @param type the contribution type for which potentially filters were registered
     * @returns the filtered elements
     */
    applyFilters<T extends Object>(toFilter: T[], type: ContributionType): T[]
}

export const FilterContribution = Symbol('FilterContribution');
/**
 * Register filters to remove contributions.
 */
export interface FilterContribution {
    /**
     * Use the registry to register your contribution filters.
     */
    registerContributionFilters(registry: ContributionFilterRegistry): void;
}
