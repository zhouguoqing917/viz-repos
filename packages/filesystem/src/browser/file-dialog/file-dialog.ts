import { inject, injectable } from "inversify";
import { Message } from '@phosphor/messaging';
import { Disposable } from "@viz/core/lib/common";
import { Key } from "@viz/core/lib/browser";
import { AbstractDialog, createIconButton, DialogProps, setEnabled, Widget } from "@viz/core/lib/browser";
import { FileStatNode } from '../file-tree';
import { LocationListRenderer } from '../location';
import { FileDialogModel } from './file-dialog-model';
import { FileDialogWidget } from './file-dialog-widget';

export const FileDialogFactory = Symbol('FileDialogFactory');
export interface FileDialogFactory {
    (props: FileDialogProps): FileDialog;
}

export const NAVIGATION_PANEL_CLASS = 'theia-NavigationPanel';
export const CONTROL_PANEL_CLASS = 'theia-ControlPanel';

@injectable()
export class FileDialogProps extends DialogProps {
}

@injectable()
export class FileDialog extends AbstractDialog<Readonly<FileStatNode> | undefined> {

    protected readonly back: HTMLSpanElement;
    protected readonly forward: HTMLSpanElement;
    protected readonly locationListRenderer: LocationListRenderer;

    constructor(
        @inject(FileDialogProps) props: FileDialogProps,
        @inject(FileDialogWidget) readonly widget: FileDialogWidget
    ) {
        super(props);
        this.toDispose.push(widget);
        this.toDispose.push(this.model.onChanged(() => this.update()));
        this.toDispose.push(this.model.onDidOpenFile(() => this.accept()));

        const navigationPanel = document.createElement('div');
        navigationPanel.classList.add(NAVIGATION_PANEL_CLASS);
        this.contentNode.appendChild(navigationPanel);

        navigationPanel.appendChild(this.back = createIconButton('fa', 'fa-chevron-left'));
        navigationPanel.appendChild(this.forward = createIconButton('fa', 'fa-chevron-right'));

        this.locationListRenderer = this.createLocationListRenderer();
        navigationPanel.appendChild(this.locationListRenderer.host);
    }

    get model(): FileDialogModel {
        return this.widget.model;
    }

    protected createLocationListRenderer(): LocationListRenderer {
        return new LocationListRenderer(this.model);
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        setEnabled(this.back, this.model.canNavigateBackward());
        setEnabled(this.forward, this.model.canNavigateForward());
        this.locationListRenderer.render();
        this.widget.update();
    }

    protected onAfterAttach(msg: Message): void {
        Widget.attach(this.widget, this.contentNode);
        this.toDisposeOnDetach.push(Disposable.create(() => {
            Widget.detach(this.widget);
            this.locationListRenderer.dispose();
        }));

        this.appendCloseButton('Cancel');
        this.appendAcceptButton('Open');

        this.addKeyListener(this.back, Key.ENTER, () => this.model.navigateBackward(), 'click');
        this.addKeyListener(this.forward, Key.ENTER, () => this.model.navigateForward(), 'click');
        super.onAfterAttach(msg);
    }

    protected onActivateRequest(msg: Message): void {
        this.widget.activate();
    }

    get value(): Readonly<FileStatNode> | undefined {
        return this.widget.model.selectedFileStatNodes[0];
    }

}
