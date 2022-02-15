export interface NewWindowOptions {
    readonly external?: boolean;
}

/**
 * Service for opening new browser windows.
 */
export const WindowService = Symbol('WindowService');
export interface WindowService {

    /**
     * Opens a new window and loads the content from the given URL.
     * In a browser, opening a new Theia tab or open a link is the same thing.
     * But in Electron, we want to open links in a browser, not in Electron.
     */
    openNewWindow(url: string, options?: NewWindowOptions): undefined;

    /**
     * Called when the `window` is about to `unload` its resources.
     * At this point, the `document` is still visible and the [`BeforeUnloadEvent`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
     * event will be canceled if the return value of this method is `false`.
     */
    canUnload(): boolean;

}
