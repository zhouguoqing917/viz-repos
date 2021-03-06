
import { inject, injectable, optional } from 'inversify';
import { ArrayExt, find, toArray } from '@phosphor/algorithm';
import { Signal } from '@phosphor/signaling';
import {
    BoxLayout, BoxPanel, DockLayout, DockPanel, FocusTracker, Layout, Panel, SplitLayout,
    SplitPanel, TabBar, Title, Widget
} from '@phosphor/widgets';
import { Message } from '@phosphor/messaging';
import { IDragEvent } from '@phosphor/dragdrop';
import { RecursivePartial } from '../../common';
import { Saveable } from '../saveable';
import { StatusBarAlignment, StatusBarEntry, StatusBarImpl } from '../status-bar/status-bar';
import { SidePanel, SidePanelHandler, SidePanelHandlerFactory, TheiaDockPanel } from './side-panel-handler';
import { ScrollableTabBar, SHELL_TABBAR_CONTEXT_MENU, TabBarRenderer, TabBarRendererFactory } from './tab-bars';
import { SplitPositionHandler, SplitPositionOptions } from './split-panels';
import { FrontendApplicationStateService } from '../frontend-application-state';

/** The class name added to ApplicationShell instances. */
const APPLICATION_SHELL_CLASS = 'theia-ApplicationShell';
/** The class name added to the main and bottom area panels. */
const MAIN_BOTTOM_AREA_CLASS = 'theia-app-centers';
/** Status bar entry identifier for the bottom panel toggle button. */
const BOTTOM_PANEL_TOGGLE_ID = 'bottom-panel-toggle';
/** The class name added to the main area panel. */
const MAIN_AREA_CLASS = 'theia-app-main';
/** The class name added to the bottom area panel. */
const BOTTOM_AREA_CLASS = 'theia-app-bottom';

const LAYOUT_DATA_VERSION = '2.0';

export const ApplicationShellOptions = Symbol('ApplicationShellOptions');
export const DockPanelRendererFactory = Symbol('DockPanelRendererFactory');

/**
 * A renderer for dock panels that supports context menus on tabs.
 */
@injectable()
export class DockPanelRenderer implements DockLayout.IRenderer {

    readonly tabBarClasses: string[] = [];

    constructor(
        @inject(TabBarRendererFactory) protected readonly tabBarRendererFactory: () => TabBarRenderer
    ) { }

    createTabBar(): TabBar<Widget> {
        const renderer = this.tabBarRendererFactory();
        const tabBar = new ScrollableTabBar({
            renderer,
            // Scroll bar options
            handlers: ['drag-thumb', 'keyboard', 'wheel', 'touch'],
            useBothWheelAxes: true,
            scrollXMarginOffset: 4,
            suppressScrollY: true
        });
        this.tabBarClasses.forEach(c => tabBar.addClass(c));
        renderer.tabBar = tabBar;
        renderer.contextMenuPath = SHELL_TABBAR_CONTEXT_MENU;
        tabBar.currentChanged.connect(this.onCurrentTabChanged, this);
        return tabBar;
    }

    createHandle(): HTMLDivElement {
        return DockPanel.defaultRenderer.createHandle();
    }

    protected onCurrentTabChanged(sender: ScrollableTabBar, { currentIndex }: TabBar.ICurrentChangedArgs<Widget>): void {
        if (currentIndex >= 0) {
            sender.revealTab(currentIndex);
        }
    }
}

/**
 * Data stored while dragging widgets in the shell.
 */
interface WidgetDragState {
    startTime: number;
    leftExpanded: boolean;
    rightExpanded: boolean;
    bottomExpanded: boolean;
    lastDragOver?: IDragEvent;
    leaveTimeout?: number;
}

/**
 * The application shell manages the top-level widgets of the application. Use this class to
 * add, remove, or activate a widget.
 */
@injectable()
export class ApplicationShell extends Widget {

    /**
     * The dock panel in the main shell area. This is where editors usually go to.
     */
    readonly mainPanel: DockPanel;

    /**
     * The dock panel in the bottom shell area. In contrast to the main panel, the bottom panel
     * can be collapsed and expanded.
     */
    readonly bottomPanel: DockPanel;

    /**
     * Handler for the left side panel. The primary application views go here, such as the
     * file explorer and the git view.
     */
    readonly leftPanelHandler: SidePanelHandler;

    /**
     * Handler for the right side panel. The secondary application views go here, such as the
     * outline view.
     */
    readonly rightPanelHandler: SidePanelHandler;

    /**
     * General options for the application shell.
     */
    protected options: ApplicationShell.Options;

    /**
     * The fixed-size panel shown on top. This one usually holds the main menu.
     */
    protected topPanel: Panel;

    /**
     * The current state of the bottom panel.
     */
    protected readonly bottomPanelState: SidePanel.State = {
        empty: true,
        expansion: SidePanel.ExpansionState.collapsed,
        pendingUpdate: Promise.resolve()
    };

    private readonly tracker = new FocusTracker<Widget>();
    private dragState?: WidgetDragState;

    /**
     * Construct a new application shell.
     */
    constructor(
        @inject(DockPanelRendererFactory) protected dockPanelRendererFactory: () => DockPanelRenderer,
        @inject(StatusBarImpl) protected readonly statusBar: StatusBarImpl,
        @inject(SidePanelHandlerFactory) sidePanelHandlerFactory: () => SidePanelHandler,
        @inject(SplitPositionHandler) protected splitPositionHandler: SplitPositionHandler,
        @inject(FrontendApplicationStateService) protected readonly applicationStateService: FrontendApplicationStateService,
        @inject(ApplicationShellOptions) @optional() options: RecursivePartial<ApplicationShell.Options> = {}
    ) {
        super(options as Widget.IOptions);
        this.addClass(APPLICATION_SHELL_CLASS);
        this.id = 'theia-app-shell';

        // Merge the user-defined application options with the default options
        this.options = {
            bottomPanel: {
                ...ApplicationShell.DEFAULT_OPTIONS.bottomPanel,
                ...options.bottomPanel || {}
            },
            leftPanel: {
                ...ApplicationShell.DEFAULT_OPTIONS.leftPanel,
                ...options.leftPanel || {}
            },
            rightPanel: {
                ...ApplicationShell.DEFAULT_OPTIONS.rightPanel,
                ...options.rightPanel || {}
            }
        };

        this.mainPanel = this.createMainPanel();
        this.topPanel = this.createTopPanel();
        this.bottomPanel = this.createBottomPanel();
        this.leftPanelHandler = sidePanelHandlerFactory();
        this.leftPanelHandler.create('left', this.options.leftPanel);
        this.rightPanelHandler = sidePanelHandlerFactory();
        this.rightPanelHandler.create('right', this.options.rightPanel);
        this.layout = this.createLayout();

        this.tracker.currentChanged.connect(this.onCurrentChanged, this);
        this.tracker.activeChanged.connect(this.onActiveChanged, this);
    }

    protected onBeforeAttach(msg: Message): void {
        document.addEventListener('p-dragenter', this, true);
        document.addEventListener('p-dragover', this, true);
        document.addEventListener('p-dragleave', this, true);
        document.addEventListener('p-drop', this, true);
    }

    protected onAfterDetach(msg: Message): void {
        document.removeEventListener('p-dragenter', this, true);
        document.removeEventListener('p-dragover', this, true);
        document.removeEventListener('p-dragleave', this, true);
        document.removeEventListener('p-drop', this, true);
    }

    handleEvent(event: Event): void {
        switch (event.type) {
            case 'p-dragenter':
                this.onDragEnter(event as IDragEvent);
                break;
            case 'p-dragover':
                this.onDragOver(event as IDragEvent);
                break;
            case 'p-drop':
                this.onDrop(event as IDragEvent);
                break;
            case 'p-dragleave':
                this.onDragLeave(event as IDragEvent);
                break;
        }
    }

    protected onDragEnter({ mimeData }: IDragEvent) {
        if (!this.dragState) {
            if (mimeData && mimeData.hasData('application/vnd.phosphor.widget-factory')) {
                // The drag contains a widget, so we'll track it and expand side panels as needed
                this.dragState = {
                    startTime: performance.now(),
                    leftExpanded: false,
                    rightExpanded: false,
                    bottomExpanded: false
                };
            }
        }
    }

    protected onDragOver(event: IDragEvent) {
        const state = this.dragState;
        if (state) {
            state.lastDragOver = event;
            if (state.leaveTimeout) {
                window.clearTimeout(state.leaveTimeout);
                state.leaveTimeout = undefined;
            }
            const { clientX, clientY } = event;
            const { offsetLeft, offsetTop, clientWidth, clientHeight } = this.node;

            // Don't expand any side panels right after the drag has started
            const allowExpansion = performance.now() - state.startTime >= 500;
            const expLeft = allowExpansion && clientX >= offsetLeft
                && clientX <= offsetLeft + this.options.leftPanel.expandThreshold;
            const expRight = allowExpansion && clientX <= offsetLeft + clientWidth
                && clientX >= offsetLeft + clientWidth - this.options.rightPanel.expandThreshold;
            const expBottom = allowExpansion && !expLeft && !expRight && clientY <= offsetTop + clientHeight
                && clientY >= offsetTop + clientHeight - this.options.bottomPanel.expandThreshold;
            if (expLeft && !state.leftExpanded && this.leftPanelHandler.tabBar.currentTitle === null) {
                // The mouse cursor is moved close to the left border
                this.leftPanelHandler.expand();
                this.leftPanelHandler.state.pendingUpdate.then(() => this.dispatchMouseMove());
                state.leftExpanded = true;
            } else if (!expLeft && state.leftExpanded) {
                // The mouse cursor is moved away from the left border
                this.leftPanelHandler.collapse();
                state.leftExpanded = false;
            }
            if (expRight && !state.rightExpanded && this.rightPanelHandler.tabBar.currentTitle === null) {
                // The mouse cursor is moved close to the right border
                this.rightPanelHandler.expand();
                this.rightPanelHandler.state.pendingUpdate.then(() => this.dispatchMouseMove());
                state.rightExpanded = true;
            } else if (!expRight && state.rightExpanded) {
                // The mouse cursor is moved away from the right border
                this.rightPanelHandler.collapse();
                state.rightExpanded = false;
            }
            if (expBottom && !state.bottomExpanded && this.bottomPanel.isHidden) {
                // The mouse cursor is moved close to the bottom border
                this.expandBottomPanel();
                this.bottomPanelState.pendingUpdate.then(() => this.dispatchMouseMove());
                state.bottomExpanded = true;
            } else if (!expBottom && state.bottomExpanded) {
                // The mouse cursor is moved away from the bottom border
                this.collapseBottomPanel();
                state.bottomExpanded = false;
            }
        }
    }

    /**
     * This method is called after a side panel has been expanded while dragging a widget. It fires
     * a `mousemove` event so that the drag overlay markers are updated correctly in all dock panels.
     */
    private dispatchMouseMove(): void {
        if (this.dragState && this.dragState.lastDragOver) {
            const { clientX, clientY } = this.dragState.lastDragOver;
            const event = document.createEvent('MouseEvent');
            event.initMouseEvent('mousemove', true, true, window, 0, 0, 0,
                // tslint:disable-next-line:no-null-keyword
                clientX, clientY, false, false, false, false, 0, null);
            document.dispatchEvent(event);
        }
    }

    protected onDrop(event: IDragEvent) {
        const state = this.dragState;
        if (state) {
            if (state.leaveTimeout) {
                window.clearTimeout(state.leaveTimeout);
            }
            this.dragState = undefined;
            window.requestAnimationFrame(() => {
                // Clean up the side panel state in the next frame
                if (this.leftPanelHandler.dockPanel.isEmpty) {
                    this.leftPanelHandler.collapse();
                }
                if (this.rightPanelHandler.dockPanel.isEmpty) {
                    this.rightPanelHandler.collapse();
                }
                if (this.bottomPanel.isEmpty) {
                    this.collapseBottomPanel();
                }
            });
        }
    }

    protected onDragLeave(event: IDragEvent) {
        const state = this.dragState;
        if (state) {
            state.lastDragOver = undefined;
            if (state.leaveTimeout) {
                window.clearTimeout(state.leaveTimeout);
            }
            state.leaveTimeout = window.setTimeout(() => {
                this.dragState = undefined;
                if (state.leftExpanded || this.leftPanelHandler.dockPanel.isEmpty) {
                    this.leftPanelHandler.collapse();
                }
                if (state.rightExpanded || this.rightPanelHandler.dockPanel.isEmpty) {
                    this.rightPanelHandler.collapse();
                }
                if (state.bottomExpanded || this.bottomPanel.isEmpty) {
                    this.collapseBottomPanel();
                }
            }, 100);
        }
    }

    /**
     * Create the dock panel in the main shell area.
     */
    protected createMainPanel(): DockPanel {
        const renderer = this.dockPanelRendererFactory();
        renderer.tabBarClasses.push(MAIN_BOTTOM_AREA_CLASS);
        renderer.tabBarClasses.push(MAIN_AREA_CLASS);
        const dockPanel = new TheiaDockPanel({
            mode: 'multiple-document',
            renderer,
            spacing: 0
        });
        dockPanel.id = 'theia-main-content-panel';
        return dockPanel;
    }

    /**
     * Create the dock panel in the bottom shell area.
     */
    protected createBottomPanel(): DockPanel {
        const renderer = this.dockPanelRendererFactory();
        renderer.tabBarClasses.push(MAIN_BOTTOM_AREA_CLASS);
        renderer.tabBarClasses.push(BOTTOM_AREA_CLASS);
        const dockPanel = new TheiaDockPanel({
            mode: 'multiple-document',
            renderer,
            spacing: 0
        });
        dockPanel.id = 'theia-bottom-content-panel';
        dockPanel.widgetAdded.connect((sender, widget) => {
            this.refreshBottomPanelToggleButton();
        });
        dockPanel.widgetRemoved.connect((sender, widget) => {
            if (sender.isEmpty) {
                this.collapseBottomPanel();
            }
            this.refreshBottomPanelToggleButton();
        }, this);
        dockPanel.node.addEventListener('p-dragenter', event => {
            // Make sure that the main panel hides its overlay when the bottom panel is expanded
            this.mainPanel.overlay.hide(0);
        });
        dockPanel.hide();
        return dockPanel;
    }

    /**
     * Create the top panel, which is used to hold the main menu.
     */
    protected createTopPanel(): Panel {
        const topPanel = new Panel();
        topPanel.id = 'theia-top-panel';
        return topPanel;
    }

    /**
     * Create a box layout to assemble the application shell layout.
     */
    protected createBoxLayout(widgets: Widget[], stretch?: number[], options?: BoxPanel.IOptions): BoxLayout {
        const boxLayout = new BoxLayout(options);
        for (let i = 0; i < widgets.length; i++) {
            if (stretch !== undefined && i < stretch.length) {
                BoxPanel.setStretch(widgets[i], stretch[i]);
            }
            boxLayout.addWidget(widgets[i]);
        }
        return boxLayout;
    }

    /**
     * Create a split layout to assemble the application shell layout.
     */
    protected createSplitLayout(widgets: Widget[], stretch?: number[], options?: Partial<SplitLayout.IOptions>): SplitLayout {
        let optParam: SplitLayout.IOptions = { renderer: SplitPanel.defaultRenderer, };
        if (options) {
            optParam = { ...optParam, ...options };
        }
        const splitLayout = new SplitLayout(optParam);
        for (let i = 0; i < widgets.length; i++) {
            if (stretch !== undefined && i < stretch.length) {
                SplitPanel.setStretch(widgets[i], stretch[i]);
            }
            splitLayout.addWidget(widgets[i]);
        }
        return splitLayout;
    }

    /**
     * Assemble the application shell layout. Override this method in order to change the arrangement
     * of the main area and the side panels.
     */
    protected createLayout(): Layout {
        const bottomSplitLayout = this.createSplitLayout(
            [this.mainPanel, this.bottomPanel],
            [1, 0],
            { orientation: 'vertical', spacing: 0 }
        );
        const panelForBottomArea = new SplitPanel({ layout: bottomSplitLayout });
        panelForBottomArea.id = 'theia-bottom-split-panel';

        const leftRightSplitLayout = this.createSplitLayout(
            [this.leftPanelHandler.container, panelForBottomArea, this.rightPanelHandler.container],
            [0, 1, 0],
            { orientation: 'horizontal', spacing: 0 }
        );
        const panelForSideAreas = new SplitPanel({ layout: leftRightSplitLayout });
        panelForSideAreas.id = 'theia-left-right-split-panel';

        return this.createBoxLayout(
            [this.topPanel, panelForSideAreas, this.statusBar],
            [0, 1, 0],
            { direction: 'top-to-bottom', spacing: 0 }
        );
    }

    /**
     * Create an object that describes the current shell layout. This object may contain references
     * to widgets; these need to be transformed before the layout can be serialized.
     */
    getLayoutData(): ApplicationShell.LayoutData {
        return {
            version: LAYOUT_DATA_VERSION,
            mainPanel: this.mainPanel.saveLayout(),
            bottomPanel: {
                config: this.bottomPanel.saveLayout(),
                size: this.bottomPanel.isVisible ? this.getBottomPanelSize() : this.bottomPanelState.lastPanelSize,
                expanded: this.isExpanded('bottom')
            },
            leftPanel: this.leftPanelHandler.getLayoutData(),
            rightPanel: this.rightPanelHandler.getLayoutData(),
            activeWidgetId: this.activeWidget ? this.activeWidget.id : undefined
        };
    }

    /**
     * Compute the current height of the bottom panel. This implementation assumes that the container
     * of the bottom panel is a `SplitPanel`.
     */
    protected getBottomPanelSize(): number | undefined {
        const parent = this.bottomPanel.parent;
        if (parent instanceof SplitPanel && parent.isVisible) {
            const index = parent.widgets.indexOf(this.bottomPanel) - 1;
            if (index >= 0) {
                const handle = parent.handles[index];
                if (!handle.classList.contains('p-mod-hidden')) {
                    const parentHeight = parent.node.clientHeight;
                    return parentHeight - handle.offsetTop;
                }
            }
        }
    }

    /**
     * Determine the default size to apply when the bottom panel is expanded for the first time.
     */
    protected getDefaultBottomPanelSize(): number | undefined {
        const parent = this.bottomPanel.parent;
        if (parent && parent.isVisible) {
            return parent.node.clientHeight * this.options.bottomPanel.initialSizeRatio;
        }
    }

    /**
     * Apply a shell layout that has been previously created with `getLayoutData`.
     */
    async setLayoutData(layoutData: ApplicationShell.LayoutData): Promise<void> {
        const { mainPanel, bottomPanel, leftPanel, rightPanel, activeWidgetId } = this.getValidatedLayoutData(layoutData);
        if (leftPanel) {
            this.leftPanelHandler.setLayoutData(leftPanel);
            this.registerWithFocusTracker(leftPanel);
        }
        if (rightPanel) {
            this.rightPanelHandler.setLayoutData(rightPanel);
            this.registerWithFocusTracker(rightPanel);
        }
        // Proceed with the bottom panel once the side panels are set up
        await Promise.all([this.leftPanelHandler.state.pendingUpdate, this.rightPanelHandler.state.pendingUpdate]);
        if (bottomPanel) {
            if (bottomPanel.config) {
                this.bottomPanel.restoreLayout(bottomPanel.config);
                this.registerWithFocusTracker(bottomPanel.config.main);
            }
            if (bottomPanel.size) {
                this.bottomPanelState.lastPanelSize = bottomPanel.size;
            }
            if (bottomPanel.expanded) {
                this.expandBottomPanel();
            } else {
                this.collapseBottomPanel();
            }
            this.refreshBottomPanelToggleButton();
        }
        // Proceed with the main panel once all others are set up
        await this.bottomPanelState.pendingUpdate;
        if (mainPanel) {
            this.mainPanel.restoreLayout(mainPanel);
            this.registerWithFocusTracker(mainPanel.main);
        }
        if (activeWidgetId) {
            this.activateWidget(activeWidgetId);
        }
    }

    protected getValidatedLayoutData(layoutData: ApplicationShell.LayoutData) {
        if (layoutData.version !== LAYOUT_DATA_VERSION) {
            throw new Error(`Saved workbench layout (version ${layoutData.version || 'unknown'}) is incompatible with the current (${LAYOUT_DATA_VERSION})`);
        }
        return layoutData;
    }

    /**
     * Modify the height of the bottom panel. This implementation assumes that the container of the
     * bottom panel is a `SplitPanel`.
     */
    protected setBottomPanelSize(size: number): Promise<void> {
        const enableAnimation = this.applicationStateService.state === 'ready';
        const options: SplitPositionOptions = {
            side: 'bottom',
            duration: enableAnimation ? this.options.bottomPanel.expandDuration : 0,
            referenceWidget: this.bottomPanel
        };
        const promise = this.splitPositionHandler.setSidePanelSize(this.bottomPanel, size, options);
        const result = new Promise<void>(resolve => {
            // Resolve the resulting promise in any case, regardless of whether resizing was successful
            promise.then(() => resolve(), () => resolve());
        });
        this.bottomPanelState.pendingUpdate = this.bottomPanelState.pendingUpdate.then(() => result);
        return result;
    }

    /**
     * A promise that is resolved when all currently pending updates are done.
     */
    get pendingUpdates(): Promise<void> {
        return Promise.all([
            this.bottomPanelState.pendingUpdate,
            this.leftPanelHandler.state.pendingUpdate,
            this.rightPanelHandler.state.pendingUpdate
            // tslint:disable-next-line:no-any
        ]) as Promise<any>;
    }

    /**
     * Track all widgets that are referenced by the given layout data.
     */
    protected registerWithFocusTracker(data: DockLayout.ITabAreaConfig | DockLayout.ISplitAreaConfig | SidePanel.LayoutData | null): void {
        if (data) {
            if (data.type === 'tab-area') {
                for (const widget of data.widgets) {
                    if (widget) {
                        this.track(widget);
                    }
                }
            } else if (data.type === 'split-area') {
                for (const child of data.children) {
                    this.registerWithFocusTracker(child);
                }
            } else if (data.type === 'sidepanel' && data.items) {
                for (const item of data.items) {
                    if (item.widget) {
                        this.track(item.widget);
                    }
                }
            }
        }
    }

    /**
     * Add a widget to the application shell. The given widget must have a unique `id` property,
     * which will be used as the DOM id.
     *
     * Widgets are removed from the shell by calling their `close` or `dispose` methods.
     *
     * Widgets added to the top area are not tracked regarding the _current_ and _active_ states.
     */
    addWidget(widget: Widget, options: ApplicationShell.WidgetOptions) {
        if (!widget.id) {
            console.error('Widgets added to the application shell must have a unique id property.');
            return;
        }
        switch (options.area) {
            case 'main':
                this.mainPanel.addWidget(widget, options);
                break;
            case 'top':
                this.topPanel.addWidget(widget);
                break;
            case 'bottom':
                this.bottomPanel.addWidget(widget, options);
                break;
            case 'left':
                this.leftPanelHandler.addWidget(widget, options);
                break;
            case 'right':
                this.rightPanelHandler.addWidget(widget, options);
                break;
            default:
                throw new Error('Illegal argument: ' + options.area);
        }
        if (options.area !== 'top') {
            this.track(widget);
        }
    }

    /**
     * The widgets contained in the given shell area.
     */
    getWidgets(area: ApplicationShell.Area): Widget[] {
        switch (area) {
            case 'main':
                return toArray(this.mainPanel.widgets());
            case 'top':
                return toArray(this.topPanel.widgets);
            case 'bottom':
                return toArray(this.bottomPanel.widgets());
            case 'left':
                return toArray(this.leftPanelHandler.dockPanel.widgets());
            case 'right':
                return toArray(this.rightPanelHandler.dockPanel.widgets());
            default:
                throw new Error('Illegal argument: ' + area);
        }
    }

    /**
     * The current widget in the application shell. The current widget is the last widget that
     * was active and not yet closed. See the remarks to `activeWidget` on what _active_ means.
     */
    get currentWidget(): Widget | undefined {
        return this.tracker.currentWidget || undefined;
    }

    /**
     * The active widget in the application shell. The active widget is the one that has focus
     * (either the widget itself or any of its contents).
     *
     * _Note:_ Focus is taken by a widget through the `onActivateRequest` method. It is up to the
     * widget implementation which DOM element will get the focus. The default implementation
     * does not take any focus; in that case the widget is never returned by this property.
     */
    get activeWidget(): Widget | undefined {
        return this.tracker.activeWidget || undefined;
    }

    /**
     * A signal emitted whenever the `currentWidget` property is changed.
     */
    readonly currentChanged = new Signal<this, FocusTracker.IChangedArgs<Widget>>(this);

    /**
     * Handle a change to the current widget.
     */
    private onCurrentChanged(sender: FocusTracker<Widget>, args: FocusTracker.IChangedArgs<Widget>): void {
        this.currentChanged.emit(args);
    }

    /**
     * A signal emitted whenever the `activeWidget` property is changed.
     */
    readonly activeChanged = new Signal<this, FocusTracker.IChangedArgs<Widget>>(this);

    /**
     * Handle a change to the active widget.
     */
    private onActiveChanged(sender: FocusTracker<Widget>, args: FocusTracker.IChangedArgs<Widget>): void {
        const { newValue, oldValue } = args;
        if (oldValue) {
            // Remove the mark of the previously active widget
            oldValue.title.className = oldValue.title.className.replace(' theia-mod-active', '');
            // Reset the z-index to the default
            // tslint:disable-next-line:no-null-keyword
            this.setZIndex(oldValue.node, null);
        }
        if (newValue) {
            // Mark the tab of the active widget
            newValue.title.className += ' theia-mod-active';
            // Reveal the title of the active widget in its tab bar
            const tabBar = this.getTabBarFor(newValue);
            if (tabBar instanceof ScrollableTabBar) {
                const index = tabBar.titles.indexOf(newValue.title);
                if (index >= 0) {
                    tabBar.revealTab(index);
                }
            }
            // Set the z-index so elements with `position: fixed` contained in the active widget are displayed correctly
            this.setZIndex(newValue.node, '1');
        }
        this.activeChanged.emit(args);
    }

    /**
     * Set the z-index of the given element and its ancestors to the value `z`.
     */
    private setZIndex(element: HTMLElement, z: string | null) {
        element.style.zIndex = z as any;
        const parent = element.parentElement;
        if (parent && parent !== this.node) {
            this.setZIndex(parent, z);
        }
    }

    /**
     * Track the given widget so it is considered in the `current` and `active` state of the shell.
     */
    protected track(widget: Widget): void {
        this.tracker.add(widget);
        Saveable.apply(widget);
    }

    /**
     * Activate a widget in the application shell. This makes the widget visible and usually
     * also assigns focus to it.
     *
     * _Note:_ Focus is taken by a widget through the `onActivateRequest` method. It is up to the
     * widget implementation which DOM element will get the focus. The default implementation
     * does not take any focus.
     *
     * @returns the activated widget if it was found
     */
    activateWidget(id: string): Widget | undefined {
        let widget = find(this.mainPanel.widgets(), w => w.id === id);
        if (widget) {
            this.mainPanel.activateWidget(widget);
            return this.checkActivation(widget);
        }
        widget = find(this.bottomPanel.widgets(), w => w.id === id);
        if (widget) {
            this.expandBottomPanel();
            this.bottomPanel.activateWidget(widget);
            return this.checkActivation(widget);
        }
        widget = this.leftPanelHandler.activate(id);
        if (widget) {
            return this.checkActivation(widget);
        }
        widget = this.rightPanelHandler.activate(id);
        if (widget) {
            return this.checkActivation(widget);
        }
    }

    /**
     * Focus is taken by a widget through the `onActivateRequest` method. It is up to the
     * widget implementation which DOM element will get the focus. The default implementation
     * of Widget does not take any focus. This method can help finding such problems by logging
     * a warning in case a widget was explicitly activated, but did not trigger a change of the
     * `activeWidget` property.
     */
    private checkActivation(widget: Widget): Widget {
        window.requestAnimationFrame(() => {
            if (this.activeWidget !== widget) {
                console.warn("Widget was activated, but did not accept focus: " + widget.id);
            }
        });
        return widget;
    }

    /**
     * Reveal a widget in the application shell. This makes the widget visible,
     * but does not activate it.
     *
     * @returns the revealed widget if it was found
     */
    revealWidget(id: string): Widget | undefined {
        let widget = find(this.mainPanel.widgets(), w => w.id === id);
        if (!widget) {
            widget = find(this.bottomPanel.widgets(), w => w.id === id);
            if (widget) {
                this.expandBottomPanel();
            }
        }
        if (widget) {
            const tabBar = this.getTabBarFor(widget);
            if (tabBar) {
                tabBar.currentTitle = widget.title;
            }
            return widget;
        }
        widget = this.leftPanelHandler.expand(id);
        if (widget) {
            return widget;
        }
        widget = this.rightPanelHandler.expand(id);
        if (widget) {
            return widget;
        }
    }

    /**
     * Expand the named side panel area. This makes sure that the panel is visible, even if there
     * are no widgets in it. If the panel is already visible, nothing happens. If the panel is currently
     * collapsed (see `collapsePanel`) and it contains widgets, the widgets are revealed that were
     * visible before it was collapsed.
     */
    expandPanel(area: ApplicationShell.Area): void {
        switch (area) {
            case 'bottom':
                this.expandBottomPanel();
                break;
            case 'left':
                this.leftPanelHandler.expand();
                break;
            case 'right':
                this.rightPanelHandler.expand();
                break;
            default:
                throw new Error('Area cannot be expanded: ' + area);
        }
    }

    /**
     * Adjusts the size of the given area in the application shell.
     *
     * @param size the desired size of the panel in pixels.
     * @param area the area to resize.
     */
    resize(size: number, area: ApplicationShell.Area): void {
        switch (area) {
            case 'bottom':
                if (this.bottomPanel.isHidden) {
                    this.bottomPanelState.lastPanelSize = size;
                } else {
                    this.setBottomPanelSize(size);
                }
                break;
            case 'left':
                this.leftPanelHandler.resize(size);
                break;
            case 'right':
                this.rightPanelHandler.resize(size);
                break;
            default:
                throw new Error('Area cannot be resized: ' + area);
        }
    }

    /**
     * Expand the bottom panel. See `expandPanel` regarding the exact behavior.
     */
    protected expandBottomPanel(): void {
        const bottomPanel = this.bottomPanel;
        if (bottomPanel.isHidden) {
            let relativeSizes: number[] | undefined;
            const parent = bottomPanel.parent;
            if (parent instanceof SplitPanel) {
                relativeSizes = parent.relativeSizes();
            }
            bottomPanel.show();
            if (relativeSizes && parent instanceof SplitPanel) {
                // Make sure that the expansion animation starts at the smallest possible size
                parent.setRelativeSizes(relativeSizes);
            }

            let size: number | undefined;
            if (bottomPanel.isEmpty) {
                bottomPanel.node.style.minHeight = '0';
                size = this.options.bottomPanel.emptySize;
            } else if (this.bottomPanelState.lastPanelSize) {
                size = this.bottomPanelState.lastPanelSize;
            } else {
                size = this.getDefaultBottomPanelSize();
            }
            if (size) {
                this.bottomPanelState.expansion = SidePanel.ExpansionState.expanding;
                this.setBottomPanelSize(size).then(() => {
                    if (this.bottomPanelState.expansion === SidePanel.ExpansionState.expanding) {
                        this.bottomPanelState.expansion = SidePanel.ExpansionState.expanded;
                    }
                });
            } else {
                this.bottomPanelState.expansion = SidePanel.ExpansionState.expanded;
            }
        }
    }

    /**
     * Collapse the named side panel area. This makes sure that the panel is hidden,
     * increasing the space that is available for other shell areas.
     */
    collapsePanel(area: ApplicationShell.Area): void {
        switch (area) {
            case 'bottom':
                this.collapseBottomPanel();
                break;
            case 'left':
                this.leftPanelHandler.collapse();
                break;
            case 'right':
                this.rightPanelHandler.collapse();
                break;
            default:
                throw new Error('Area cannot be collapsed: ' + area);
        }
    }

    /**
     * Collapse the bottom panel. All contained widgets are hidden, but not closed.
     * They can be restored by calling `expandBottomPanel`.
     */
    protected collapseBottomPanel(): void {
        const bottomPanel = this.bottomPanel;
        if (!bottomPanel.isHidden) {
            if (this.bottomPanelState.expansion === SidePanel.ExpansionState.expanded) {
                const size = this.getBottomPanelSize();
                if (size) {
                    this.bottomPanelState.lastPanelSize = size;
                }
            }
            this.bottomPanelState.expansion = SidePanel.ExpansionState.collapsed;
            bottomPanel.hide();
        }
    }

    /**
     * Refresh the toggle button for the bottom panel. This implementation creates a status bar entry
     * and refers to the command `core.toggle.bottom.panel`.
     */
    protected refreshBottomPanelToggleButton() {
        if (this.bottomPanel.isEmpty) {
            this.statusBar.removeElement(BOTTOM_PANEL_TOGGLE_ID);
        } else {
            const element: StatusBarEntry = {
                text: '$(window-maximize)',
                alignment: StatusBarAlignment.RIGHT,
                tooltip: 'Toggle Bottom Panel',
                command: 'core.toggle.bottom.panel',
                priority: 0
            };
            this.statusBar.setElement(BOTTOM_PANEL_TOGGLE_ID, element);
        }
    }

    /**
     * Check whether the named side panel area is expanded (returns `true`) or collapsed (returns `false`).
     */
    isExpanded(area: ApplicationShell.Area): boolean {
        switch (area) {
            case 'bottom':
                return this.bottomPanelState.expansion === SidePanel.ExpansionState.expanded;
            case 'left':
                return this.leftPanelHandler.state.expansion === SidePanel.ExpansionState.expanded;
            case 'right':
                return this.rightPanelHandler.state.expansion === SidePanel.ExpansionState.expanded;
            default:
                return true;
        }
    }

    /**
     * Close all tabs or a selection of tabs in a specific part of the application shell.
     *
     * @param tabBarOrArea
     *      Either the name of a shell area or a `TabBar` that is contained in such an area.
     * @param filter
     *      If undefined, all tabs are closed; otherwise only those tabs that match the filter are closed.
     */
    closeTabs(tabBarOrArea: TabBar<Widget> | ApplicationShell.Area,
        filter?: (title: Title<Widget>, index: number) => boolean): void {
        if (tabBarOrArea === 'main') {
            this.mainAreaTabBars.forEach(tb => this.closeTabs(tb, filter));
        } else if (tabBarOrArea === 'bottom') {
            this.bottomAreaTabBars.forEach(tb => this.closeTabs(tb, filter));
        } else if (typeof tabBarOrArea === 'string') {
            const tabBar = this.getTabBarFor(tabBarOrArea);
            if (tabBar) {
                this.closeTabs(tabBar, filter);
            }
        } else if (tabBarOrArea) {
            const titles = toArray(tabBarOrArea.titles);
            for (let i = 0; i < titles.length; i++) {
                if (filter === undefined || filter(titles[i], i)) {
                    titles[i].owner.close();
                }
            }
        }
    }

    /**
     * The shell area name of the currently active tab, or undefined.
     */
    get currentTabArea(): ApplicationShell.Area | undefined {
        const currentWidget = this.currentWidget;
        if (currentWidget) {
            return this.getAreaFor(currentWidget);
        }
    }

    /**
     * Determine the name of the shell area where the given widget resides. The result is
     * undefined if the widget does not reside directly in the shell.
     */
    getAreaFor(widget: Widget): ApplicationShell.Area | undefined {
        const title = widget.title;
        const mainPanelTabBar = find(this.mainPanel.tabBars(), bar => ArrayExt.firstIndexOf(bar.titles, title) > -1);
        if (mainPanelTabBar) {
            return 'main';
        }
        const bottomPanelTabBar = find(this.bottomPanel.tabBars(), bar => ArrayExt.firstIndexOf(bar.titles, title) > -1);
        if (bottomPanelTabBar) {
            return 'bottom';
        }
        if (ArrayExt.firstIndexOf(this.leftPanelHandler.tabBar.titles, title) > -1) {
            return 'left';
        }
        if (ArrayExt.firstIndexOf(this.rightPanelHandler.tabBar.titles, title) > -1) {
            return 'right';
        }
    }

    /**
     * Return the tab bar that has the currently active widget, or undefined.
     */
    get currentTabBar(): TabBar<Widget> | undefined {
        const currentWidget = this.currentWidget;
        if (currentWidget) {
            return this.getTabBarFor(currentWidget);
        }
    }

    /**
     * Return the tab bar in the given shell area, or the tab bar that has the given widget, or undefined.
     */
    getTabBarFor(widgetOrArea: Widget | ApplicationShell.Area): TabBar<Widget> | undefined {
        if (typeof widgetOrArea === 'string') {
            switch (widgetOrArea) {
                case 'main':
                    return this.mainPanel.tabBars().next();
                case 'bottom':
                    return this.bottomPanel.tabBars().next();
                case 'left':
                    return this.leftPanelHandler.tabBar;
                case 'right':
                    return this.rightPanelHandler.tabBar;
                default:
                    throw new Error('Illegal argument: ' + widgetOrArea);
            }
        } else if (widgetOrArea && widgetOrArea.isAttached) {
            const widgetTitle = widgetOrArea.title;
            const mainPanelTabBar = find(this.mainPanel.tabBars(), bar => ArrayExt.firstIndexOf(bar.titles, widgetTitle) > -1);
            if (mainPanelTabBar) {
                return mainPanelTabBar;
            }
            const bottomPanelTabBar = find(this.bottomPanel.tabBars(), bar => ArrayExt.firstIndexOf(bar.titles, widgetTitle) > -1);
            if (bottomPanelTabBar) {
                return bottomPanelTabBar;
            }
            const leftPanelTabBar = this.leftPanelHandler.tabBar;
            if (ArrayExt.firstIndexOf(leftPanelTabBar.titles, widgetTitle) > -1) {
                return leftPanelTabBar;
            }
            const rightPanelTabBar = this.rightPanelHandler.tabBar;
            if (ArrayExt.firstIndexOf(rightPanelTabBar.titles, widgetTitle) > -1) {
                return rightPanelTabBar;
            }
        }
    }

    /**
     * The tab bars contained in the main shell area. If there is no widget in the main area, the
     * returned array is empty.
     */
    get mainAreaTabBars(): TabBar<Widget>[] {
        return toArray(this.mainPanel.tabBars());
    }

    /**
     * The tab bars contained in the bottom shell area. If there is no widget in the bottom area,
     * the returned array is empty.
     */
    get bottomAreaTabBars(): TabBar<Widget>[] {
        return toArray(this.bottomPanel.tabBars());
    }

    /**
     * The tab bars contained in all shell areas.
     */
    get allTabBars(): TabBar<Widget>[] {
        return [...this.mainAreaTabBars, ...this.bottomAreaTabBars, this.leftPanelHandler.tabBar, this.rightPanelHandler.tabBar];
    }

    /*
     * Activate the next tab in the current tab bar.
     */
    activateNextTab(): void {
        const current = this.currentTabBar;
        if (current) {
            const ci = current.currentIndex;
            if (ci !== -1) {
                if (ci < current.titles.length - 1) {
                    current.currentIndex += 1;
                    if (current.currentTitle) {
                        current.currentTitle.owner.activate();
                    }
                } else if (ci === current.titles.length - 1) {
                    const nextBar = this.nextTabBar(current);
                    nextBar.currentIndex = 0;
                    if (nextBar.currentTitle) {
                        nextBar.currentTitle.owner.activate();
                    }
                }
            }
        }
    }

    /**
     * Return the tab bar next to the given tab bar; return the given tab bar if there is no adjacent one.
     */
    private nextTabBar(current: TabBar<Widget>): TabBar<Widget> {
        let bars = toArray(this.bottomPanel.tabBars());
        let len = bars.length;
        let ci = ArrayExt.firstIndexOf(bars, current);
        if (ci < 0) {
            bars = toArray(this.mainPanel.tabBars());
            len = bars.length;
            ci = ArrayExt.firstIndexOf(bars, current);
        }
        if (ci >= 0 && ci < len - 1) {
            return bars[ci + 1];
        } else if (ci >= 0 && ci === len - 1) {
            return bars[0];
        } else {
            return current;
        }
    }

    /*
     * Activate the previous tab in the current tab bar.
     */
    activatePreviousTab(): void {
        const current = this.currentTabBar;
        if (current) {
            const ci = current.currentIndex;
            if (ci !== -1) {
                if (ci > 0) {
                    current.currentIndex -= 1;
                    if (current.currentTitle) {
                        current.currentTitle.owner.activate();
                    }
                } else if (ci === 0) {
                    const prevBar = this.previousTabBar(current);
                    const len = prevBar.titles.length;
                    prevBar.currentIndex = len - 1;
                    if (prevBar.currentTitle) {
                        prevBar.currentTitle.owner.activate();
                    }
                }
            }
        }
    }

    /**
     * Return the tab bar previous to the given tab bar; return the given tab bar if there is no adjacent one.
     */
    private previousTabBar(current: TabBar<Widget>): TabBar<Widget> {
        const bars = toArray(this.mainPanel.tabBars());
        const len = bars.length;
        const ci = ArrayExt.firstIndexOf(bars, current);
        if (ci > 0) {
            return bars[ci - 1];
        } else if (ci === 0) {
            return bars[len - 1];
        } else {
            return current;
        }
    }

    /**
     * Test whether the current widget is dirty.
     */
    canSave(): boolean {
        return Saveable.isDirty(this.currentWidget);
    }

    /**
     * Save the current widget if it is dirty.
     */
    async save(): Promise<void> {
        await Saveable.save(this.currentWidget);
    }

    /**
     * Test whether there is a dirty widget.
     */
    canSaveAll(): boolean {
        return this.tracker.widgets.some(Saveable.isDirty);
    }

    /**
     * Save all dirty widgets.
     */
    async saveAll(): Promise<void> {
        await Promise.all(this.tracker.widgets.map(Saveable.save));
    }

}

/**
 * The namespace for `ApplicationShell` class statics.
 */
export namespace ApplicationShell {
    /**
     * The areas of the application shell where widgets can reside.
     */
    export type Area = 'main' | 'top' | 'left' | 'right' | 'bottom';

    /**
     * The _side areas_ are those shell areas that can be collapsed and expanded,
     * i.e. `left`, `right`, and `bottom`.
     */
    export function isSideArea(area?: Area): area is 'left' | 'right' | 'bottom' {
        return area === 'left' || area === 'right' || area === 'bottom';
    }

    /**
     * General options for the application shell. These are passed on construction and can be modified
     * through dependency injection (`ApplicationShellOptions` symbol).
     */
    export interface Options extends Widget.IOptions {
        bottomPanel: BottomPanelOptions;
        leftPanel: SidePanel.Options;
        rightPanel: SidePanel.Options;
    }

    export interface BottomPanelOptions extends SidePanel.Options {
    }

    /**
     * The default values for application shell options.
     */
    export const DEFAULT_OPTIONS = Object.freeze(<Options>{
        bottomPanel: Object.freeze(<BottomPanelOptions>{
            emptySize: 140,
            expandThreshold: 160,
            expandDuration: 150,
            initialSizeRatio: 0.382
        }),
        leftPanel: Object.freeze(<SidePanel.Options>{
            emptySize: 140,
            expandThreshold: 140,
            expandDuration: 150,
            initialSizeRatio: 0.191
        }),
        rightPanel: Object.freeze(<SidePanel.Options>{
            emptySize: 140,
            expandThreshold: 140,
            expandDuration: 150,
            initialSizeRatio: 0.191
        })
    });

    /**
     * Options for adding a widget to the application shell.
     */
    export interface WidgetOptions extends DockLayout.IAddOptions, SidePanel.WidgetOptions {
        /**
         * The area of the application shell where the widget will reside.
         */
        area: Area;
    }

    /**
     * Data to save and load the application shell layout.
     */
    export interface LayoutData {
        version?: string,
        mainPanel?: DockPanel.ILayoutConfig;
        bottomPanel?: BottomPanelLayoutData;
        leftPanel?: SidePanel.LayoutData;
        rightPanel?: SidePanel.LayoutData;
        activeWidgetId?: string;
    }

    /**
     * Data to save and load the bottom panel layout.
     */
    export interface BottomPanelLayoutData {
        config?: DockPanel.ILayoutConfig;
        size?: number;
        expanded?: boolean;
    }
}
