/**
 * Mock event interface used in place of real events when testing BaseCameraPointersInput
 * and derived classes.
 * Many PointerEvent properties are read-only so using real "new PointerEvent()"
 * is unpractical.
 */
interface MockPointerEvent {
    target?: HTMLElement;
    type?: string;
    button?: number;
    pointerId?: number;
    pointerType?: string;
    clientX?: number;
    clientY?: number;
    movementX?: number;
    movementY?: number;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    buttons?: number[];
    [propName: string]: any;
}

/**
 * Make a mock PointerEvent.
 * Many PointerEvent properties are read-only so using real "new PointerEvent()"
 * is unpractical.
 */
function eventTemplate(target: HTMLElement): MockPointerEvent {
    let returnVal = {
        target,
        button: 0,
        preventDefault: () => {},
    };
    return returnVal;
}

/**
 * Simulate PointerEvent in CameraPointersInput instance.
 */
function simulateEvent(cameraInput: BABYLON.ICameraInput<BABYLON.Camera>, event: MockPointerEvent) {
    let pointerInfo = {};
    switch (event.type) {
        case "pointerdown":
            pointerInfo = { type: BABYLON.PointerEventTypes.POINTERDOWN, event };
            // Cast "camera" to <any> to relax "private" classification.
            (<any>cameraInput)._pointerInput(pointerInfo, undefined);
            break;
        case "pointerup":
            pointerInfo = { type: BABYLON.PointerEventTypes.POINTERUP, event };
            // Cast "camera" to <any> to relax "private" classification.
            (<any>cameraInput)._pointerInput(pointerInfo, undefined);
            break;
        case "pointermove":
            pointerInfo = { type: BABYLON.PointerEventTypes.POINTERMOVE, event };
            // Cast "camera" to <any> to relax "private" classification.
            (<any>cameraInput)._pointerInput(pointerInfo, undefined);
            break;
        case "blur":
            // Cast "camera" to <any> to relax "private" classification.
            (<any>cameraInput)._onLostFocus();
            break;
        case "POINTERDOUBLETAP":
            // Not a real DOM event. Just a shortcut to trigger
            // PointerEventTypes.POINTERMOVE on the Input class.
            pointerInfo = { type: BABYLON.PointerEventTypes.POINTERDOUBLETAP, event };
            // Cast "camera" to <any> to relax "private" classification.
            (<any>cameraInput)._pointerInput(pointerInfo, undefined);
            break;
        default:
            console.error("Invalid pointer event: " + event.type);
    }
}

/**
 * Simulate the screen render.
 */
function simulateRender(cameraInput: BABYLON.ICameraInput<BABYLON.Camera>) {
  cameraInput.checkInputs();
}

/**
 * Override the methods of an existing camera to create a stub for testing
 * BaseCameraPointersInput.
 * @returns An instance of ArcRotateCameraPointersInput with the interesting
 *   methods stubbed out.
 */
function StubCameraInput() {
    // Force our CameraPointersInput instance to type "any" so we can access
    // protected methods from within this function.
    let cameraInput: any = <any>new BABYLON.ArcRotateCameraPointersInput();

    /**
     * Reset all counters.
     */
    cameraInput.reset = (): void => {
        cameraInput.countOnDoubleTap = 0;
        cameraInput.countOnTouch = 0;
        cameraInput.countOnMultiTouch = 0;
        cameraInput.countOnContextMenu = 0;
        cameraInput.countOnButtonDown = 0;
        cameraInput.countOnButtonUp = 0;
        cameraInput.countOnLostFocus = 0;

        cameraInput.lastOnDoubleTap = undefined;
        cameraInput.lastOnTouch = undefined;
        cameraInput.lastOnMultiTouch = undefined;
        cameraInput.lastOnContextMenu = undefined;
        cameraInput.pointersDown = [];

        cameraInput._buttonsPressed = 0;
        cameraInput._pointA = null;
        cameraInput._pointB = null;
        cameraInput._previousPinchSquaredDistance = 0;
        cameraInput._previousMultiTouchPanPosition = null;
        cameraInput._allEvents.clear();
        cameraInput._eventsButtonDown.clear();
        cameraInput._eventsButtonUp.clear();
        cameraInput._eventsDoubleTap.clear();
        cameraInput._eventsTouch.clear();
        cameraInput._eventsMultiTouch.clear();
    };

    cameraInput.reset();

    /**
     * Stub out all methods we want to test as part of the BaseCameraPointersInput testing.
     * These stubs keep track of how many times they were called and
     */
    cameraInput.onTouch = (point: BABYLON.Nullable<BABYLON.PointerTouch>, offsetX: number, offsetY: number) => {
        cameraInput.countOnTouch++;
        cameraInput.lastOnTouch = {point, offsetX, offsetY};
    };

    cameraInput.onDoubleTap = (type: string) => {
        cameraInput.countOnDoubleTap++;
        cameraInput.lastOnDoubleTap = type;
    };

    cameraInput.onMultiTouch = (
        pointA: BABYLON.Nullable<BABYLON.PointerTouch>,
        pointB: BABYLON.Nullable<BABYLON.PointerTouch>,
        previousPinchSquaredDistance: number,
        pinchSquaredDistance: number,
        previousMultiTouchPanPosition: BABYLON.Nullable<BABYLON.PointerTouch>,
        multiTouchPanPosition: BABYLON.Nullable<BABYLON.PointerTouch>
    ) => {
        cameraInput.countOnMultiTouch++;
        cameraInput.lastOnMultiTouch = {
            pointA,
            pointB,
            previousPinchSquaredDistance,
            pinchSquaredDistance,
            previousMultiTouchPanPosition,
            multiTouchPanPosition,
        };
    };

    cameraInput.onButtonDown = (evt: PointerEvent) => {
        cameraInput.countOnButtonDown++;

        // BaseCameraPointersInput.ts tracks a maximum of 2 pointers.
        const index = cameraInput.pointersDown.indexOf(evt.pointerId);
        if(index < 0 && cameraInput.pointersDown.length < 2) {
          cameraInput.pointersDown.push(evt.pointerId);
        };
    };

    cameraInput.onButtonUp = (evt: PointerEvent) => {
        cameraInput.countOnButtonUp++;
        const index = cameraInput.pointersDown.indexOf(evt.pointerId);
        if(index >= 0) {
            cameraInput.pointersDown.splice(index, 1);
        } else {
            // BaseCameraPointersInput.ts tracks a maximum of 2 pointers.
            // If an un-tracked one is released, the whole state is reset.
            cameraInput.pointersDown = [];
        }
    };

    cameraInput.onContextMenu = (evt: PointerEvent) => {
        cameraInput.countOnContextMenu++;
        cameraInput.lastOnContextMenu = evt;
    };

    cameraInput.onLostFocus = () => {
        cameraInput.countOnLostFocus++;
    };

    return cameraInput;
}

/**
 * Test the things.
 * The BaseCameraPointersInput class first.
 */
describe("BaseCameraPointersInput", function () {
    /**
     * Sets the timeout of all the tests to 10 seconds.
     */
    this.timeout(10000);

    before(function (done) {
        // runs before all tests in this block
        this.timeout(180000);
        BABYLONDEVTOOLS.Loader.useDist()
            .testMode()
            .load(function () {
                // Force apply promise polyfill for consistent behavior between
                // PhantomJS, IE11, and other browsers.
                BABYLON.PromisePolyfill.Apply(true);
                done();
            });

        this._canvas = document.createElement("canvas");
        this._engine = new BABYLON.NullEngine();
        this._scene = new BABYLON.Scene(this._engine);

        // Set up an instance of a Camera with the ArcRotateCameraPointersInput.
        this.camera = new BABYLON.ArcRotateCamera("StubCamera", 0, 0, 0, new BABYLON.Vector3(0, 0, 0), this._scene);
        this.cameraInput = StubCameraInput();
        this.cameraInput.camera = this.camera;
        this.cameraInput.attachControl();
    });

    beforeEach(function () {
        // runs before each test in this block
        this.cameraInput.reset();
    });

    describe('primatives', function() {
        it('push pop ring buffer', function() {
            expect(this.cameraInput._allEvents.length).to.equal(0);

            this.cameraInput._allEvents.push();
            this.cameraInput._allEvents.pushed.label = "newEntry1";
            expect(this.cameraInput._allEvents.length).to.equal(1);

            let popedEntry1 = this.cameraInput._allEvents.pop();
            expect(this.cameraInput._allEvents.pushed).to.equal(popedEntry1);
            expect(this.cameraInput._allEvents.length).to.equal(0);
        });

        it('multi push pop ring buffer', function() {
            expect(this.cameraInput._allEvents.length).to.equal(0);

            this.cameraInput._allEvents.push();
            this.cameraInput._allEvents.pushed.label = "newEntry1";
            this.cameraInput._allEvents.push();
            this.cameraInput._allEvents.pushed.label = "newEntry2";
            this.cameraInput._allEvents.push();
            this.cameraInput._allEvents.pushed.label = "newEntry3";
            expect(this.cameraInput._allEvents.length).to.equal(3);

            let popedEntry1 = this.cameraInput._allEvents.pop();
            expect(popedEntry1.label).to.equal("newEntry1");
            let popedEntry2 = this.cameraInput._allEvents.pop();
            expect(popedEntry2.label).to.equal("newEntry2");
            let popedEntry3 = this.cameraInput._allEvents.pop();
            expect(popedEntry3.label).to.equal("newEntry3");
            let popedEntry4 = this.cameraInput._allEvents.pop();
            expect(popedEntry4).to.equal(undefined);
            expect(this.cameraInput._allEvents.length).to.equal(0);
        });

        it('recycle entries ring buffer', function() {
            expect(this.cameraInput._allEvents.length).to.equal(0);

            // Force the internal container to have 3 elements.
            this.cameraInput._allEvents.push();
            this.cameraInput._allEvents.push();
            this.cameraInput._allEvents.push();
            expect(this.cameraInput._allEvents.length).to.equal(3);
            // Now empty it out. The internal container remains.
            let popedEntry1 = this.cameraInput._allEvents.pop();
            let popedEntry2 = this.cameraInput._allEvents.pop();
            let popedEntry3 = this.cameraInput._allEvents.pop();
            expect(this.cameraInput._allEvents.length).to.equal(0);

            // Now loop through in a manner that overlaps the ends of the internal
            // container sometimes.
            for(let i = 0; i < 20; i++) {
                this.cameraInput._allEvents.push();
                this.cameraInput._allEvents.pushed.label = "newEntry1";
                this.cameraInput._allEvents.push();
                this.cameraInput._allEvents.pushed.label = "newEntry2";
                expect(this.cameraInput._allEvents.length).to.equal(2);

                let popedEntry1 = this.cameraInput._allEvents.pop();
                expect(popedEntry1.label).to.equal("newEntry1");
                let popedEntry2 = this.cameraInput._allEvents.pop();
                expect(popedEntry2.label).to.equal("newEntry2");
                expect(this.cameraInput._allEvents.length).to.equal(0);

                this.cameraInput._allEvents.push();
                this.cameraInput._allEvents.pushed.label = "newEntry3";
                this.cameraInput._allEvents.push();
                this.cameraInput._allEvents.pushed.label = "newEntry4";
                this.cameraInput._allEvents.push();
                this.cameraInput._allEvents.pushed.label = "newEntry5";
                expect(this.cameraInput._allEvents.length).to.equal(3);

                let popedEntry3 = this.cameraInput._allEvents.pop();
                expect(popedEntry3.label).to.equal("newEntry3");
                let popedEntry4 = this.cameraInput._allEvents.pop();
                expect(popedEntry4.label).to.equal("newEntry4");
                let popedEntry5 = this.cameraInput._allEvents.pop();
                expect(popedEntry5.label).to.equal("newEntry5");
                expect(this.cameraInput._allEvents.length).to.equal(0);
            }
        });

        it('overflow ring buffer', function() {
            let maxSize = this.cameraInput._allEvents._maxSize;
            expect(this.cameraInput._allEvents.length).to.equal(0);

            // Fill the buffer.
            for(let i = 0; i < maxSize; i++) {
                this.cameraInput._allEvents.push();
                this.cameraInput._allEvents.pushed.label = `newEntry_${i}`;
                expect(this.cameraInput._allEvents.length).to.equal(i + 1);
            }

            // Keep going event though we have exceeded the maximum buffer size.
            for(let i = 0; i < maxSize * 2; i++) {
                this.cameraInput._allEvents.push();
                this.cameraInput._allEvents.pushed.label = `overflow_${i}`;
                expect(this.cameraInput._allEvents.length).to.equal(maxSize);
            }

            // The data in the buffer is the newer set; Oldest data has been
            // overwritten.
            for(let i = maxSize; i < maxSize * 2; i++) {
                let entry = this.cameraInput._allEvents.pop();
                expect(entry.label).to.equal(`overflow_${i}`);
            }

            // Completely empty now.
            expect(this.cameraInput._allEvents.length).to.equal(0);
            let entry = this.cameraInput._allEvents.pop();
            expect(entry).to.equal(undefined);
        });
    });

    describe('queued event manager', function() {
        it('queues events until a checkInputs() call', function() {
            // Only do this test if this.cameraInput._defferCallback === true.
            if (this.cameraInput._defferCallback) {
                var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

                // Button down.
                event.type = "pointerdown";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                // Start moving.
                event.type = "pointermove";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                // Another button down.
                event.type = "pointerdown";
                event.button = 1;
                simulateEvent(this.cameraInput, event);

                // Button up.
                event.type = "pointerup";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                // No render call so no callbacks have been called.
                expect(this.cameraInput.countOnTouch).to.equal(0);
                expect(this.cameraInput.countOnMultiTouch).to.equal(0);
                expect(this.cameraInput.countOnButtonDown).to.equal(0);
                expect(this.cameraInput.countOnButtonUp).to.equal(0);

                // Call checkInputs().
                simulateRender(this.cameraInput);
                // Now callbacks have been called.
                expect(this.cameraInput.countOnTouch).to.equal(1);
                expect(this.cameraInput.countOnMultiTouch).to.equal(0);
                expect(this.cameraInput.countOnButtonDown).to.equal(2);
                expect(this.cameraInput.countOnButtonUp).to.equal(1);
            }
        });

        it('queues and coalesces events until a checkInputs() call', function() {
            // Only do this test if this.cameraInput._defferCallback === true.
            if (this.cameraInput._defferCallback) {
                var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

                // Button down.
                event.type = "pointerdown";
                event.button = 0;
                event.pointerId = 1;
                event.pointerType = "touch";
                simulateEvent(this.cameraInput, event);

                // First Touch event
                event.type = "pointermove";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                event.type = "pointermove";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                event.type = "pointermove";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                // Another button down.
                event.type = "pointerdown";
                event.button = 1;
                event.pointerId = 2;
                event.pointerType = "touch";
                simulateEvent(this.cameraInput, event);

                // MultiTouch event.
                event.type = "pointermove";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                event.type = "pointermove";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                event.type = "pointermove";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                // Button up.
                event.type = "pointerup";
                event.button = 1;
                event.pointerId = 2;
                event.pointerType = "touch";
                simulateEvent(this.cameraInput, event);

                // Second Touch event.
                event.type = "pointermove";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                event.type = "pointermove";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                event.type = "pointermove";
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                // No render call so no callbacks have been called.
                expect(this.cameraInput.countOnTouch).to.equal(0);
                expect(this.cameraInput.countOnMultiTouch).to.equal(0);
                expect(this.cameraInput.countOnButtonDown).to.equal(0);
                expect(this.cameraInput.countOnButtonUp).to.equal(0);

                // Call checkInputs().
                simulateRender(this.cameraInput);

                // Now callbacks have been called.

                // "touch" events in between button presses have been combined.
                expect(this.cameraInput.countOnTouch).to.equal(2);

                expect(this.cameraInput.countOnMultiTouch).to.equal(1);
                expect(this.cameraInput.countOnButtonDown).to.equal(2);
                expect(this.cameraInput.countOnButtonUp).to.equal(1);
            }
        });

        it('queues events verifying drag movement.', function() {
            // Only do this test if this.cameraInput._defferCallback === true.
            if (this.cameraInput._defferCallback) {
                var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

                // Button down.
                event.type = "pointerdown";
                event.clientX = 100;
                event.clientY = 200;
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                // Start moving.
                event.type = "pointermove";
                event.clientX = 101;
                event.clientY = 200;
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                event.type = "pointermove";
                event.clientX = 102;
                event.clientY = 200;
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                event.type = "pointermove";
                event.clientX = 102;
                event.clientY = 199;
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                event.type = "pointermove";
                event.clientX = 102;
                event.clientY = 198;
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                // Button up.
                event.type = "pointerup";
                event.clientX = 103;
                event.clientY = 198;
                event.button = 0;
                simulateEvent(this.cameraInput, event);

                // No render call so no callbacks have been called.
                expect(this.cameraInput.countOnTouch).to.equal(0);
                expect(this.cameraInput.countOnMultiTouch).to.equal(0);
                expect(this.cameraInput.countOnButtonDown).to.equal(0);
                expect(this.cameraInput.countOnButtonUp).to.equal(0);

                // Call checkInputs().
                simulateRender(this.cameraInput);
                // Now callbacks have been called.
                expect(this.cameraInput.countOnTouch).to.equal(1);
                expect(this.cameraInput.countOnMultiTouch).to.equal(0);
                expect(this.cameraInput.countOnButtonDown).to.equal(1);
                expect(this.cameraInput.countOnButtonUp).to.equal(1);

                expect(this.cameraInput.lastOnTouch.offsetX).to.equal(2);
                expect(this.cameraInput.lastOnTouch.offsetY).to.equal(-2);
            }
        });

        it('compares "onTouch()" deffered camera to immediate camera.', function() {
            // Only do this test if this.cameraInput._defferCallback === true.
            if (this.cameraInput._defferCallback) {

                // Set up a 2nd Camera with the ArcRotateCameraPointersInput.
                // This camera input dispatches event callbacks immediately.
                const camera2 = new BABYLON.ArcRotateCamera("StubCamera2", 0, 0, 0, new BABYLON.Vector3(0, 0, 0), this._scene);
                const cameraInput2 = StubCameraInput();
                cameraInput2.camera = camera2;
                cameraInput2.attachControl();
                cameraInput2._defferCallback = false;

                let offsetXTotal = 0;
                let offsetYTotal = 0;
                function totalNonDeferredCamera() {
                    if(cameraInput2.lastOnTouch !== undefined) {
                        offsetXTotal += cameraInput2.lastOnTouch.offsetX;
                        offsetYTotal += cameraInput2.lastOnTouch.offsetY;
                    }
                    cameraInput2.lastOnTouch = undefined;
                }

                var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

                // Button down.
                event.type = "pointerdown";
                event.clientX = 100;
                event.clientY = 200;
                event.button = 0;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // Start moving.
                event.type = "pointermove";
                event.clientX = 101;
                event.clientY = 200;
                event.button = 0;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                event.type = "pointermove";
                event.clientX = 102;
                event.clientY = 200;
                event.button = 0;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                event.type = "pointermove";
                event.clientX = 102;
                event.clientY = 199;
                event.button = 0;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                event.type = "pointermove";
                event.clientX = 102;
                event.clientY = 198;
                event.button = 0;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // Button up.
                event.type = "pointerup";
                event.clientX = 103;
                event.clientY = 198;
                event.button = 0;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // No render call so no callbacks have been called for deferred
                // camera.
                expect(this.cameraInput.countOnTouch).to.equal(0);
                expect(this.cameraInput.countOnMultiTouch).to.equal(0);
                expect(this.cameraInput.countOnButtonDown).to.equal(0);
                expect(this.cameraInput.countOnButtonUp).to.equal(0);
                // All callbacks called for non-deferred camera.
                expect(cameraInput2.countOnTouch).to.equal(4);
                expect(cameraInput2.countOnMultiTouch).to.equal(0);
                expect(cameraInput2.countOnButtonDown).to.equal(1);
                expect(cameraInput2.countOnButtonUp).to.equal(1);

                // Call checkInputs().
                simulateRender(this.cameraInput);
                // Now callbacks have been called on deferred camera.
                expect(this.cameraInput.countOnTouch).to.equal(1);
                expect(this.cameraInput.countOnMultiTouch).to.equal(0);
                expect(this.cameraInput.countOnButtonDown).to.equal(1);
                expect(this.cameraInput.countOnButtonUp).to.equal(1);

                // Both cameras should have moved the same amount.
                expect(this.cameraInput.lastOnTouch.offsetX).to.equal(offsetXTotal);
                expect(this.cameraInput.lastOnTouch.offsetY).to.equal(offsetYTotal);
            }
        });

        it('compares "onMultiTouch()" deffered camera to immediate camera.', function() {
            // Only do this test if this.cameraInput._defferCallback === true.
            if (this.cameraInput._defferCallback) {

                // Set up a 2nd Camera with the ArcRotateCameraPointersInput.
                // This camera input dispatches event callbacks immediately.
                const camera2 = new BABYLON.ArcRotateCamera("StubCamera2", 0, 0, 0, new BABYLON.Vector3(0, 0, 0), this._scene);
                const cameraInput2 = StubCameraInput();
                cameraInput2.camera = camera2;
                cameraInput2.attachControl();
                cameraInput2._defferCallback = false;

                let pinchSquaredDistanceTotal = 0;
                let multiTouchPanPositionMostRecent = undefined;
                function totalNonDeferredCamera() {
                    if(cameraInput2.lastOnMultiTouch !== undefined) {
                        pinchSquaredDistanceTotal +=
                            cameraInput2.lastOnMultiTouch.pinchSquaredDistance;
                        multiTouchPanPositionMostRecent =
                            cameraInput2.lastOnMultiTouch.multiTouchPanPosition;
                    }
                    cameraInput2.lastOnMultiTouch = undefined;
                }

                var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

                // Button down.
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.clientX = 100;
                event.clientY = 200;
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // 2nd button down.
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.clientX = 300;
                event.clientY = 400;
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // Start moving. 1st button.
                event.type = "pointermove";
                event.clientX = 101;
                event.clientY = 200;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // 1st button.
                event.type = "pointermove";
                event.clientX = 102;
                event.clientY = 200;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // 2nd button.
                event.type = "pointermove";
                event.clientX = 300;
                event.clientY = 401;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // 2nd button.
                event.type = "pointermove";
                event.clientX = 300;
                event.clientY = 402;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // No render call so no callbacks have been called for deferred
                // camera.
                expect(this.cameraInput.countOnTouch).to.equal(0);
                expect(this.cameraInput.countOnMultiTouch).to.equal(0);
                expect(this.cameraInput.countOnButtonDown).to.equal(0);
                expect(this.cameraInput.countOnButtonUp).to.equal(0);
                // All callbacks called for non-deferred camera.
                expect(cameraInput2.countOnTouch).to.equal(0);
                expect(cameraInput2.countOnMultiTouch).to.equal(4);
                expect(cameraInput2.countOnButtonDown).to.equal(2);
                expect(cameraInput2.countOnButtonUp).to.equal(0);

                // Call checkInputs().
                simulateRender(this.cameraInput);
                // Now callbacks have been called on deferred camera.
                expect(this.cameraInput.countOnTouch).to.equal(0);
                expect(this.cameraInput.countOnMultiTouch).to.equal(1);
                expect(this.cameraInput.countOnButtonDown).to.equal(2);
                expect(this.cameraInput.countOnButtonUp).to.equal(0);

                // Both cameras should have moved the same amount.
                expect(this.cameraInput.lastOnMultiTouch.pinchSquaredDistance)
                    .to.equal(pinchSquaredDistanceTotal);
                // and to the same place.
                expect(this.cameraInput.lastOnMultiTouch.multiTouchPanPosition.x)
                    .to.equal(multiTouchPanPositionMostRecent.x);
                expect(this.cameraInput.lastOnMultiTouch.multiTouchPanPosition.y)
                    .to.equal(multiTouchPanPositionMostRecent.y);
                expect(this.cameraInput.lastOnMultiTouch.multiTouchPanPosition.pointerId)
                    .to.equal(multiTouchPanPositionMostRecent.pointerId);

                expect(this.cameraInput.lastOnMultiTouch.previousPinchSquaredDistance)
                    .to.equal(0);

                // Save values to compare after next event.
                const previousPinchSquaredDistance =
                    this.cameraInput.lastOnMultiTouch.pinchSquaredDistance;
                const previousMultiTouchPanPosition =
                    this.cameraInput.lastOnMultiTouch.multiTouchPanPosition;

                // Clear counters.
                pinchSquaredDistanceTotal = 0;

                this.cameraInput.countOnTouch = 0;
                this.cameraInput.countOnMultiTouch = 0;
                this.cameraInput.countOnButtonDown = 0;
                this.cameraInput.countOnButtonUp = 0;

                cameraInput2.countOnTouch = 0;
                cameraInput2.countOnMultiTouch = 0;
                cameraInput2.countOnButtonDown = 0;
                cameraInput2.countOnButtonUp = 0;

                // Now continue multiTouch drag.
                // Start moving. 1st button.
                event.type = "pointermove";
                event.clientX = 103;
                event.clientY = 200;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // Button up.
                event.type = "pointerup";
                event.pointerType = "touch";
                event.clientX = 100;
                event.clientY = 200;
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // 2nd button up.
                event.type = "pointerup";
                event.pointerType = "touch";
                event.clientX = 300;
                event.clientY = 400;
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateEvent(cameraInput2, event);
                totalNonDeferredCamera();

                // No render call so no additional callbacks have been called
                // for deferred camera.
                expect(this.cameraInput.countOnTouch).to.equal(0);
                expect(this.cameraInput.countOnMultiTouch).to.equal(0);
                expect(this.cameraInput.countOnButtonDown).to.equal(0);
                expect(this.cameraInput.countOnButtonUp).to.equal(0);
                // All callbacks called for non-deferred camera.
                expect(cameraInput2.countOnTouch).to.equal(0);
                expect(cameraInput2.countOnMultiTouch).to.equal(2);
                expect(cameraInput2.countOnButtonDown).to.equal(0);
                expect(cameraInput2.countOnButtonUp).to.equal(2);

                // Call checkInputs().
                simulateRender(this.cameraInput);
                // Now callbacks have been called on deferred camera.
                expect(this.cameraInput.countOnTouch).to.equal(0);
                expect(this.cameraInput.countOnMultiTouch).to.equal(1);
                expect(this.cameraInput.countOnButtonDown).to.equal(0);
                expect(this.cameraInput.countOnButtonUp).to.equal(2);

                // Both cameras should have moved the same amount.
                expect(this.cameraInput.lastOnMultiTouch.pinchSquaredDistance)
                    .to.equal(pinchSquaredDistanceTotal);

                // multiTouchPanPosition is null when the drag ends.
                expect(this.cameraInput.lastOnMultiTouch.multiTouchPanPosition)
                    .to.equal(null);

                // Previous distance matches.
                expect(this.cameraInput.lastOnMultiTouch.previousPinchSquaredDistance)
                    .to.equal(previousPinchSquaredDistance);
                // and previous position matches.
                expect(this.cameraInput.lastOnMultiTouch.previousMultiTouchPanPosition.x)
                    .to.equal(previousMultiTouchPanPosition.x);
                expect(this.cameraInput.lastOnMultiTouch.previousMultiTouchPanPosition.y)
                    .to.equal(previousMultiTouchPanPosition.y);
                expect(this.cameraInput.lastOnMultiTouch.previousMultiTouchPanPosition.pointerId)
                    .to.equal(previousMultiTouchPanPosition.pointerId);
            }
        });
    });

    describe("one button drag", function () {
        it('calls "onTouch" method', function () {
            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

            // Button down.
            event.type = "pointerdown";
            event.clientX = 100;
            event.clientY = 200;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Button down but no movement events have fired yet.
            expect(this.cameraInput.countOnTouch).to.equal(0);
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);

            // Start moving.
            event.type = "pointermove";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnTouch).to.equal(1);
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            // Move just started; No value yet.
            expect(this.cameraInput.lastOnTouch.offsetX).to.equal(0);
            expect(this.cameraInput.lastOnTouch.offsetY).to.equal(0);

            // Drag.
            event.type = "pointermove";
            event.clientX = 1000;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnTouch).to.equal(2);
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            // Pointer dragged in X direction.
            expect(this.cameraInput.lastOnTouch.offsetX).to.above(0);
            expect(this.cameraInput.lastOnTouch.offsetY).to.equal(0);

            // Button up.
            event.type = "pointerup";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnTouch).to.equal(2);
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(1);

            // These callbacks were never called.
            expect(this.cameraInput.countOnDoubleTap).to.equal(0);
            expect(this.cameraInput.countOnMultiTouch).to.equal(0);
            expect(this.cameraInput.countOnContextMenu).to.equal(0);
            expect(this.cameraInput.countOnLostFocus).to.equal(0);
        });

        it("leaves a clean state allowing repeat calls", function () {
            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

            // Button down.
            event.type = "pointerdown";
            event.clientX = 100;
            event.clientY = 200;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Button down but no movement events have fired yet.
            expect(this.cameraInput.countOnTouch).to.equal(0);
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);

            // Start moving.
            event.type = "pointermove";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnTouch).to.equal(1);
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            // Move just started; No value yet.
            expect(this.cameraInput.lastOnTouch.offsetX).to.equal(0);
            expect(this.cameraInput.lastOnTouch.offsetY).to.equal(0);

            // Drag.
            event.type = "pointermove";
            event.clientX = 1000;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnTouch).to.equal(2);
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            // Pointer dragged in X direction.
            expect(this.cameraInput.lastOnTouch.offsetX).to.above(0);
            expect(this.cameraInput.lastOnTouch.offsetY).to.equal(0);

            // Button up.
            event.type = "pointerup";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnTouch).to.equal(2);
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(1);

            // Button down for 2nd time.
            event.type = "pointerdown";
            event.clientX = 100;
            event.clientY = 200;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Button down but no movement events have fired yet.
            expect(this.cameraInput.countOnTouch).to.equal(2);
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(1);

            // Start moving.
            event.type = "pointermove";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnTouch).to.equal(3);
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(1);
            // Move just started; No value yet.
            expect(this.cameraInput.lastOnTouch.offsetX).to.equal(0);
            expect(this.cameraInput.lastOnTouch.offsetY).to.equal(0);

            // Drag again.
            event.type = "pointermove";
            event.clientY = 2000;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnTouch).to.equal(4);
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(1);
            // Pointer dragged in Y direction.
            expect(this.cameraInput.lastOnTouch.offsetX).to.equal(0);
            expect(this.cameraInput.lastOnTouch.offsetY).to.above(0);

            // Button up.
            event.type = "pointerup";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnTouch).to.equal(4);
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(2);

            // These callbacks were never called.
            expect(this.cameraInput.countOnDoubleTap).to.equal(0);
            expect(this.cameraInput.countOnMultiTouch).to.equal(0);
            expect(this.cameraInput.countOnContextMenu).to.equal(0);
            expect(this.cameraInput.countOnLostFocus).to.equal(0);
        });
    });

    describe("two button drag", function () {
        it('calls "onMultiTouch" method', function () {
            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

            // 1st button down.
            event.type = "pointerdown";
            event.pointerType = "touch";
            event.clientX = 1000;
            event.clientY = 200;
            event.button = 0;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Button down but no movement events have fired yet.
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.countOnTouch).to.equal(0);
            expect(this.cameraInput.countOnMultiTouch).to.equal(0);

            // Start moving before 2nd button has been pressed.
            event.type = "pointermove";
            event.button = -1;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Moving with one button down will start a drag.
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.countOnTouch).to.equal(1);
            expect(this.cameraInput.countOnMultiTouch).to.equal(0);

            // Move X coordinate.
            event.type = "pointermove";
            event.clientX = 1500;
            event.clientY = 200;
            event.button = -1;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // One button drag.
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.countOnTouch).to.equal(2);
            expect(this.cameraInput.countOnMultiTouch).to.equal(0);

            // 2nd button down. (Enter zoom mode.)
            event.type = "pointerdown";
            event.pointerType = "touch";
            event.button = 1;
            event.pointerId = 2;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // 2nd button down but hasn't moved yet.
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.countOnTouch).to.equal(2);
            expect(this.cameraInput.countOnMultiTouch).to.equal(0);

            // Start move of 2nd pointer.
            event.type = "pointermove";
            event.clientX = 2000;
            event.clientY = 2000;
            event.button = -1;
            event.pointerId = 2;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Start of drag with 2 buttons down.
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.countOnTouch).to.equal(2);
            expect(this.cameraInput.countOnMultiTouch).to.equal(1);
            // First time onMultiTouch() is called for a new drag.
            expect(this.cameraInput.lastOnMultiTouch.pinchSquaredDistance).to.be.above(0);
            expect(this.cameraInput.lastOnMultiTouch.multiTouchPanPosition).to.not.be.null;
            // previousPinchSquaredDistance will be null.
            expect(this.cameraInput.lastOnMultiTouch.previousPinchSquaredDistance).to.be.equal(0);
            expect(this.cameraInput.lastOnMultiTouch.previousMultiTouchPanPosition).to.be.null;

            // Move Y coordinate. 2nd point is the one moving.
            event.type = "pointermove";
            event.clientX = 2000;
            event.clientY = 2500;
            event.button = -1;
            event.pointerId = 2;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Moving two button drag.
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.countOnTouch).to.equal(2);
            expect(this.cameraInput.countOnMultiTouch).to.equal(2);
            // Neither first nor last event in a drag so everything populated.
            expect(this.cameraInput.lastOnMultiTouch.pinchSquaredDistance).to.be.above(0);
            expect(this.cameraInput.lastOnMultiTouch.multiTouchPanPosition).to.not.be.null;
            expect(this.cameraInput.lastOnMultiTouch.previousPinchSquaredDistance).to.be.above(0);
            expect(this.cameraInput.lastOnMultiTouch.previousMultiTouchPanPosition).to.not.be.null;

            // Move X and Y coordinate. 1st point is the one moving.
            event.type = "pointermove";
            event.clientX = 1700;
            event.clientY = 1700;
            event.button = -1;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Moving two button drag.
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.countOnTouch).to.equal(2);
            expect(this.cameraInput.countOnMultiTouch).to.equal(3);

            // One of the buttons button up.
            event.type = "pointerup";
            event.pointerType = "touch";
            event.button = 0;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Button up.
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(1);
            expect(this.cameraInput.countOnTouch).to.equal(2);
            expect(this.cameraInput.countOnMultiTouch).to.equal(4);
            // onMultiTouch() is called one last time when drag ends with null value for
            // multiTouchPanPosition.
            expect(this.cameraInput.lastOnMultiTouch.pinchSquaredDistance).to.equal(0);
            expect(this.cameraInput.lastOnMultiTouch.multiTouchPanPosition).to.be.null;
            // previousPinchSquaredDistance and previousMultiTouchPanPosition are
            // populated though.
            expect(this.cameraInput.lastOnMultiTouch.previousPinchSquaredDistance).to.be.above(0);
            expect(this.cameraInput.lastOnMultiTouch.previousMultiTouchPanPosition).to.not.be.null;

            // Move X and Y coordinate of remaining pressed point.
            event.type = "pointermove";
            event.clientX = 2000;
            event.clientY = 2700;
            event.button = -1;
            event.pointerId = 2;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Back to one button drag.
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(1);
            expect(this.cameraInput.countOnTouch).to.equal(3);
            expect(this.cameraInput.countOnMultiTouch).to.equal(4);

            // Other button button up. (Now moves should have no affect.)
            event.type = "pointerup";
            event.pointerType = "touch";
            event.button = 1;
            event.pointerId = 2;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Button up.
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(2);
            expect(this.cameraInput.countOnTouch).to.equal(3);
            expect(this.cameraInput.countOnMultiTouch).to.equal(4);

            // Move X and Y coordinate.
            event.type = "pointermove";
            event.clientX = 3000;
            event.clientY = 4000;
            event.button = -1;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Not dragging anymore so no change in callbacks.
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(2);
            expect(this.cameraInput.countOnTouch).to.equal(3);
            expect(this.cameraInput.countOnMultiTouch).to.equal(4);

            // These callbacks were never called.
            expect(this.cameraInput.countOnDoubleTap).to.equal(0);
            expect(this.cameraInput.countOnContextMenu).to.equal(0);
            expect(this.cameraInput.countOnLostFocus).to.equal(0);
        });
    });

    describe("button down then up", function () {
        it('calls "onButtonDown" and "onButtonUp"', function () {
            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

            // 1st button down.
            event.type = "pointerdown";
            event.pointerType = "touch";
            event.button = 0;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.pointersDown).to.be.have.length(1);

            // 2nd button down.
            event.type = "pointerdown";
            event.pointerType = "touch";
            event.button = 1;
            event.pointerId = 2;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.pointersDown).to.be.have.length(2);

            // One button up.
            event.type = "pointerup";
            event.pointerType = "touch";
            event.button = 1;
            event.pointerId = 2;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(1);
            expect(this.cameraInput.pointersDown).to.be.have.length(1);

            // Other button up.
            event.type = "pointerup";
            event.pointerType = "touch";
            event.button = 0;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(2);
            expect(this.cameraInput.pointersDown).to.be.have.length(0);

            // These callbacks were never called.
            expect(this.cameraInput.countOnTouch).to.equal(0);
            expect(this.cameraInput.countOnMultiTouch).to.equal(0);
            expect(this.cameraInput.countOnDoubleTap).to.equal(0);
            expect(this.cameraInput.countOnContextMenu).to.equal(0);
            expect(this.cameraInput.countOnLostFocus).to.equal(0);
        });

        it("pointerId of pointerup doesnt match", function () {
            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

            // 1st button down.
            event.type = "pointerdown";
            event.pointerType = "touch";
            event.button = 0;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnButtonDown).to.equal(1);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.pointersDown).to.be.have.length(1);

            // 2nd button down.
            event.type = "pointerdown";
            event.pointerType = "touch";
            event.button = 1;
            event.pointerId = 2;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnButtonDown).to.equal(2);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.pointersDown).to.be.have.length(2);

            // 3rd button down.
            event.type = "pointerdown";
            event.pointerType = "touch";
            event.button = 2;
            event.pointerId = 3;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            // Only 2 buttons are tracked.
            // onButtonDown() gets called but nothing else changes.
            expect(this.cameraInput.countOnButtonDown).to.equal(3);
            expect(this.cameraInput.countOnButtonUp).to.equal(0);
            expect(this.cameraInput.pointersDown).to.be.have.length(2);

            // One button up.
            event.type = "pointerup";
            event.pointerType = "touch";
            event.button = 1;
            event.pointerId = 99;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(this.cameraInput.countOnButtonDown).to.equal(3);
            expect(this.cameraInput.countOnButtonUp).to.equal(1);
            // Button state gets cleared. No buttons registered as being down.
            expect(this.cameraInput.pointersDown).to.be.have.length(0);

            // These callbacks were never called.
            expect(this.cameraInput.countOnTouch).to.equal(0);
            expect(this.cameraInput.countOnMultiTouch).to.equal(0);
            expect(this.cameraInput.countOnDoubleTap).to.equal(0);
            expect(this.cameraInput.countOnContextMenu).to.equal(0);
            expect(this.cameraInput.countOnLostFocus).to.equal(0);
        });
    });
});

/**
 * Test the things.
 * The ArcRotateCameraInput class.
 */
describe("ArcRotateCameraInput", function () {
    /**
     * Sets the timeout of all the tests to 10 seconds.
     */
    this.timeout(10000);

    enum ValChange {
        Increase,
        Same,
        Decrease,
        DontCare,
    }

    const interestingValues = ["inertialPanningX", "inertialPanningY", "inertialAlphaOffset", "inertialBetaOffset", "inertialRadiusOffset"];

    function resetCameraPos(camera: BABYLON.ArcRotateCamera, cameraCachePos: {}) {
        camera.alpha = 10;
        camera.beta = 20;
        camera.radius = 30;
        camera.inertialPanningX = 0;
        camera.inertialPanningY = 0;
        camera.inertialAlphaOffset = 0;
        camera.inertialBetaOffset = 0;
        camera.inertialRadiusOffset = 0;
        camera._panningMouseButton = 2;
        camera.useInputToRestoreState = true;
        camera._useCtrlForPanning = true;

        interestingValues.forEach((key) => {
            cameraCachePos[key] = camera[key];
        });
    }

    function verifyChanges(camera: BABYLON.ArcRotateCamera, cameraCachePos: {}, toCheck: { [key: string]: ValChange }): boolean {
        let result = true;
        interestingValues.forEach((key) => {
            if (toCheck[key] === undefined) {
                toCheck[key] = ValChange.Same;
            }
            let r = toCheck[key] === ValChange.DontCare || (toCheck[key] === ValChange.Decrease && camera[key] < cameraCachePos[key]) || (toCheck[key] === ValChange.Same && camera[key] === cameraCachePos[key]) || (toCheck[key] === ValChange.Increase && camera[key] > cameraCachePos[key]);
            if (!r) {
                console.log(`Incorrect value for ${key}, previous: ${cameraCachePos[key]}, current: ${camera[key]}`);
            }
            result = result && r;

            cameraCachePos[key] = camera[key];
        });

        if (!result) {
            displayCamera(camera);
        }
        return result;
    }

    function displayCamera(camera: BABYLON.ArcRotateCamera): void {
        let info = {
            inertialPanningX: camera.inertialPanningX,
            inertialPanningY: camera.inertialPanningY,
            inertialAlphaOffset: camera.inertialAlphaOffset,
            inertialBetaOffset: camera.inertialBetaOffset,
            inertialRadiusOffset: camera.inertialRadiusOffset,
        };
        console.log(info);
    }

    before(function (done) {
        // runs before all tests in this block
        this.timeout(180000);
        BABYLONDEVTOOLS.Loader.useDist()
            .testMode()
            .load(function () {
                // Force apply promise polyfill for consistent behavior between
                // PhantomJS, IE11, and other browsers.
                BABYLON.PromisePolyfill.Apply(true);
                done();
            });

        this._canvas = document.createElement("canvas");
        this._scene = new BABYLON.Scene(new BABYLON.NullEngine());

        // Set up an instance of a Camera with the ArcRotateCameraPointersInput.
        this.camera = new BABYLON.ArcRotateCamera("Camera", 0, 0, 0, new BABYLON.Vector3(0, 0, 0), this._scene);
        this.cameraInput = new BABYLON.ArcRotateCameraPointersInput();
        this.cameraInput.camera = this.camera;
        this.cameraInput.attachControl();

        this.cameraCachePos = {};
    });

    beforeEach(function () {
        // runs before each test in this block
        resetCameraPos(this.camera, this.cameraCachePos);
    });

    describe("Test infrastructure", function () {
        it("verifyChanges checks Decrease", function () {
            this.camera.inertialAlphaOffset = 10;
            this.cameraCachePos.inertialAlphaOffset = 10.001;
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Decrease })).to.be.true;

            this.camera.inertialAlphaOffset = 10;
            this.cameraCachePos.inertialAlphaOffset = 9.999;
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Decrease })).to.be.false;
        });

        it("verifyChanges checks Same", function () {
            this.camera.inertialAlphaOffset = 10;
            this.cameraCachePos.inertialAlphaOffset = 10;
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Same })).to.be.true;

            this.camera.inertialAlphaOffset = 10;
            this.cameraCachePos.inertialAlphaOffset = 10.001;
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Same })).to.be.false;
        });

        it("verifyChanges checks undefined", function () {
            // If the 'toCheck' field is undefined, treat is as ValChange.Same.
            this.camera.inertialAlphaOffset = 10;
            this.cameraCachePos.inertialAlphaOffset = 10;
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            this.camera.inertialAlphaOffset = 10;
            this.cameraCachePos.inertialAlphaOffset = 10.001;
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.false;
        });

        it("verifyChanges checks DontCare", function () {
            this.camera.inertialAlphaOffset = 10;
            this.cameraCachePos.inertialAlphaOffset = 10;
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.DontCare })).to.be.true;

            this.camera.inertialAlphaOffset = 10;
            this.cameraCachePos.inertialAlphaOffset = 1001;
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.DontCare })).to.be.true;
        });

        it("verifyChanges checks Increase", function () {
            this.camera.inertialAlphaOffset = 10;
            this.cameraCachePos.inertialAlphaOffset = 9.999;
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Increase })).to.be.true;

            this.camera.inertialAlphaOffset = 10;
            this.cameraCachePos.inertialAlphaOffset = 10.001;
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Increase })).to.be.false;
        });
    });

    describe("one button drag", function () {
        it("changes inertialAlphaOffset", function () {
            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

            // Button down.
            event.type = "pointerdown";
            event.clientX = 100;
            event.clientY = 200;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Start moving.
            event.type = "pointermove";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Move X coordinate. Drag camera.
            event.type = "pointermove";
            event.clientX = 1000;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Decrease })).to.be.true;

            // Button up. Primary button.
            event.type = "pointerup";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;
        });

        it("followed by another one button drag", function () {
            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

            // Button down.
            event.type = "pointerdown";
            event.clientX = 100;
            event.clientY = 200;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Start moving.
            event.type = "pointermove";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Move X coordinate. Drag camera.
            event.type = "pointermove";
            event.clientX = 1000;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Decrease })).to.be.true;

            // Button up. Primary button.
            event.type = "pointerup";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // 2nd drag.
            // Button down.
            event.type = "pointerdown";
            event.clientX = 100;
            event.clientY = 200;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Start moving.
            event.type = "pointermove";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Move Y coordinate. Drag camera.
            event.type = "pointermove";
            event.clientY = 1000;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialBetaOffset: ValChange.Decrease })).to.be.true;

            // Button up. Primary button.
            event.type = "pointerup";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;
        });

        it("with Ctrl key changes inertialPanningY", function () {
            this.cameraInput.panningSensibility = 3;
            this.cameraInput._useCtrlForPanning = true;

            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

            // Button down.
            event.type = "pointerdown";
            event.clientX = 100;
            event.clientY = 200;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Start moving.
            event.type = "pointermove";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Move Y coordinate. Drag camera. (Not panning yet.)
            event.type = "pointermove";
            event.clientY = 1000;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialBetaOffset: ValChange.Decrease })).to.be.true;

            // Move X coordinate with Ctrl key depressed. Panning now.
            event.type = "pointermove";
            event.clientY = 2000;
            event.button = 0;
            event.ctrlKey = true; // Will cause pan motion.
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialPanningY: ValChange.Increase })).to.be.true;

            // Move X coordinate having released Ctrl.
            event.type = "pointermove";
            event.clientY = 3000;
            event.button = 0;
            event.ctrlKey = false; // Will cancel pan motion.
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialBetaOffset: ValChange.Decrease })).to.be.true;

            // Button up. Primary button.
            event.type = "pointerup";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;
        });

        it("with panningSensibility disabled", function () {
            this.cameraInput.panningSensibility = 0;

            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

            // Button down.
            event.type = "pointerdown";
            event.clientX = 100;
            event.clientY = 200;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Start moving.
            event.type = "pointermove";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Move Y coordinate. Drag camera.
            event.type = "pointermove";
            event.clientY = 1000;
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialBetaOffset: ValChange.Decrease })).to.be.true;

            // Move X coordinate with Ctrl key depressed.
            // Panning disabled so continue regular drag..
            event.type = "pointermove";
            event.clientY = 1500;
            event.button = 0;
            event.ctrlKey = true; // Will cause pan motion.
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialBetaOffset: ValChange.Decrease })).to.be.true;

            // Move X coordinate having released Ctrl.
            event.type = "pointermove";
            event.clientY = 3000;
            event.button = 0;
            event.ctrlKey = false;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialBetaOffset: ValChange.Decrease })).to.be.true;

            // Button up. Primary button.
            event.type = "pointerup";
            event.button = 0;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;
        });
    });

    describe("two button drag", function () {
        describe("multiTouchPanAndZoom enabled", function () {
            it("pinchDeltaPercentage enabled", function () {
                // Multiple button presses interpreted as "pinch" and "swipe".
                this.cameraInput.multiTouchPanAndZoom = true;
                // Zoom changes are a percentage of current value.
                this.cameraInput.pinchDeltaPercentage = 10;
                // Panning not enabled.
                this.cameraInput.panningSensibility = 0;

                var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

                // 1st button down.
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.clientX = 1000;
                event.clientY = 200;
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start moving before 2nd button has been pressed.
                event.type = "pointermove";
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

                // Move X coordinate.
                event.type = "pointermove";
                event.clientX = 1500;
                event.clientY = 200;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Decrease })).to.be.true;

                // 2nd button down. (Enter zoom mode.)
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start move of 2nd pointer.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2000;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

                // Move Y coordinate. 2nd point is the one moving.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2500;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialRadiusOffset: ValChange.Increase })).to.be.true;

                // Move X + Y coordinate. 1st point is the one moving.
                event.type = "pointermove";
                event.clientX = 1700;
                event.clientY = 1700;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialRadiusOffset: ValChange.Decrease })).to.be.true;

                // One of the buttons button up. (Leave zoom mode.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Move X and Y coordinate of remaining pressed point.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2700;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialBetaOffset: ValChange.Decrease })).to.be.true;

                // Other button button up. (Now moves should have no affect.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Move X and Y coordinate.
                event.type = "pointermove";
                event.clientX = 3000;
                event.clientY = 4000;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;
            });

            it("pinchDeltaPercentage disabled", function () {
                // Multiple button presses interpreted as "pinch" and "swipe".
                this.cameraInput.multiTouchPanAndZoom = true;
                // Zoom changes are not a percentage of current value.
                this.cameraInput.pinchDeltaPercentage = 0;
                // Panning not enabled.
                this.cameraInput.panningSensibility = 0;

                var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

                // 1st button down.
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.clientX = 1000;
                event.clientY = 200;
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start moving before 2nd button has been pressed.
                event.type = "pointermove";
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

                // Move X coordinate.
                event.type = "pointermove";
                event.clientX = 1500;
                event.clientY = 200;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Decrease })).to.be.true;

                // 2nd button down. (Enter zoom mode.)
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start move of 2nd pointer.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2000;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

                // Move Y coordinate. 2nd point is the one moving.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2500;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialRadiusOffset: ValChange.Increase })).to.be.true;

                // Move X + Y coordinate. 1st point is the one moving.
                event.type = "pointermove";
                event.clientX = 1700;
                event.clientY = 1700;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialRadiusOffset: ValChange.Decrease })).to.be.true;

                // One of the buttons button up. (Leave zoom mode.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Move X and Y coordinate of remaining pressed point.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2700;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialBetaOffset: ValChange.Decrease })).to.be.true;

                // Other button button up. (Now moves should have no affect.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Move X and Y coordinate.
                event.type = "pointermove";
                event.clientX = 3000;
                event.clientY = 4000;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;
            });

            it("pan on drag", function () {
                // Multiple button presses interpreted as "pinch" and "swipe".
                this.cameraInput.multiTouchPanAndZoom = true;
                // Zoom changes are not a percentage of current value.
                this.cameraInput.pinchDeltaPercentage = 0;
                // Panning not enabled.
                this.cameraInput.panningSensibility = 3;

                var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

                // 1st button down.
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.clientX = 1000;
                event.clientY = 200;
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start moving before 2nd button has been pressed.
                event.type = "pointermove";
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

                // Move X coordinate.
                event.type = "pointermove";
                event.clientX = 1500;
                event.clientY = 200;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Decrease })).to.be.true;

                // 2nd button down. (Enter zoom mode.)
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start move of 2nd pointer.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2000;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

                // Move Y coordinate. 2nd point is the one moving.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2500;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialRadiusOffset: ValChange.Increase, inertialPanningY: ValChange.Increase })).to.be.true;

                // Move X + Y coordinate. 1st point is the one moving.
                event.type = "pointermove";
                event.clientX = 1700;
                event.clientY = 1700;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialRadiusOffset: ValChange.Decrease, inertialPanningX: ValChange.Decrease, inertialPanningY: ValChange.Increase })).to.be.true;

                // One of the buttons button up. (Leave zoom mode.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Move X and Y coordinate of remaining pressed point.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2700;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialBetaOffset: ValChange.Decrease })).to.be.true;

                // Other button button up. (Now moves should have no affect.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Move X and Y coordinate.
                event.type = "pointermove";
                event.clientX = 3000;
                event.clientY = 4000;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;
            });
        });

        describe("multiTouchPanAndZoom disabled", function () {
            it("pinchDeltaPercentage enabled", function () {
                // Multiple button presses not interpreted as multitouch.
                this.cameraInput.multiTouchPanAndZoom = false;
                // Zoom changes are a percentage of current value.
                this.cameraInput.pinchDeltaPercentage = 10;
                // Panning not enabled.
                this.cameraInput.panningSensibility = 3;

                var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

                // 1st button down.
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.clientX = 1000;
                event.clientY = 200;
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start moving before 2nd button has been pressed.
                event.type = "pointermove";
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

                // Move X coordinate.
                event.type = "pointermove";
                event.clientX = 1500;
                event.clientY = 200;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Decrease })).to.be.true;

                // 2nd button down. (Enter zoom mode.)
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start move of 2nd pointer.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2000;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

                // Move Y coordinate. 2nd point is the one moving.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2500;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialRadiusOffset: ValChange.Increase })).to.be.true;

                // Move X + Y coordinate. 1st point is the one moving.
                event.type = "pointermove";
                event.clientX = 1700;
                event.clientY = 1700;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialRadiusOffset: ValChange.Decrease })).to.be.true;

                // One of the buttons button up. (Leave zoom mode.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Move X and Y coordinate of remaining pressed point.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2700;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialBetaOffset: ValChange.Decrease })).to.be.true;

                // 1st button down again
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start move of 1st button.
                // This time trigger more than 20 pointermove events without moving more
                // than pinchToPanMaxDistance to lock into "pan" mode.
                event.type = "pointermove";
                event.clientX = 1000;
                event.clientY = 1000;
                event.button = -1;
                event.pointerId = 1;

                for (let i = 0; i < 21; i++) {
                    event.clientX++;
                    simulateEvent(this.cameraInput, event);
                    simulateRender(this.cameraInput);
                }
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialPanningX: ValChange.Decrease })).to.be.true;

                // Now we are in "pan" mode, we can move 1st pointer larger distances.
                event.type = "pointermove";
                event.clientX = 5000;
                event.clientY = 5000;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialPanningX: ValChange.Decrease, inertialPanningY: ValChange.Increase })).to.be.true;

                // One of the buttons button up. (Leave pan mode.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Other button button up. (Now moves should have no affect.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Move X and Y coordinate.
                event.type = "pointermove";
                event.clientX = 3000;
                event.clientY = 4000;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;
            });

            it("pinchDeltaPercentage disabled", function () {
                // Multiple button presses not interpreted as multitouch.
                this.cameraInput.multiTouchPanAndZoom = false;
                // Zoom changes are not a percentage of current value.
                this.cameraInput.pinchDeltaPercentage = 0;
                // Panning not enabled.
                this.cameraInput.panningSensibility = 3;

                var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

                // 1st button down.
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.clientX = 1000;
                event.clientY = 200;
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start moving before 2nd button has been pressed.
                event.type = "pointermove";
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

                // Move X coordinate.
                event.type = "pointermove";
                event.clientX = 1500;
                event.clientY = 200;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Decrease })).to.be.true;

                // 2nd button down. (Enter zoom mode.)
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start move of 2nd pointer.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2000;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

                // Move Y coordinate. 2nd point is the one moving.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2500;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialRadiusOffset: ValChange.Increase })).to.be.true;

                // Move X + Y coordinate. 1st point is the one moving.
                event.type = "pointermove";
                event.clientX = 1700;
                event.clientY = 1700;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialRadiusOffset: ValChange.Decrease })).to.be.true;

                // One of the buttons button up. (Leave zoom mode.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Move X and Y coordinate of remaining pressed point.
                event.type = "pointermove";
                event.clientX = 2000;
                event.clientY = 2700;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialBetaOffset: ValChange.Decrease })).to.be.true;

                // 1st button down again
                event.type = "pointerdown";
                event.pointerType = "touch";
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Start move of 1st button.
                // This time trigger more than 20 pointermove events without moving more
                // than pinchToPanMaxDistance to lock into "pan" mode.
                event.type = "pointermove";
                event.clientX = 1000;
                event.clientY = 1000;
                event.button = -1;
                event.pointerId = 1;

                for (let i = 0; i < 21; i++) {
                    event.clientX++;
                    simulateEvent(this.cameraInput, event);
                    simulateRender(this.cameraInput);
                }
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialPanningX: ValChange.Decrease })).to.be.true;

                // Now we are in "pan" mode, we can move 1st pointer larger distances.
                event.type = "pointermove";
                event.clientX = 5000;
                event.clientY = 5000;
                event.button = -1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, { inertialPanningX: ValChange.Decrease, inertialPanningY: ValChange.Increase })).to.be.true;

                // One of the buttons button up. (Leave pan mode.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 0;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Other button button up. (Now moves should have no affect.)
                event.type = "pointerup";
                event.pointerType = "touch";
                event.button = 1;
                event.pointerId = 2;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);

                // Move X and Y coordinate.
                event.type = "pointermove";
                event.clientX = 3000;
                event.clientY = 4000;
                event.button = -1;
                event.pointerId = 1;
                simulateEvent(this.cameraInput, event);
                simulateRender(this.cameraInput);
                expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;
            });
        });
    });

    describe("loose focus", function () {
        it("cancels drag", function () {
            // Multiple button presses interpreted as "pinch" and "swipe".
            this.cameraInput.multiTouchPanAndZoom = true;
            // Zoom changes are a percentage of current value.
            this.cameraInput.pinchDeltaPercentage = 10;
            // Panning not enabled.
            this.cameraInput.panningSensibility = 0;

            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

            // 1st button down.
            event.type = "pointerdown";
            event.pointerType = "touch";
            event.clientX = 1000;
            event.clientY = 200;
            event.button = 0;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);

            // Start moving before 2nd button has been pressed.
            event.type = "pointermove";
            event.button = -1;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Move X coordinate.
            event.type = "pointermove";
            event.clientX = 1500;
            event.clientY = 200;
            event.button = -1;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Decrease })).to.be.true;

            // Lost focus
            (<any>this.cameraInput)._onLostFocus();

            // Move X + Y coordinate. Should have no affect after loosing focus.
            event.type = "pointermove";
            event.clientX = 1700;
            event.clientY = 1700;
            event.button = -1;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;
        });

        it("cancels double drag", function () {
            // Multiple button presses interpreted as "pinch" and "swipe".
            this.cameraInput.multiTouchPanAndZoom = true;
            // Zoom changes are a percentage of current value.
            this.cameraInput.pinchDeltaPercentage = 10;
            // Panning not enabled.
            this.cameraInput.panningSensibility = 0;

            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);

            // 1st button down.
            event.type = "pointerdown";
            event.pointerType = "touch";
            event.clientX = 1000;
            event.clientY = 200;
            event.button = 0;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);

            // Start moving before 2nd button has been pressed.
            event.type = "pointermove";
            event.button = -1;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Move X coordinate.
            event.type = "pointermove";
            event.clientX = 1500;
            event.clientY = 200;
            event.button = -1;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialAlphaOffset: ValChange.Decrease })).to.be.true;

            // 2nd button down. (Enter zoom mode.)
            event.type = "pointerdown";
            event.pointerType = "touch";
            event.button = 1;
            event.pointerId = 2;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);

            // Start move of 2nd pointer.
            event.type = "pointermove";
            event.clientX = 2000;
            event.clientY = 2000;
            event.button = -1;
            event.pointerId = 2;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;

            // Move Y coordinate. 2nd point is the one moving.
            event.type = "pointermove";
            event.clientX = 2000;
            event.clientY = 2500;
            event.button = -1;
            event.pointerId = 2;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, { inertialRadiusOffset: ValChange.Increase })).to.be.true;

            // Lost focus
            (<any>this.cameraInput)._onLostFocus();

            // Move X + Y coordinate. Should have no affect after loosing focus.
            event.type = "pointermove";
            event.clientX = 1700;
            event.clientY = 1700;
            event.button = -1;
            event.pointerId = 1;
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);
            expect(verifyChanges(this.camera, this.cameraCachePos, {})).to.be.true;
        });
    });

    describe("double click", function () {
        it("doesnt restore save position", function () {
            // Disable restoring position.
            this.camera.useInputToRestoreState = false;

            this.camera.alpha = 10;
            this.camera.beta = 10;
            this.camera.radius = 10;

            this.camera.storeState();

            this.camera.alpha = 20;
            this.camera.beta = 20;
            this.camera.radius = 20;

            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);
            event.type = "POINTERDOUBLETAP";
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);

            expect(this.camera.alpha).to.be.equal(20);
            expect(this.camera.beta).to.be.equal(20);
            expect(this.camera.radius).to.be.equal(20);
        });
        it("restores save position", function () {
            // Enable restoring position.
            this.camera.useInputToRestoreState = true;

            this.camera.alpha = 10;
            this.camera.beta = 10;
            this.camera.radius = 10;

            this.camera.storeState();

            this.camera.alpha = 20;
            this.camera.beta = 20;
            this.camera.radius = 20;

            var event: MockPointerEvent = eventTemplate(<HTMLElement>this._canvas);
            event.type = "POINTERDOUBLETAP";
            simulateEvent(this.cameraInput, event);
            simulateRender(this.cameraInput);

            expect(this.camera.alpha).to.be.equal(10);
            expect(this.camera.beta).to.be.equal(10);
            expect(this.camera.radius).to.be.equal(10);
        });
    });
});
