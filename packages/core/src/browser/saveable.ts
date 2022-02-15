/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { Widget } from '@phosphor/widgets';
import { Message } from '@phosphor/messaging';
import { cancelled, Event, isCancelled, MaybePromise } from '../common';
import { Key } from './keys';
import { AbstractDialog } from './dialogs';

export interface Saveable {
    readonly dirty: boolean;
    readonly onDirtyChanged: Event<void>;
    readonly autoSave: "on" | "off";
    save(): MaybePromise<void>;
}

export interface SaveableSource {
    readonly saveable: Saveable;
}

export namespace Saveable {
    export function isSource(arg: any): arg is SaveableSource {
        return !!arg && ('saveable' in arg);
    }
    export function is(arg: any): arg is Saveable {
        return !!arg && ('dirty' in arg) && ('onDirtyChanged' in arg);
    }
    export function get(arg: any): Saveable | undefined {
        if (is(arg)) {
            return arg;
        }
        if (isSource(arg)) {
            return arg.saveable;
        }
        return undefined;
    }
    export function getDirty(arg: any): Saveable | undefined {
        const saveable = get(arg);
        if (saveable && saveable.dirty) {
            return saveable;
        }
        return undefined;
    }
    export function isDirty(arg: any): boolean {
        return !!getDirty(arg);
    }
    export async function save(arg: any): Promise<void> {
        const saveable = getDirty(arg);
        if (saveable) {
            await saveable.save();
        }
    }
    export function apply(widget: Widget): void {
        const saveable = Saveable.get(widget);
        if (saveable) {
            setDirty(widget, saveable.dirty);
            saveable.onDirtyChanged(() => setDirty(widget, saveable.dirty));
            const close = widget.close.bind(widget);
            let closing = false;
            widget.close = async () => {
                if (closing) {
                    return;
                }
                closing = true;
                try {
                    if (await shouldSave(saveable, widget)) {
                        await Saveable.save(widget);
                    }
                    close();
                } catch (e) {
                    if (!isCancelled(e)) {
                        throw e;
                    }
                } finally {
                    closing = false;
                }
            };
        }
    }
    export async function shouldSave(saveable: Saveable, widget: Widget): Promise<boolean> {
        if (!saveable.dirty) {
            return false;
        }
        if (saveable.autoSave === 'on') {
            return true;
        }
        const dialog = new ShouldSaveDialog(widget);
        return dialog.open();
    }
}
export interface SaveableWidget extends Widget {
    closeWithoutSaving(): Promise<void>;
    closeWithSaving(options?: SaveableWidget.CloseOptions): Promise<void>;
}
 
export namespace SaveableWidget {
    export function is(widget: Widget | undefined): widget is SaveableWidget {
        return !!widget && 'closeWithoutSaving' in widget;
    }
    export function getDirty<T extends Widget>(widgets: Iterable<T>): IterableIterator<SaveableWidget & T> {
        return get(widgets, Saveable.isDirty);
    }
    export function* get<T extends Widget>(
        widgets: Iterable<T>,
        filter: (widget: T) => boolean = () => true
    ): IterableIterator<SaveableWidget & T> {
        for (const widget of widgets) {
            if (SaveableWidget.is(widget) && filter(widget)) {
                yield widget;
            }
        }
    }
    export interface CloseOptions {
        shouldSave?(): MaybePromise<boolean | undefined>
    }
}

/**
 * The class name added to the dirty widget's title.
 */
const DIRTY_CLASS = 'theia-mod-dirty';
export function setDirty(widget: Widget, dirty: boolean): void {
    const dirtyClass = ` ${DIRTY_CLASS}`;
    widget.title.className = widget.title.className.replace(dirtyClass, '');
    if (dirty) {
        widget.title.className += dirtyClass;
    }
}

export class ShouldSaveDialog extends AbstractDialog<boolean> {

    protected shouldSave = true;
    protected readonly dontSaveButton: HTMLButtonElement;

    constructor(widget: Widget) {
        super({
            title: `Do you want to save the changes you made to ${widget.title.label || widget.title.caption}?`
        });

        const messageNode = document.createElement("div");
        messageNode.textContent = "Your changes will be lost if you don't save them.";
        messageNode.setAttribute('style', 'flex: 1 100%; padding-bottom: calc(var(--theia-ui-padding)*3);');
        this.contentNode.appendChild(messageNode);
        this.dontSaveButton = this.appendDontSaveButton();
        this.appendCloseButton();
        this.appendAcceptButton('Save');
    }

    protected appendDontSaveButton() {
        const button = this.createButton("Don't save");
        this.controlPanel.appendChild(button);
        button.classList.add('secondary');
        return button;
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.addKeyListener(this.dontSaveButton, Key.ENTER, () => {
            this.shouldSave = false;
            this.accept();
        }, 'click');
    }

    get value(): boolean {
        return this.shouldSave;
    }

    close(): void {
        if (this.reject) {
            this.reject(cancelled());
        }
        super.close();
    }

}
