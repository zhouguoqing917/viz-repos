import { injectable } from 'inversify';
import URI from '../common/uri';
import { OpenHandler } from './opener-service';

@injectable()
export class HttpOpenHandler implements OpenHandler {

    readonly id = 'http';

    canHandle(uri: URI): number {
        return uri.scheme.startsWith('http') ? 500 : 0;
    }

    open(uri: URI): Window | undefined {
        return window.open(uri.toString()) || undefined;
    }

}
