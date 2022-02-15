import * as ReactDOM from 'react-dom';
import * as React from 'react';
import { injectable } from 'inversify';
import { Disposable, DisposableCollection } from '../../common';
import { BaseWidget, Message } from './widget';

export type ReactRenderElement =
  | Array<React.ReactElement<any>>
  | React.ReactElement<any>;

@injectable()
export abstract class ReactWidget extends BaseWidget {

    protected readonly onRender = new DisposableCollection();

    constructor() {
        super();
        this.scrollOptions = {
            suppressScrollX: true,
            minScrollbarLength: 35,
        };
        this.toDispose.push(Disposable.create(() => {
            ReactDOM.unmountComponentAtNode(this.node);
        }));
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        ReactDOM.render(<React.Fragment>{this.render()}</React.Fragment>, this.node, () => this.onRender.dispose());
    }
    
    /**
     * Render the React widget in the DOM.
     * - If the widget has been previously rendered,
     * any subsequent calls will perform an update and only
     * change the DOM if absolutely necessary.
     */
    protected abstract render(): React.ReactNode;


    // static create ReactWidget
    static create(element: ReactRenderElement): ReactWidget {
        return new (class extends ReactWidget {
          render() {
            return element;
          }
        })();
      }
}
