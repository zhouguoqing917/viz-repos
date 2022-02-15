export const Filter = Symbol('Filter');

/**
 * @param toTest Object that should be tested
 * @returns `true` if the object passes the test, `false` otherwise.
 */
export type Filter<T extends Object> = (toTest: T) => boolean;
