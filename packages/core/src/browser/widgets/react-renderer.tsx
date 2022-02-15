import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Disposable } from '../../common';

export class ReactRenderer implements Disposable {
    readonly host: HTMLElement;
    constructor(
        host?: HTMLElement
    ) {
        this.host = host || document.createElement('div');
    }

    dispose(): void {
        ReactDOM.unmountComponentAtNode(this.host);
    }

    render(): void {
        ReactDOM.render(<React.Fragment>{this.doRender()}</React.Fragment>, this.host);
    }

    protected doRender(): React.ReactNode {
        return undefined;
    }
}
