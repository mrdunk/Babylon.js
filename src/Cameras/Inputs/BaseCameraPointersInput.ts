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
                this._pushEventTouch({
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

                this._pushEventButtonDown({event: evt});

                if (!noPreventDefault) {
                    evt.preventDefault();
                    element.focus();
                }
            } else if (p.type === PointerEventTypes.POINTERDOUBLETAP) {
                this._pushEventDoubleTap({type: evt.pointerType});
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
                    this._pushEventMultiTouch({
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

                this._pushEventButtonUp({event: evt});

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
                    this._pushEventTouch({
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

                    this._pushEventMultiTouch({
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
        if(this._allEvents.length > 0) {
            this._allEvents.dump();
        }
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

            const event = this._allEvents.pop();
            console.assert(event !== undefined, "Invalid event.");
            if(event === undefined || event === null) {  // TODO: Why both of these?
                break;
            }

            if (event.eventCollection === this._eventsButtonDown) {
                const exactEvent = this._eventsButtonDown[event.index];
                this.onButtonDown(exactEvent.event);
                this.onButtonDownObservable.notifyObservers(exactEvent);
            } else if (event.eventCollection === this._eventsButtonUp) {
                const exactEvent = this._eventsButtonUp[event.index];
                this.onButtonUp(exactEvent.event);
                this.onButtonUpObservable.notifyObservers(exactEvent);
            } else if (event.eventCollection === this._eventsDoubleTap) {
                const exactEvent = this._eventsDoubleTap[event.index];
                this.onDoubleTap(exactEvent.type);
                this.onDoubleTapObservable.notifyObservers(exactEvent);
            } else if (event.eventCollection === this._eventsTouch) {
                const exactEvent = this._eventsTouch[event.index];
                this.onTouch(
                    exactEvent.point,
                    exactEvent.offsetX,
                    exactEvent.offsetY);
                this.onTouchObservable.notifyObservers(exactEvent);
            } else if (event.eventCollection === this._eventsMultiTouch) {
                const exactEvent = this._eventsMultiTouch[event.index];
                this.onMultiTouch(
                    exactEvent.pointA,
                    exactEvent.pointB,
                    exactEvent.previousPinchSquaredDistance,
                    exactEvent.pinchSquaredDistance,
                    exactEvent.previousMultiTouchPanPosition,
                    exactEvent.multiTouchPanPosition);
                this.onMultiTouchObservable.notifyObservers(exactEvent);
            }
        }
        this._eventsButtonDownCount = 0;
        this._eventsButtonUpCount = 0;
        this._eventsDoubleTapCount = 0;
        this._eventsTouchCount = 0;
        this._eventsMultiTouchCount = 0;
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
    //private _onDoubleTapEvents: string[] = [];
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

    /**
     * Queue events for later processing by checkInputs().
     * See the comment in that function for a description.
     */
    private _pushEvent(event: _Event): void {
        this._allEvents.push(event);
    }
    private _allEvents = new _EventRingBuffer<_Event>();

    /**
     * Queue a button down event for later processing.
     */
    private _pushEventButtonDown(event: ICameraInputButtonDownEvent): void {
        if (this._eventsButtonDownCount >= this._eventsButtonDown.length) {
            this._eventsButtonDown.push(event);
        } else {
            this._eventsButtonDown[this._eventsButtonDownCount] = event;
        }

        this._pushEvent({
            index: this._eventsButtonDownCount,
            eventCollection: this._eventsButtonDown,
            debug: "ButtonDown"
        });

        this._eventsButtonDownCount++;
    }
    private _eventsButtonDownCount: number = 0;
    private _eventsButtonDown: ICameraInputButtonDownEvent[] = [];

    /**
     * Queue a button up event for later processing.
     */
    private _pushEventButtonUp(event: ICameraInputButtonUpEvent): void {
        if (this._eventsButtonUpCount >= this._eventsButtonUp.length) {
            this._eventsButtonUp.push(event);
        } else {
            this._eventsButtonUp[this._eventsButtonUpCount] = event;
        }

        this._pushEvent({
            index: this._eventsButtonUpCount,
            eventCollection: this._eventsButtonUp,
            debug: "ButtonUp"
        });

        this._eventsButtonUpCount++;
    }
    private _eventsButtonUpCount: number = 0;
    private _eventsButtonUp: ICameraInputButtonUpEvent[] = [];

    /**
     * Queue a double tap event for later processing.
     */
    private _pushEventDoubleTap(event: ICameraInputDoubleTapEvent): void {
        if (this._eventsDoubleTapCount >= this._eventsDoubleTap.length) {
            this._eventsDoubleTap.push(event);
            this._eventsDoubleTapCount++;
        } else {
            this._eventsDoubleTap[this._eventsDoubleTapCount] = event;
        }

        this._pushEvent({
            index: this._eventsDoubleTapCount,
            eventCollection: this._eventsDoubleTap,
            debug: "DoubleTap"
        });

        this._eventsDoubleTapCount++;
    }
    private _eventsDoubleTapCount: number = 0;
    private _eventsDoubleTap: ICameraInputDoubleTapEvent[] = [];

    /**
     * Queue a touch event for later processing.
     * TODO: Coalesce these events.
     */
    private _pushEventTouch(event: ICameraInputTouchEvent): void {
        if (this._eventsTouchCount >= this._eventsTouch.length) {
            this._eventsTouch.push(event);
        } else {
            this._eventsTouch[this._eventsTouchCount] = event;
        }

        this._pushEvent({
            index: this._eventsTouchCount,
            eventCollection: this._eventsTouch,
            debug: "Touch"
        });

        this._eventsTouchCount++;
    }
    private _eventsTouchCount: number = 0;
    private _eventsTouch: ICameraInputTouchEvent[] = [];

    /**
     * Queue a multi touch event for later processing.
     * TODO: Coalesce these events.
     */
    private _pushEventMultiTouch(event: ICameraInputMultiTouchEvent): void {
        if (this._eventsMultiTouchCount >= this._eventsMultiTouch.length) {
            this._eventsMultiTouch.push(event);
        } else {
            this._eventsMultiTouch[this._eventsMultiTouchCount] = event;
        }

        this._pushEvent({
            index: this._eventsMultiTouchCount,
            eventCollection: this._eventsMultiTouch,
            debug: "MultiTouch"
        });

        this._eventsMultiTouchCount++;
    }
    private _eventsMultiTouchCount: number = 0;
    private _eventsMultiTouch: ICameraInputMultiTouchEvent[] = [];

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
    private _container: Nullable<T>[] = [];

    public push(event: T): void {
        if (this._head >= this._container.length) {
            this._head = 0;            
        }
        if (this._tail >= this._container.length) {
            this._tail = 0;            
        }
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

    public pop(): (Nullable<T> | undefined) {
        if (this._length <= 0) {
            return undefined;
        }

        const tail = this._tail;
        this._tail++;
        if (this._tail >= this._container.length) {
            this._tail = 0;
        }
        this._length--;
        const retVal = this._container[tail];
        this._container[tail] = null;
        return retVal;
    }

    get length(): number {
        return this._length;
    }

    public dump(): void {
        console.table(this._container);
        console.log(this._tail, this._head, this._length, this._container.length);
    }
}

// TODO Remove me and write unit tests for this.
/*
function testRingBuffer() {
    const rb = new _EventRingBuffer<number>();
    rb.dump();

    rb.push(1);
    rb.dump();

    rb.push(2);
    rb.dump();

    rb.push(3);
    rb.dump();

    rb.push(4);
    rb.dump();

    console.log(rb.pop(), rb.pop());
    rb.dump();

    rb.push(5);
    rb.dump();

    rb.push(6);
    rb.dump();

    rb.push(7);
    rb.dump();

    rb.push(8);
    rb.dump();

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
}*/

interface _Event {
    index: number;
    // TODO: Should eventCollection be Nullable?
    // When we leave stale _events in the _allEvents collection for later
    // recycling, do we care if we leave stale events in there?
    // I can't think of a reason why it matters but it smells a little off to me.
    eventCollection: (ICameraInputButtonDownEvent[] |
                      ICameraInputButtonUpEvent[] |
                      ICameraInputDoubleTapEvent[] |
                      ICameraInputTouchEvent[] |
                      ICameraInputMultiTouchEvent[]);
    debug?: string;
}

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
