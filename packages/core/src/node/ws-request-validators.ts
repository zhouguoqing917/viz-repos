import { inject, injectable, named } from 'inversify';
import * as http from 'http';
import { ContributionProvider, MaybePromise } from '../common';

/**
 * Bind components to this symbol to filter WebSocket connections.
 */
export const WsRequestValidatorContribution = Symbol('RequestValidatorContribution');
export interface WsRequestValidatorContribution {
    /**
     * Return `false` to prevent the protocol upgrade from going through, blocking the WebSocket connection.
     *
     * @param request The HTTP connection upgrade request received by the server.
     */
    allowWsUpgrade(request: http.IncomingMessage): MaybePromise<boolean>;
}

/**
 * Central handler of `WsRequestValidatorContribution`.
 */
@injectable()
export class WsRequestValidator {

    @inject(ContributionProvider) @named(WsRequestValidatorContribution)
    protected readonly requestValidators: ContributionProvider<WsRequestValidatorContribution>;

    /**
     * Ask all bound `WsRequestValidatorContributions` if the WebSocket connection should be allowed or not.
     */
    async allowWsUpgrade(request: http.IncomingMessage): Promise<boolean> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async resolve => {
            await Promise.all(Array.from(this.requestValidators.getContributions(), async validator => {
                if (!await validator.allowWsUpgrade(request)) {
                    resolve(false); // bail on first refusal
                }
            }));
            resolve(true);
        });
    }
}
