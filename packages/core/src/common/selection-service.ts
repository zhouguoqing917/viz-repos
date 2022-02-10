import { injectable } from 'inversify';
import { Emitter, Event } from '../common/event';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SelectionProvider<T> {
    onSelectionChanged: Event<T | undefined>;
}

@injectable()
export class SelectionService implements SelectionProvider<Object | undefined> {

    private currentSelection: Object | undefined;

    protected readonly onSelectionChangedEmitter = new Emitter<any>();
    readonly onSelectionChanged: Event<any> = this.onSelectionChangedEmitter.event;

    get selection(): Object | undefined {
        return this.currentSelection;
    }

    set selection(selection: Object | undefined) {
        this.currentSelection = selection;
        this.onSelectionChangedEmitter.fire(this.currentSelection);
    }

}
