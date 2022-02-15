import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { inject, injectable } from 'inversify';
import { Disposable, DisposableCollection } from '../../common';
import { Message } from '../widgets';
import { AbstractDialog, DialogProps } from '../dialogs';

@injectable()
export abstract class ReactDialog<T> extends AbstractDialog<T> {
    protected readonly onRender = new DisposableCollection();

    constructor(
        @inject(DialogProps) protected readonly props: DialogProps
    ) {
        super(props);
        this.toDispose.push(Disposable.create(() => {
            ReactDOM.unmountComponentAtNode(this.contentNode);
        }));
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        ReactDOM.render(<>{this.render()}</>, this.contentNode, () => this.onRender.dispose());
    }

    /**
     * Render the React widget in the DOM.
     * - If the widget has been previously rendered,
     * any subsequent calls will perform an update and only
     * change the DOM if absolutely necessary.
     */
    protected abstract render(): React.ReactNode;
}
