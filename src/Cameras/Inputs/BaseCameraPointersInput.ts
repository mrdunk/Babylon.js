import { Nullable } from "../../types";
import { serialize } from "../../Misc/decorators";
import { EventState, Observable, Observer } from "../../Misc/observable";
import { Tools } from "../../Misc/tools";
import { Camera } from "../../Cameras/camera";
import { ICameraInput } from "../../Cameras/cameraInputsManager";
import { PointerInfo, PointerEventTypes, PointerTouch } from "../../Events/pointerEvents";

const DEBUG = false;
const COALESCE = true;
const DEFFER_CALLBACK = true;

/**
 * Base class for Camera Pointer Inputs.
 * See FollowCameraPointersInput in src/Cameras/Inputs/followCameraPointersInput.ts
 * for example usage.
 */
export abstract class BaseCameraPointersInput implements ICameraInput<Camera> {
    /**
     * Defines the camera the input is attached to.
     */
    public abstract camera: Camera;

    /**
     * Whether keyboard modifier keys are pressed at time of last mouse event.
     */
    protected _altKey: boolean;
    protected _ctrlKey: boolean;
    protected _metaKey: boolean;
    protected _shiftKey: boolean;

    /**
     * Which mouse buttons were pressed at time of last mouse event.
     * https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
     */
    protected _buttonsPressed: number;

    /**
     * Defines the buttons associated with the input to handle camera move.
     */
    @serialize()
    public buttons = [0, 1, 2];

    /**
     * Attach the input controls to a specific dom element to get the input from.
     * @param element Defines the element the controls should be listened from
     * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
     */
    public attachControl(noPreventDefault?: boolean): void {
        noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
        var engine = this.camera.getEngine();
        const element = engine.getInputElement();
        var previousPinchSquaredDistance = 0;
        var previousMultiTouchPanPosition: Nullable<PointerTouch> = null;

        this._pointA = null;
        this._pointB = null;

        this._altKey = false;
        this._ctrlKey = false;
        this._metaKey = false;
        this._shiftKey = false;
        this._buttonsPressed = 0;

        this._pointerInput = (p, s) => {
            var evt = <PointerEvent>p.event;
            let isTouch = evt.pointerType === "touch";

            if (engine.isInVRExclusivePointerMode) {
                return;
            }

            if (p.type !== PointerEventTypes.POINTERMOVE &&
                this.buttons.indexOf(evt.button) === -1) {
                return;
            }

            let srcElement = <HTMLElement>(evt.srcElement || evt.target);

            this._altKey = evt.altKey;
            this._ctrlKey = evt.ctrlKey;
            this._metaKey = evt.metaKey;
            this._shiftKey = evt.shiftKey;
            this._buttonsPressed = evt.buttons;

            if (engine.isPointerLock) {
                var offsetX = evt.movementX ||
                              evt.mozMovementX ||
                              evt.webkitMovementX ||
                              evt.msMovementX ||
                              0;
                var offsetY = evt.movementY ||
                              evt.mozMovementY ||
                              evt.webkitMovementY ||
                              evt.msMovementY ||
                              0;

                // TODO: Can we get away with modifying this to also passing the
                // event as the first parameter here?
                // It would be useful for determining other things about state.
                // (Button presses, keyboard modifiers, etc.)
                // It would be a change to the current behaviour but unlikely to
                // cause harm unless a user relies on this to know if they are
                // in pointerlock...
                this._addEventsTouch(null, offsetX, offsetY);

                this._pointA = null;
                this._pointB = null;
            } else if (p.type === PointerEventTypes.POINTERDOWN && srcElement) {
                try {
                    srcElement.setPointerCapture(evt.pointerId);
                } catch (e) {
                    //Nothing to do with the error. Execution will continue.
                }

                if (this._pointA === null) {
                    this._pointA = {x: evt.clientX,
                              y: evt.clientY,
                              pointerId: evt.pointerId,
                              type: evt.pointerType };
                } else if (this._pointB === null) {
                    this._pointB = {x: evt.clientX,
                              y: evt.clientY,
                              pointerId: evt.pointerId,
                              type: evt.pointerType };
                }

                this._addEventsButtonDown(event = evt);

                if (!noPreventDefault) {
                    evt.preventDefault();
                    element && element.focus();
                }
            } else if (p.type === PointerEventTypes.POINTERDOUBLETAP) {
                this._addEventsDoubleTap(evt.pointerType);
            } else if (p.type === PointerEventTypes.POINTERUP && srcElement) {
                try {
                    srcElement.releasePointerCapture(evt.pointerId);
                } catch (e) {
                    //Nothing to do with the error.
                }

                if (!isTouch) {
                    this._pointB = null; // Mouse and pen are mono pointer
                }

                //would be better to use pointers.remove(evt.pointerId) for multitouch gestures,
                //but emptying completely pointers collection is required to fix a bug on iPhone :
                //when changing orientation while pinching camera,
                //one pointer stay pressed forever if we don't release all pointers
                //will be ok to put back pointers.remove(evt.pointerId); when iPhone bug corrected
                if (engine._badOS) {
                    this._pointA = this._pointB = null;
                } else {
                    //only remove the impacted pointer in case of multitouch allowing on most
                    //platforms switching from rotate to zoom and pan seamlessly.
                    if (this._pointB && this._pointA && this._pointA.pointerId == evt.pointerId) {
                        this._pointA = this._pointB;
                        this._pointB = null;
                    } else if (this._pointA && this._pointB &&
                               this._pointB.pointerId == evt.pointerId) {
                        this._pointB = null;
                    } else {
                        this._pointA = this._pointB = null;
                    }
                }

                if (previousPinchSquaredDistance !== 0 || previousMultiTouchPanPosition) {
                    // Previous pinch data is populated but a button has been lifted
                    // so pinch has ended.
                    this._addEventsMultiTouch(
                        this._pointA,
                        this._pointB,
                        previousPinchSquaredDistance,
                        0,  // pinchSquaredDistance
                        previousMultiTouchPanPosition,
                        null  // multiTouchPanPosition
                    );

                    previousPinchSquaredDistance = 0;
                    previousMultiTouchPanPosition = null;
                }

                this._addEventsButtonUp(event = evt);

                if (!noPreventDefault) {
                    evt.preventDefault();
                }
            } else if (p.type === PointerEventTypes.POINTERMOVE) {
                if (!noPreventDefault) {
                    evt.preventDefault();
                }

                // One button down
                if (this._pointA && this._pointB === null) {
                    var offsetX = evt.clientX - this._pointA.x;
                    var offsetY = evt.clientY - this._pointA.y;
                    this._addEventsTouch(this._pointA, offsetX, offsetY);

                    this._pointA.x = evt.clientX;
                    this._pointA.y = evt.clientY;
                }
                // Two buttons down: pinch
                else if (this._pointA && this._pointB) {
                    var ed = (this._pointA.pointerId === evt.pointerId) ?
                             this._pointA : this._pointB;
                    ed.x = evt.clientX;
                    ed.y = evt.clientY;
                    var distX = this._pointA.x - this._pointB.x;
                    var distY = this._pointA.y - this._pointB.y;
                    var pinchSquaredDistance = (distX * distX) + (distY * distY);
                    pinchSquaredDistance |= 0;  // Filter NaN.
                    var multiTouchPanPosition = {x: (this._pointA.x + this._pointB.x) / 2,
                                                 y: (this._pointA.y + this._pointB.y) / 2,
                                                 pointerId: evt.pointerId,
                                                 type: p.type};
                    this._addEventsMultiTouch(
                        this._pointA,
                        this._pointB,
                        previousPinchSquaredDistance,
                        pinchSquaredDistance,
                        previousMultiTouchPanPosition,
                        multiTouchPanPosition
                    );

                    previousMultiTouchPanPosition = multiTouchPanPosition;
                    previousPinchSquaredDistance = pinchSquaredDistance;
                }
            }
        };

        this._observer = this.camera.getScene().onPointerObservable.add(
            this._pointerInput,
            PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERUP |
            PointerEventTypes.POINTERMOVE);

        this._onLostFocus = () => {
            this._pointA = this._pointB = null;
            previousPinchSquaredDistance = 0;
            previousMultiTouchPanPosition = null;
            this.onLostFocus();
        };

        element && element.addEventListener("contextmenu",
            <EventListener>this.onContextMenu.bind(this), false);

        let hostWindow = this.camera.getScene().getEngine().getHostWindow();

        if (hostWindow) {
            Tools.RegisterTopRootEvents(hostWindow, [
                { name: "blur", handler: this._onLostFocus }
            ]);
        }
    }

    /**
     * Detach the current controls from the specified dom element.
     */
    public detachControl(): void;

    /**
     * Detach the current controls from the specified dom element.
     * @param ignored defines an ignored parameter kept for backward compatibility. If you want to define the source input element, you can set engine.inputElement before calling camera.attachControl
     */
    public detachControl(ignored?: any): void {
        if (this._onLostFocus) {
            let hostWindow = this.camera.getScene().getEngine().getHostWindow();
            if (hostWindow) {
                Tools.UnregisterTopRootEvents(hostWindow, [
                    { name: "blur", handler: this._onLostFocus }
                ]);
            }
        }

        if (this._observer) {
            this.camera.getScene().onPointerObservable.remove(this._observer);
            this._observer = null;

            if (this.onContextMenu) {
                const inputElement = this.camera.getScene().getEngine().getInputElement();
                inputElement && inputElement.removeEventListener("contextmenu", <EventListener>this.onContextMenu);
            }

            this._onLostFocus = null;
        }

        this._altKey = false;
        this._ctrlKey = false;
        this._metaKey = false;
        this._shiftKey = false;
        this._buttonsPressed = 0;

        if (this.onDoubleTapObservable) {
            this.onDoubleTapObservable.clear();
        }
        if (this.onButtonUpObservable) {
            this.onButtonUpObservable.clear();
        }
        if (this.onButtonDownObservable) {
            this.onButtonDownObservable.clear();
        }
        if (this.onTouchObservable) {
            this.onTouchObservable.clear();
        }
        if (this.onMultiTouchObservable) {
            this.onMultiTouchObservable.clear();
        }

        this._allEvents.clear();
        this._eventsButtonDown.clear();
        this._eventsButtonUp.clear();
        this._eventsDoubleTap.clear();
        this._eventsTouch.clear();
        this._eventsMultiTouch.clear();
    }

    /**
     * Called for each rendered frame.
     * This is in the render path so work done here should have been simplified
     * as much as practical. Ie: Do as much in this._pointerInput(...) as
     * possible.
     */
    public checkInputs(): void {
        // A previous iteration of this code called the event handlers from
        // within `this._pointerInput()`.
        // Now we call them from here we face the challenge of maintaining the
        // order of the events across event types.
        // Eg: A user clicking the mouse twice needs to cause
        // onButtonDown(...), onButtonUp(...), onButtonDown(...), onButtonUp(...)
        // to be called in that exact order.
        //
        // There is a buffer per-event type.
        // eg: `this._eventsButtonDown` contains all the "mouse-down" events in
        // the last frame.
        //
        // There is also a buffer that contains references to the per-event
        // buffers in the order they were populated.
        // eg: If a mouse button was clicket, `this._allEvents` would contain
        // references to
        // [`this._eventsButtonDown`, `this._eventsButtonUp`].
        //
        // The code below replays the events in the order they were stored.

        if (this._allEvents.length > 0 && DEBUG) {
            this._allEvents.dump();
        }
        while (this._allEvents.length > 0) {
            // Get per-event buffer that was populated earliest.
            const eventBuffer = this._allEvents.pop();
            console.assert(eventBuffer !== undefined, "Invalid event.");
            if (eventBuffer === undefined) {
                continue;
            }
            if (DEBUG) {
                eventBuffer.label = "stale";
            }

            // Get specific event that was populated earliest from the per-event
            // buffer.
            const event = eventBuffer.buffer.pop();
            console.assert(event !== undefined, "Invalid event.");
            if (event === undefined) {
                continue;
            }
            if (eventBuffer.buffer === this._eventsButtonDown) {
                const typedEvent = <ICameraInputButtonDownEvent>event;
                this.onButtonDown(typedEvent.event);
                this.onButtonDownObservable.notifyObservers(typedEvent);
            } else if (eventBuffer.buffer === this._eventsButtonUp) {
                const typedEvent = <ICameraInputButtonUpEvent>event;
                this.onButtonUp(typedEvent.event);
                this.onButtonUpObservable.notifyObservers(typedEvent);
            } else if (eventBuffer.buffer === this._eventsDoubleTap) {
                const typedEvent = <ICameraInputDoubleTapEvent>event;
                this.onDoubleTap(typedEvent.type);
                this.onDoubleTapObservable.notifyObservers(typedEvent);
            } else if (eventBuffer.buffer === this._eventsTouch) {
                const typedEvent = <ICameraInputTouchEvent>event;
                this.onTouch(
                    typedEvent.point,
                    typedEvent.offsetX,
                    typedEvent.offsetY);
                this.onTouchObservable.notifyObservers(typedEvent);
            } else if (eventBuffer.buffer === this._eventsMultiTouch) {
                const typedEvent = <ICameraInputMultiTouchEvent>event;

                this.onMultiTouch(
                    typedEvent.pointA,
                    typedEvent.pointB,
                    typedEvent.previousPinchSquaredDistance,
                    typedEvent.pinchSquaredDistance,
                    typedEvent.previousMultiTouchPanPosition,
                    typedEvent.multiTouchPanPosition);

                this._previousPinchSquaredDistance =
                    typedEvent.pinchSquaredDistance;
                this._previousMultiTouchPanPosition =
                    typedEvent.multiTouchPanPosition;

                this.onMultiTouchObservable.notifyObservers(typedEvent);
            }
        }
    }

    /**
    * Observable for when a button up event occurs.
    */
    public onButtonUpObservable = new Observable<ICameraInputButtonUpEvent>();

    /**
    * Observable for when a button down event occurs.
    */
    public onButtonDownObservable = new Observable<ICameraInputButtonDownEvent>();

    /**
    * Observable for when a double tap event occurs.
    */
    public onDoubleTapObservable = new Observable<ICameraInputDoubleTapEvent>();

    /**
     * Observable for pointer drag event.
     */
    public onTouchObservable = new Observable<ICameraInputTouchEvent>();

    /**
     * Observable for multi touch event.
     */
    public onMultiTouchObservable = new Observable<ICameraInputMultiTouchEvent>();

    /**
     * Gets the class name of the current input.
     * @returns the class name
     */
    public getClassName(): string {
        return "BaseCameraPointersInput";
    }

    /**
     * Get the friendly name associated with the input class.
     * @returns the input friendly name
     */
    public getSimpleName(): string {
        return "pointers";
    }

    /**
     * Called on pointer POINTERDOUBLETAP event.
     * Override this method to provide functionality on POINTERDOUBLETAP event.
     */
    protected onDoubleTap(type: string) {
    }

    /**
     * Called on pointer POINTERMOVE event if only a single touch is active.
     * Override this method to provide functionality.
     */
    protected onTouch(point: Nullable<PointerTouch>,
                      offsetX: number,
                      offsetY: number): void {
    }

    /**
     * Called on pointer POINTERMOVE event if multiple touches are active.
     * Override this method to provide functionality.
     */
    protected onMultiTouch(pointA: Nullable<PointerTouch>,
                           pointB: Nullable<PointerTouch>,
                           previousPinchSquaredDistance: number,
                           pinchSquaredDistance: number,
                           previousMultiTouchPanPosition: Nullable<PointerTouch>,
                           multiTouchPanPosition: Nullable<PointerTouch>): void {
    }

    /**
     * Called each time a new POINTERDOWN event occurs. Ie, for each button
     * press.
     * Override this method to provide functionality.
     */
    protected onButtonDown(evt: PointerEvent): void {
    }

    /**
     * Called each time a new POINTERUP event occurs. Ie, for each button
     * release.
     * Override this method to provide functionality.
     */
    protected onButtonUp(evt: PointerEvent): void {
    }

    /**
     * Called when window becomes inactive.
     * Override this method to provide functionality.
     */
    protected onLostFocus(): void {
    }

    /**
     * Called on JS contextmenu event.
     * Override this method to provide functionality.
     */
    protected onContextMenu(evt: PointerEvent): void {
        evt.preventDefault();
    }

    private _addEventsButtonDown(event: PointerEvent): void {
        if (! this._defferCallback) {
            this.onButtonDown(event);
            return;
        }

        // Push event to _eventsButtonDown queue.
        this._eventsButtonDown.push();
        this._eventsButtonDown.pushed.event = event;

        // Push _eventsButtonDown queue to _allEvents queue so we know what
        // order to unwrap individual queues in.
        this._allEvents.push();
        this._allEvents.pushed.buffer = this._eventsButtonDown;
        if (DEBUG) {
            this._allEvents.pushed.label = this._eventsButtonDown.label;
        }
    }

    private _addEventsButtonUp(event: PointerEvent): void {
        if (! this._defferCallback) {
            this.onButtonUp(event);
            return;
        }

        // Push event to _eventsButtonUp queue.
        this._eventsButtonUp.push();
        this._eventsButtonUp.pushed.event = event;

        // Push _eventsButtonUp queue to _allEvents queue so we know what
        // order to unwrap individual queues in.
        this._allEvents.push();
        this._allEvents.pushed.buffer = this._eventsButtonUp;
        if (DEBUG) {
            this._allEvents.pushed.label = this._eventsButtonUp.label;
        }
    }

    private _addEventsDoubleTap(eventType: string): void {
        if (! this._defferCallback) {
            this.onDoubleTap(eventType);
            return;
        }

        // Push event to _eventsDoubleTap queue.
        this._eventsDoubleTap.push();
        this._eventsDoubleTap.pushed.type = eventType;

        // Push _eventsDoubleTap queue to _allEvents queue so we know what
        // order to unwrap individual queues in.
        this._allEvents.push();
        this._allEvents.pushed.buffer = this._eventsDoubleTap;
        if (DEBUG) {
            this._allEvents.pushed.label = this._eventsDoubleTap.label;
        }
    }

    private _addEventsTouch(
        point: Nullable<PointerTouch>, offsetX: number, offsetY: number): void {
            if (! this._defferCallback) {
                this.onTouch(point, offsetX, offsetY);
                return;
            }

            if (COALESCE &&
                    this._allEvents.length > 0 &&
                    this._allEvents.pushed.buffer === this._eventsTouch) {
                // Same event type as last frame;
                // Update the last pushed event in the buffer.
                this._eventsTouch.pushed.point = point;
                this._eventsTouch.pushed.offsetX += offsetX;
                this._eventsTouch.pushed.offsetY += offsetY;
                return;
            }

            // Push event to _eventsTouch queue.
            this._eventsTouch.push();

            // Update the new (recycled actually) event in the buffer.
            this._eventsTouch.pushed.point = point;
            this._eventsTouch.pushed.offsetX = offsetX;
            this._eventsTouch.pushed.offsetY = offsetY;

            // Push _eventsTouch queue to _allEvents queue so we know what
            // order to unwrap individual queues in.
            this._allEvents.push();
            this._allEvents.pushed.buffer = this._eventsTouch;
            if (DEBUG) {
                this._allEvents.pushed.label = this._eventsTouch.label;
            }
    }

    private _addEventsMultiTouch(
        pointA: Nullable<PointerTouch>,
        pointB: Nullable<PointerTouch>,
        previousPinchSquaredDistance: number,
        pinchSquaredDistance: number,
        previousMultiTouchPanPosition: Nullable<PointerTouch>,
        multiTouchPanPosition: Nullable<PointerTouch>): void {
            if (! this._defferCallback) {
                this.onMultiTouch(pointA,
                                  pointB,
                                  previousPinchSquaredDistance,
                                  pinchSquaredDistance,
                                  previousMultiTouchPanPosition,
                                  multiTouchPanPosition);
                return;
            }

            if (COALESCE &&
                    this._allEvents.length > 0 &&
                    this._allEvents.pushed.buffer === this._eventsMultiTouch) {
                // Same event type as last frame;
                // Update the last pushed event in the buffer.
                this._eventsMultiTouch.pushed.pointA = pointA;
                this._eventsMultiTouch.pushed.pointB = pointB;
                this._eventsMultiTouch.pushed.pinchSquaredDistance +=
                    pinchSquaredDistance;
                this._eventsMultiTouch.pushed.multiTouchPanPosition =
                    multiTouchPanPosition;

                return;
            }
            // Push event to _eventsMultiTouch queue.
            this._eventsMultiTouch.push();

            // Update the new (recycled actually) event in the buffer.
            this._eventsMultiTouch.pushed.pointA = pointA;
            this._eventsMultiTouch.pushed.pointB = pointB;
            this._eventsMultiTouch.pushed.previousPinchSquaredDistance =
                this._previousPinchSquaredDistance;
            this._eventsMultiTouch.pushed.pinchSquaredDistance =
                pinchSquaredDistance;
            this._eventsMultiTouch.pushed.previousMultiTouchPanPosition =
                this._previousMultiTouchPanPosition;
            this._eventsMultiTouch.pushed.multiTouchPanPosition =
                multiTouchPanPosition;

            // Push _eventsMultiTouch queue to _allEvents queue so we know what
            // order to unwrap individual queues in.
            this._allEvents.push();
            this._allEvents.pushed.buffer = this._eventsMultiTouch;
            if (DEBUG) {
                this._allEvents.pushed.label = this._eventsMultiTouch.label;
            }
        }

    private _allEvents =
        new _EventRingBuffer<IEvent>("_allEvents");
    private _eventsButtonDown =
        new _EventRingBuffer<ICameraInputButtonDownEvent>("ButtonDown");
    private _eventsButtonUp =
        new _EventRingBuffer<ICameraInputButtonUpEvent>("ButtonUp");
    private _eventsDoubleTap =
        new _EventRingBuffer<ICameraInputDoubleTapEvent>("DoubleTap");
    private _eventsTouch =
        new _EventRingBuffer<ICameraInputTouchEvent>("Touch");
    private _eventsMultiTouch =
        new _EventRingBuffer<ICameraInputMultiTouchEvent>("MultiTouch");

    private _defferCallback: boolean = DEFFER_CALLBACK;
    private _pointerInput: (p: PointerInfo, s: EventState) => void;
    private _observer: Nullable<Observer<PointerInfo>>;
    private _onLostFocus: Nullable<(e: FocusEvent) => any>;
    private _pointA: Nullable<PointerTouch>;
    private _pointB: Nullable<PointerTouch>;
    private _previousPinchSquaredDistance: number = 0;
    private _previousMultiTouchPanPosition: Nullable<PointerTouch> = null;
}

/**
 * A garbage collector friendly ring buffer to store incoming events in.
 * This buffer will grow in size to a maximum length defined by _maxSize but
 * never shrink; When elements are popped, the allocated memory is retained for
 * reuse later.
 */
class _EventRingBuffer<T> {
    private readonly _maxSize = 50;
    private _head: number = 0;
    private _tail: number = 0;
    private _length: number = 0;
    private _container: T[] = [];
    public pushed: T;

    // Not strictly necessary but greatly aids debugging.
    public label: string = "";

    constructor(label: string) {
        this.label = label;
    }

    /**
     * Instead of pushing an actual element, the pointers are advanced to the
     * next free slot and `this.pushed` references that slot.
     * To push an element, call `this.push()` then modify `this.pushed` to
     * reflect the data to be stored.
     * This convoluted approach is intended to avoid creating transient objects
     * that would need garbage collected later.
     *
     * TODO: Check with reviewer that i'm not missing a more obvious way to
     * avoid GC here; It would be nicer to pass in a data object as a parameter.
     */
    public push(): void {
        if (this._length >= this._maxSize) {
            // Max size exceeded. Start dropping oldest data.
            this.pop();
        }
        this._wrapPointers();
        if (this._head === this._tail) {
            if (this._length > 0 || this._container.length === 0) {
                // Buffer currently full.
                // Increase buffer size.
                this.pushed = <T>{};
                this._container.splice(this._head, 0, this.pushed);
                this._length++;
                this._head++;
                this._tail++;
                return;
            }
        }
        this.pushed = this._container[this._head];
        this._head++;
        this._length++;
    }

    /**
     * Returns a reference to the oldest valid data in the buffer,
     */
    public pop(): (T | undefined) {
        if (this._length <= 0) {
            return undefined;
        }
        this._wrapPointers();

        const retVal = this._container[this._tail];

        this._tail++;
        this._length--;
        return retVal;
    }

    public clear(): void {
        this._head = 0;
        this._tail = 0;
        this._length = 0;
        this._container = [];
        this.pushed = <T>{};
    }

    get length(): number {
        return this._length;
    }

    /**
     * Display current buffer content to console. Used in debugging.
     */
    public dump(): void {
        console.table(this._container);
        console.log(
            `tail: ${this._tail} ` +
            `head: ${this._head} ` +
            `length: ${this._length} ` +
            `container.length: ${this._container.length}`);
    }

    /**
     * Wrap pointers back to start of internal buffer on overflow.
     */
    private _wrapPointers(): void {
        if (this._head >= this._container.length) {
            this._head = 0;
        }
        if (this._tail >= this._container.length) {
            this._tail = 0;
        }
    }
}

/**
 * A reference to one of the ring buffers containing a particular event type.
 */
interface IEvent {
    /**
     * The ring buffer.
     */
    buffer: (
        _EventRingBuffer<ICameraInputButtonDownEvent> |
        _EventRingBuffer<ICameraInputButtonUpEvent> |
        _EventRingBuffer<ICameraInputDoubleTapEvent> |
        _EventRingBuffer<ICameraInputTouchEvent> |
        _EventRingBuffer<ICameraInputMultiTouchEvent>);
    /**
     * A label for debug purposes.
     */
    label: string;
}

/**
 * Event triggered when pointer button depressed.
 */
interface ICameraInputButtonDownEvent {
    /**
     * The DOM pointer event.
     */
    event: PointerEvent;
}

/**
 * Event triggered when pointer button released.
 */
interface ICameraInputButtonUpEvent {
    /**
     * The DOM pointer event.
     */
    event: PointerEvent;
}

/**
 * Event triggered when 2 pointer buttons tapped.
 */
interface ICameraInputDoubleTapEvent {
    /**
     * A string matching the PointerEvent.pointerType.
     */
    type: string;
}

/**
 * Event triggered when pointer dragged.
 */
interface ICameraInputTouchEvent {
    /**
     * The DOM pointer event.
     */
    point: Nullable<PointerTouch>;
    /**
     * Distance moved in X axis.
     */
    offsetX: number;
    /**
     * Distance moved in Y axis.
     */
    offsetY: number;
}

/**
 * Event triggered when pointer dragged with 2 buttons.
 */
interface ICameraInputMultiTouchEvent {
    /**
     * The DOM pointer event of first button press.
     */
    pointA: Nullable<PointerTouch>;
    /**
     * The DOM pointer event of second button press.
     */
    pointB: Nullable<PointerTouch>;
    /**
     * Pinch distance (squared) last time this event was called.
     * Will be 0 if this is the first in a drag sequence.
     */
    previousPinchSquaredDistance: number;
    /**
     * Pinch distance (squared) since last time this event was called.
     * Will be 0 if this is the last in a drag sequence.
     */
    pinchSquaredDistance: number;
    /**
     * Average position of button presses last time this event was called.
     * Will be 0 if this is the first in a drag sequence.
     */
    previousMultiTouchPanPosition: Nullable<PointerTouch>;
    /**
     * Average position of button presses this frame.
     * Will be 0 if this is the last in a drag sequence.
     */
    multiTouchPanPosition: Nullable<PointerTouch>;
}
