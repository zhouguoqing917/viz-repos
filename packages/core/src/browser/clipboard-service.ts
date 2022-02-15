import { MaybePromise } from '../common/types';

export const ClipboardService = Symbol('ClipboardService');
export interface ClipboardService {
    readText(): MaybePromise<string>;
    writeText(value: string): MaybePromise<void>;
}
