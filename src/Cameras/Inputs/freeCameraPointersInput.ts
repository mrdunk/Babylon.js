import { Observable } from "../../Misc/observable";
import { serialize } from "../../Misc/decorators";
import { Nullable } from "../../types";
import { Matrix, Vector3 } from "../../Maths/math.vector";
import { FreeCamera } from "../../Cameras/freeCamera";
import { CameraInputTypes } from "../../Cameras/cameraInputsManager";
import { BaseCameraPointersInput } from "../../Cameras/Inputs/BaseCameraPointersInput";
import { PointerTouch } from "../../Events/pointerEvents";
import { Coordinate } from "../../Maths/math.axis";

enum _CameraProperty {
    MoveRelative,
    RotateRelative,
    MoveScene
}

enum _PointerInputTypes {
    ButtonDown,
    ButtonUp,
    DoubleTap,
    Touch,
    MultiTouch
}

enum _Modifiers {
    ShiftDown = Math.pow(2, 0),
    ShiftUp = Math.pow(2, 1),
    AltDown = Math.pow(2, 2),
    AltUp = Math.pow(2, 3),
    CtrlDown = Math.pow(2, 4),
    CtrlUp = Math.pow(2, 5),
    MetaDown = Math.pow(2, 6),
    MetaUp = Math.pow(2, 7),
    MouseButton1Down = Math.pow(2, 8),
    MouseButton1Up = Math.pow(2, 9),
    MouseButton2Down = Math.pow(2, 10),
    MouseButton2Up = Math.pow(2, 11),
    MouseButton3Down = Math.pow(2, 12),
    MouseButton3Up = Math.pow(2, 13),
    XAxis = Math.pow(2, 14),
    YAxis = Math.pow(2, 15),
    ZAxis = Math.pow(2, 16)
}

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
enum _MouseButtons {
    Button1 = 1,
    Button2 = 2,
    Button3 = 4
}

/**
 * Manage the pointers inputs to control a free camera.
 * @see https://doc.babylonjs.com/how_to/customizing_camera_inputs
 */
export class FreeCameraPointersInput extends BaseCameraPointersInput {
    /**
     * Instantiates a new FreeCameraPointersInput.
     */
    constructor() {
        super();
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.XAxis | _Modifiers.ShiftUp | _Modifiers.MouseButton2Up,
            _CameraProperty.RotateRelative,
            Coordinate.Y);
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.YAxis | _Modifiers.ShiftUp | _Modifiers.MouseButton2Up,
            _CameraProperty.RotateRelative,
            Coordinate.X);
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.YAxis | _Modifiers.ShiftDown | _Modifiers.MouseButton2Up,
            _CameraProperty.MoveRelative,
            Coordinate.Y);
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.XAxis | _Modifiers.ShiftDown | _Modifiers.MouseButton2Up,
            _CameraProperty.MoveRelative,
            Coordinate.X);
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.YAxis | _Modifiers.MouseButton2Down,
            _CameraProperty.MoveRelative,
            Coordinate.Y);
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.XAxis | _Modifiers.MouseButton2Down,
            _CameraProperty.MoveRelative,
            Coordinate.X);
    }

    /**
     * Defines the camera the input is attached to.
     */
    public camera: FreeCamera;

    /**
     * Gets the class name of the current input.
     * @returns the class name
     */
    public getClassName(): string {
        return "FreeCameraPointersInput";
    }

    /**
     * Defines the pointer angular sensitivity when configured to rotate the
     * camera.
     */
    @serialize()
    public angularSensitivity = new Vector3(0.0005, 0.0005, 0.0005);

    /**
     * Defines the pointer panning sensitivity when configured to pan the
     * camera.
     */
    @serialize()
    public panSensitivity = new Vector3(0.002, -0.002, 0.002);

    /**
     * Observable for when a pointer move event occurs containing the move delta
     */
    public onPointerMovedObservable = new Observable<{ deltaX: number; deltaY: number }>();

    public checkInputs(): void {
        // Call onTouch(), onButtonUp(), etc.
        //super.checkInputs();

        // Convert updates relative to camera to world position update.
        const cameraTransformMatrix = Matrix.Zero();
        this.camera.getViewMatrix().invertToRef(cameraTransformMatrix);

        const transformedDirection = Vector3.Zero();
        Vector3.TransformNormalToRef(
            this._moveRelative.multiplyInPlace(this.panSensitivity),
            cameraTransformMatrix,
            transformedDirection);

        // Apply updates to camera position.
        this.camera.cameraRotation.x += this._rotateRelative.x * this.angularSensitivity.x;
        this.camera.cameraRotation.y += this._rotateRelative.y * this.angularSensitivity.y;
        this.camera.cameraDirection.addInPlace(transformedDirection);
        this.camera.cameraDirection.addInPlace(
            this._moveScene.multiplyInPlace(this.panSensitivity));

        // Clear any offsets we have just applied.
        this._moveRelative.setAll(0);
        this._rotateRelative.setAll(0);
        this._moveScene.setAll(0);
    }

    /**
     * Called on pointer POINTERMOVE event if only a single touch is active.
     */
    protected onTouch(point: Nullable<PointerTouch>, deltaX: number, deltaY: number): void {
        if (! this._pointerToCamera.has(_PointerInputTypes.Touch)) {
            return;
        }
        this._deltaX = deltaX;
        this._deltaY = deltaY;
        const touchInputs = this._pointerToCamera.get(_PointerInputTypes.Touch);
        touchInputs.forEach(this._updateCameraPropertyWrapper.bind(this));
    }

    private _updateCameraPropertyWrapper(
        value: [_CameraProperty, Coordinate], modifiers: number): void {
            if (this._modifiersMatch(modifiers)) {
                if (modifiers & _Modifiers.XAxis) {
                    this._updateCameraProperty(this._deltaX, value[0], value[1]);
                }
                if (modifiers & _Modifiers.YAxis) {
                    this._updateCameraProperty(this._deltaY, value[0], value[1]);
                }
            }
        }

    private _updateCameraProperty(/* Amount to change camera. */
                                  delta: number,
                                  /* Camera property to be changed. */
                                  cameraProperty: Nullable<_CameraProperty>,
                                  /* Axis of Camera property to be changed. */
                                  coordinate: Nullable<Coordinate>): void {
        if (delta === 0) {
            return;
        }
        if (cameraProperty === null || coordinate === null) {
            return;
        }

        let action = null;
        switch (cameraProperty) {
            case _CameraProperty.MoveRelative:
                action = this._moveRelative;
                break;
            case _CameraProperty.RotateRelative:
                action = this._rotateRelative;
                break;
            case _CameraProperty.MoveScene:
                action = this._moveScene;
                break;
        }

        switch (coordinate) {
            case Coordinate.X:
                action.x += delta;
                break;
            case Coordinate.Y:
                action.y += delta;
                break;
            case Coordinate.Z:
                action.z += delta;
                break;
        }
    }

    /**
     * Test whether the specified modifier keys are currently pressed.
     * @returns Boolean: True if all keys match or are not configured.
     */
    private _modifiersMatch(modifiers: number): boolean {
        return(
            ((Boolean(modifiers & _Modifiers.ShiftDown) ==
                Boolean(modifiers & _Modifiers.ShiftUp) ) ||
                Boolean(modifiers & _Modifiers.ShiftDown) == this._shiftKey)
            &&
            ((Boolean(modifiers & _Modifiers.CtrlDown) ==
                Boolean(modifiers & _Modifiers.CtrlUp) ) ||
                Boolean(modifiers & _Modifiers.CtrlDown) == this._ctrlKey)
            &&
            ((Boolean(modifiers & _Modifiers.AltDown) ==
                Boolean(modifiers & _Modifiers.AltUp) ) ||
                Boolean(modifiers & _Modifiers.AltDown) == this._altKey)
            &&
            ((Boolean(modifiers & _Modifiers.MetaDown) ==
                Boolean(modifiers & _Modifiers.MetaUp) ) ||
                Boolean(modifiers & _Modifiers.MetaDown) == this._metaKey)
            &&
            ((Boolean(modifiers & _Modifiers.MouseButton1Down) ==
                Boolean(modifiers & _Modifiers.MouseButton1Up)) ||
                (Boolean(modifiers & _Modifiers.MouseButton1Down) ==
                Boolean(this._buttonsPressed & _MouseButtons.Button1)))
            &&
            ((Boolean(modifiers & _Modifiers.MouseButton2Down) ==
                Boolean(modifiers & _Modifiers.MouseButton2Up)) ||
                (Boolean(modifiers & _Modifiers.MouseButton2Down) ==
                Boolean(this._buttonsPressed & _MouseButtons.Button2)))
            &&
            ((Boolean(modifiers & _Modifiers.MouseButton3Down) ==
                Boolean(modifiers & _Modifiers.MouseButton3Up)) ||
                (Boolean(modifiers & _Modifiers.MouseButton3Down) ==
                Boolean(this._buttonsPressed & _MouseButtons.Button3)))
        );
    }

    private _pointerToCamera = new Map();

    private _moveRelative = Vector3.Zero();
    private _rotateRelative = Vector3.Zero();
    private _moveScene = Vector3.Zero();
    private _deltaX = 0;
    private _deltaY = 0;

    private _mapPointerToCamera(pointerInputType: _PointerInputTypes,
                                pointerModifiers: number,
                                cameraProperty: _CameraProperty,
                                cameraAxis: Coordinate): void {
        let pointerInput;
        if (this._pointerToCamera.has(pointerInputType)) {
            pointerInput = this._pointerToCamera.get(pointerInputType);
        } else {
            pointerInput = new Map();
            this._pointerToCamera.set(pointerInputType, pointerInput);
        }

        pointerInput.set(pointerModifiers, [cameraProperty, cameraAxis]);
    }
}

(<any>CameraInputTypes)["FreeCameraPointersInput"] = FreeCameraPointersInput;
