import { Nullable } from "../../types";
import { serialize } from "../../Misc/decorators";
import { EventState, Observable, Observer } from "../../Misc/observable";
import { Tools } from "../../Misc/tools";
import { Camera } from "../../Cameras/camera";
import { ICameraInput } from "../../Cameras/cameraInputsManager";
import { PointerInfo, PointerEventTypes, PointerTouch } from "../../Events/pointerEvents";

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
    public attachControl(element: HTMLElement, noPreventDefault?: boolean): void {
        var engine = this.camera.getEngine();
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
                this._addEventsTouch({
                    point: null,
                    offsetX,
                    offsetY
                });

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

                this._addEventsButtonDown({event: evt});

                if (!noPreventDefault) {
                    evt.preventDefault();
                    element.focus();
                }
            } else if (p.type === PointerEventTypes.POINTERDOUBLETAP) {
                this._addEventsDoubleTap({type: evt.pointerType});
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
                    this._addEventsMultiTouch({
                        pointA: this._pointA,
                        pointB: this._pointB,
                        previousPinchSquaredDistance: previousPinchSquaredDistance,
                        pinchSquaredDistance: 0,
                        previousMultiTouchPanPosition,
                        multiTouchPanPosition: null
                    });

                    previousPinchSquaredDistance = 0;
                    previousMultiTouchPanPosition = null;
                }

                this._addEventsButtonUp({event: evt});

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
                    this._addEventsTouch({
                        point: this._pointA,
                        offsetX,
                        offsetY
                    });

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
                    var multiTouchPanPosition = {x: (this._pointA.x + this._pointB.x) / 2,
                                                 y: (this._pointA.y + this._pointB.y) / 2,
                                                 pointerId: evt.pointerId,
                                                 type: p.type};
                    this._addEventsMultiTouch({
                        pointA: this._pointA,
                        pointB: this._pointB,
                        previousPinchSquaredDistance,
                        pinchSquaredDistance,
                        previousMultiTouchPanPosition,
                        multiTouchPanPosition
                    });

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

        element.addEventListener("contextmenu",
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
     * @param element Defines the element to stop listening the inputs from
     */
    public detachControl(element: Nullable<HTMLElement>): void {
        if (this._onLostFocus) {
            let hostWindow = this.camera.getScene().getEngine().getHostWindow();
            if (hostWindow) {
                Tools.UnregisterTopRootEvents(hostWindow, [
                    { name: "blur", handler: this._onLostFocus }
                ]);
            }
        }

        if (element && this._observer) {
            this.camera.getScene().onPointerObservable.remove(this._observer);
            this._observer = null;

            if (this.onContextMenu) {
                element.removeEventListener("contextmenu", <EventListener>this.onContextMenu);
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
    }

    /**
     * Called for each rendered frame.
     * This is in the render path so work done here should have been simplified
     * as much as practical. Ie: Do as much in this._pointerInput(...) as
     * possible.
     */
    public checkInputs(): void {
        // if(this._allEvents.length > 0) {
        //     this._allEvents.dump();
        // }
        while (this._allEvents.length > 0) {
            // A previous iteration of this code called the event handlers from
            // within `this._pointerInput()`.
            // Now we call them from here we face the challenge of maintaining
            // the order of the events across event types.
            // Eg: A user clicking the mouse twice needs to cause
            // onButtonDown(...), onButtonUp(...), onButtonDown(...), onButtonUp(...)
            // to be called in that exact order.
            //
            // this._allEvents contains indexes into the lists of event types in
            // the order they were triggered.

            const eventBuffer = this._allEvents.pop();
            console.assert(eventBuffer !== undefined, "Invalid event.");
            if(eventBuffer === undefined || eventBuffer === null) {  // TODO: Why both of these?
                break;
            }

            const event = eventBuffer.pop();
            if (event === undefined) {
                continue;
            }
            if (eventBuffer === this._eventsButtonDown) {
                const typedEvent = <ICameraInputButtonDownEvent>event;
                this.onButtonDown(typedEvent.event);
                this.onButtonDownObservable.notifyObservers(typedEvent);
            } else if (eventBuffer === this._eventsButtonUp) {
                const typedEvent = <ICameraInputButtonUpEvent>event;
                this.onButtonUp(typedEvent.event);
                this.onButtonUpObservable.notifyObservers(typedEvent);
            } else if (eventBuffer === this._eventsDoubleTap) {
                const typedEvent = <ICameraInputDoubleTapEvent>event;
                this.onDoubleTap(typedEvent.type);
                this.onDoubleTapObservable.notifyObservers(typedEvent);
            } else if (eventBuffer === this._eventsTouch) {
                const typedEvent = <ICameraInputTouchEvent>event;
                this.onTouch(
                    typedEvent.point,
                    typedEvent.offsetX,
                    typedEvent.offsetY);
                this.onTouchObservable.notifyObservers(typedEvent);
            } else if (eventBuffer === this._eventsMultiTouch) {
                const typedEvent = <ICameraInputMultiTouchEvent>event;
                this.onMultiTouch(
                    typedEvent.pointA,
                    typedEvent.pointB,
                    typedEvent.previousPinchSquaredDistance,
                    typedEvent.pinchSquaredDistance,
                    typedEvent.previousMultiTouchPanPosition,
                    typedEvent.multiTouchPanPosition);
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

    private _addEventsButtonDown(event: ICameraInputButtonDownEvent): void {
        // Push event to _eventsButtonDown queue.
        this._eventsButtonDown.push(event);

        // Push _eventsButtonDown queue to _allEvents queue so we know what
        // order to unwrap individual queues in.
        this._allEvents.push(this._eventsButtonDown);
    }

    private _addEventsButtonUp(event: ICameraInputButtonUpEvent): void {
        // Push event to _eventsButtonUp queue.
        this._eventsButtonUp.push(event);

        // Push _eventsButtonUp queue to _allEvents queue so we know what
        // order to unwrap individual queues in.
        this._allEvents.push(this._eventsButtonUp);
    }

    private _addEventsDoubleTap(event: ICameraInputDoubleTapEvent): void {
        // Push event to _eventsDoubleTap queue.
        this._eventsDoubleTap.push(event);

        // Push _eventsDoubleTap queue to _allEvents queue so we know what
        // order to unwrap individual queues in.
        this._allEvents.push(this._eventsDoubleTap);
    }

    private _addEventsTouch(event: ICameraInputTouchEvent): void {
        if(this._allEvents.length > 0 &&
            this._allEvents.lastPushed.label === this._eventsTouch.label) {
            // Same event type as last frame; Merge new with last event.
        } else {
            // Push event to _eventsTouch queue.
            this._eventsTouch.push(event);

            // Push _eventsTouch queue to _allEvents queue so we know what
            // order to unwrap individual queues in.
            this._allEvents.push(this._eventsTouch);
        }
    }

    private _addEventsMultiTouch(event: ICameraInputMultiTouchEvent): void {
        // Push event to _eventsMultiTouch queue.
        this._eventsMultiTouch.push(event);

        // Push _eventsMultiTouch queue to _allEvents queue so we know what
        // order to unwrap individual queues in.
        this._allEvents.push(this._eventsMultiTouch);
    }

    private _allEvents =
        new _EventRingBuffer<_Event>("_allEvents");
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

    private _pointerInput: (p: PointerInfo, s: EventState) => void;
    private _observer: Nullable<Observer<PointerInfo>>;
    private _onLostFocus: Nullable<(e: FocusEvent) => any>;
    private _pointA: Nullable<PointerTouch>;
    private _pointB: Nullable<PointerTouch>;
}

class _EventRingBuffer<T> {
    private _head: number = 0;
    private _tail: number = 0;
    private _length: number = 0;
    private _container: (T | undefined)[] = [];
    public label: string = "";
    public lastPushed: T;


    constructor(label: string) {
        this.label = label;
    }

    public push(event: T): void {
        this.lastPushed = event;
        this._wrapPointers();
        if (this._head === this._tail) {
            if (this._length > 0 || this._container.length === 0) {
                // Buffer currently full.
                this._container.splice(this._head, 0, event);
                this._length++;
                this._head++;
                this._tail++;
                return;
            }
        }
        this._container[this._head] = event;
        this._head++;
        this._length++;
    }

    public pop(): (T | undefined) {
        if (this._length <= 0) {
            return undefined;
        }
        this._wrapPointers();

        const retVal = this._container[this._tail];
        this._container[this._tail] = undefined;

        this._tail++;
        this._length--;
        return retVal;
    }

    get length(): number {
        return this._length;
    }

    public dump(): void {
        console.table(this._container);
        console.log(this._tail, this._head, this._length, this._container.length);
    }

    private _wrapPointers(): void {
        if (this._head >= this._container.length) {
            this._head = 0;
        }
        if (this._tail >= this._container.length) {
            this._tail = 0;
        }
    }
}

// TODO Remove me and write unit tests for this.
// Pat particular attention to the rollover between end of array and start.
/*function testRingBuffer() {
    const rb = new _EventRingBuffer<number>("test");
    rb.dump();
    console.assert(rb.length === 0);

    rb.push(0);
    rb.dump();
    console.assert(rb.length === 1);
    console.log(rb.pop());
    rb.dump();
    console.assert(rb.length === 0);

    rb.push(1);
    rb.dump();

    rb.push(2);
    rb.dump();

    rb.push(3);
    rb.dump();

    rb.push(4);
    rb.dump();

    console.assert(rb.length === 4);
    console.log(rb.pop(), rb.pop());
    console.assert(rb.length === 2);
    rb.dump();

    rb.push(5);
    rb.dump();

    rb.push(6);
    rb.dump();

    rb.push(7);
    rb.dump();

    rb.push(8);
    rb.dump();
    console.assert(rb.length === 6);

    let a = undefined;
    do {
        a = rb.pop();
        console.log(a);
    } while (a !== undefined);
    rb.dump();

    rb.push(1);
    rb.dump();

    rb.push(2);
    rb.dump();

    rb.push(3);
    rb.dump();

    rb.push(4);
    rb.dump();

    rb.push(5);
    rb.dump();

    rb.push(6);
    rb.dump();

    rb.push(7);
    rb.dump();

    rb.push(8);
    rb.dump();
}
testRingBuffer();*/

type _Event = (
    _EventRingBuffer<ICameraInputButtonDownEvent> |
    _EventRingBuffer<ICameraInputButtonUpEvent> |
    _EventRingBuffer<ICameraInputDoubleTapEvent> |
    _EventRingBuffer<ICameraInputTouchEvent> |
    _EventRingBuffer<ICameraInputMultiTouchEvent>
);

interface ICameraInputButtonDownEvent {
    event: PointerEvent;
}

interface ICameraInputButtonUpEvent {
    event: PointerEvent;
}

interface ICameraInputDoubleTapEvent {
    type: string;
}

interface ICameraInputTouchEvent {
    point: Nullable<PointerTouch>;
    offsetX: number;
    offsetY: number;
}

interface ICameraInputMultiTouchEvent {
    pointA: Nullable<PointerTouch>;
    pointB: Nullable<PointerTouch>;
    previousPinchSquaredDistance: number;
    pinchSquaredDistance: number;
    previousMultiTouchPanPosition: Nullable<PointerTouch>;
    multiTouchPanPosition: Nullable<PointerTouch>;
}
