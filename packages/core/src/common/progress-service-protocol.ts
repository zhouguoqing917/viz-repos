import {
    ProgressMessage,
    ProgressUpdate
} from './message-service-protocol';
import { CancellationToken } from './cancellation';

export const ProgressClient = Symbol('ProgressClient');
export interface ProgressClient {

    /**
     * Show a progress message with possible actions to user.
     */
    showProgress(progressId: string, message: ProgressMessage, cancellationToken: CancellationToken): Promise<string | undefined>;

    /**
     * Update a previously created progress message.
     */
    reportProgress(progressId: string, update: ProgressUpdate, message: ProgressMessage, cancellationToken: CancellationToken): Promise<void>;
}
