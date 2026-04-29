import type { MetaverseFlightInputSnapshot } from "../types/metaverse-control-mode";

interface KeyboardFlightInputState {
  boost: boolean;
  jump: boolean;
  moveBackward: boolean;
  moveForward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  weaponSwitch: boolean;
  weaponSwitchPressedCount: number;
}

interface MouseFlightInputState {
  lookDeltaX: number;
  lookDeltaY: number;
  primaryAction: boolean;
  primaryActionPressedCount: number;
  secondaryAction: boolean;
}

interface GamepadTriggerInputSnapshot {
  readonly primaryAction: boolean;
  readonly secondaryAction: boolean;
  readonly weaponSwitch: boolean;
}

type MouseFlightButtonInputKey = "primaryAction" | "secondaryAction";
type KeyboardFlightButtonInputKey = Exclude<
  keyof KeyboardFlightInputState,
  "weaponSwitchPressedCount"
>;

interface MetaverseFlightInputRuntimeDependencies {
  readonly readWallClockMs?: () => number;
}

const defaultMouseLookSampleDurationSeconds = 1 / 60;
const metaverseMouseLookPixelsPerAxisUnitSecond = 2400;

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function createKeyboardFlightInputState(): KeyboardFlightInputState {
  return {
    boost: false,
    jump: false,
    moveBackward: false,
    moveForward: false,
    strafeLeft: false,
    strafeRight: false,
    weaponSwitch: false,
    weaponSwitchPressedCount: 0
  };
}

function createMouseFlightInputState(): MouseFlightInputState {
  return {
    lookDeltaX: 0,
    lookDeltaY: 0,
    primaryAction: false,
    primaryActionPressedCount: 0,
    secondaryAction: false
  };
}

function isGamepadButtonPressed(button: GamepadButton | null | undefined): boolean {
  if (button === null || button === undefined) {
    return false;
  }

  return button.pressed === true || (button.value ?? 0) >= 0.5;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  const HTMLElementConstructor = globalThis.HTMLElement;

  return (
    typeof HTMLElementConstructor === "function" &&
    target instanceof HTMLElementConstructor &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

function isPointerLockActive(canvas: HTMLCanvasElement): boolean {
  const pointerLockElement = globalThis.document?.pointerLockElement;

  return pointerLockElement === undefined || pointerLockElement === canvas;
}

function requestPointerLockIfAvailable(canvas: HTMLCanvasElement): void {
  const requestPointerLock = canvas.requestPointerLock;

  if (typeof requestPointerLock !== "function") {
    return;
  }

  void Promise.resolve(requestPointerLock.call(canvas)).catch(() => {
    // Pointer lock can be denied when the browser requires a stricter user gesture.
  });
}

export class MetaverseFlightInputRuntime {
  readonly #keyboardInput = createKeyboardFlightInputState();
  readonly #mouseInput = createMouseFlightInputState();
  readonly #readWallClockMs: () => number;

  #canvas: HTMLCanvasElement | null = null;
  #inputCleanup: (() => void) | null = null;
  #lastGamepadPrimaryAction = false;
  #lastGamepadWeaponSwitch = false;
  #lastSnapshotAtMs: number | null = null;

  constructor(dependencies: MetaverseFlightInputRuntimeDependencies = {}) {
    this.#readWallClockMs =
      dependencies.readWallClockMs ??
      (() => globalThis.performance?.now?.() ?? Date.now());
  }

  install(canvas: HTMLCanvasElement): void {
    this.dispose();
    this.#canvas = canvas;

    const keyBindings: Record<string, KeyboardFlightButtonInputKey> = {
      KeyA: "strafeLeft",
      KeyD: "strafeRight",
      KeyS: "moveBackward",
      KeyW: "moveForward",
      Space: "jump",
      ShiftLeft: "boost",
      ShiftRight: "boost",
      Digit1: "weaponSwitch"
    };
    const mouseButtonBindings: Record<number, MouseFlightButtonInputKey> = {
      0: "primaryAction",
      2: "secondaryAction"
    };
    const handleCanvasMouseMove = (event: MouseEvent) => {
      if (!isPointerLockActive(canvas)) {
        return;
      }

      this.#mouseInput.lookDeltaX += toFiniteNumber(event.movementX, 0);
      this.#mouseInput.lookDeltaY += toFiniteNumber(event.movementY, 0);
    };
    const handleCanvasMouseDown = (event: MouseEvent) => {
      requestPointerLockIfAvailable(canvas);
      const inputKey = mouseButtonBindings[event.button];

      if (inputKey === undefined) {
        return;
      }

      event.preventDefault();

      if (inputKey === "primaryAction" && !this.#mouseInput.primaryAction) {
        this.#mouseInput.primaryActionPressedCount += 1;
      }

      this.#mouseInput[inputKey] = true;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) {
        return;
      }

      const inputKey = keyBindings[event.code];

      if (inputKey === undefined) {
        return;
      }

      event.preventDefault();

      if (inputKey === "weaponSwitch" && !this.#keyboardInput.weaponSwitch) {
        this.#keyboardInput.weaponSwitchPressedCount += 1;
      }

      this.#keyboardInput[inputKey] = true;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) {
        return;
      }

      const inputKey = keyBindings[event.code];

      if (inputKey === undefined) {
        return;
      }

      event.preventDefault();
      this.#keyboardInput[inputKey] = false;
    };
    const handleWindowMouseUp = (event: MouseEvent) => {
      const inputKey = mouseButtonBindings[event.button];

      if (inputKey === undefined) {
        return;
      }

      this.#mouseInput[inputKey] = false;
    };
    const handleCanvasContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    const handleWindowBlur = () => {
      this.reset();
    };

    canvas.addEventListener("mousedown", handleCanvasMouseDown);
    canvas.addEventListener("contextmenu", handleCanvasContextMenu);
    canvas.addEventListener("auxclick", handleCanvasContextMenu);
    globalThis.window?.addEventListener("mousemove", handleCanvasMouseMove);
    globalThis.window?.addEventListener("keydown", handleKeyDown);
    globalThis.window?.addEventListener("keyup", handleKeyUp);
    globalThis.window?.addEventListener("mouseup", handleWindowMouseUp);
    globalThis.window?.addEventListener("blur", handleWindowBlur);
    this.#inputCleanup = () => {
      canvas.removeEventListener("mousedown", handleCanvasMouseDown);
      canvas.removeEventListener("contextmenu", handleCanvasContextMenu);
      canvas.removeEventListener("auxclick", handleCanvasContextMenu);
      globalThis.window?.removeEventListener("mousemove", handleCanvasMouseMove);
      globalThis.window?.removeEventListener("keydown", handleKeyDown);
      globalThis.window?.removeEventListener("keyup", handleKeyUp);
      globalThis.window?.removeEventListener("mouseup", handleWindowMouseUp);
      globalThis.window?.removeEventListener("blur", handleWindowBlur);
    };
  }

  dispose(): void {
    this.#inputCleanup?.();
    this.#inputCleanup = null;
    this.#exitPointerLockIfHeld();
    this.#canvas = null;
    this.reset();
  }

  reset(): void {
    Object.assign(this.#keyboardInput, createKeyboardFlightInputState());
    Object.assign(this.#mouseInput, createMouseFlightInputState());
    this.#lastGamepadPrimaryAction = false;
    this.#lastGamepadWeaponSwitch = false;
    this.#lastSnapshotAtMs = null;
  }

  readSnapshot(): MetaverseFlightInputSnapshot {
    const sampleDurationSeconds = this.#resolveLookSampleDurationSeconds();
    const pitchAxis = clamp(
      -this.#mouseInput.lookDeltaY /
        (metaverseMouseLookPixelsPerAxisUnitSecond * sampleDurationSeconds),
      -1,
      1
    );
    const yawAxis = clamp(
      this.#mouseInput.lookDeltaX /
        (metaverseMouseLookPixelsPerAxisUnitSecond * sampleDurationSeconds),
      -1,
      1
    );
    this.#mouseInput.lookDeltaX = 0;
    this.#mouseInput.lookDeltaY = 0;
    const gamepadTriggerInput = this.#readGamepadTriggerInput();
    const primaryActionPressedCount =
      this.#mouseInput.primaryActionPressedCount +
      (gamepadTriggerInput.primaryAction && !this.#lastGamepadPrimaryAction ? 1 : 0);
    const weaponSwitchPressedCount =
      this.#keyboardInput.weaponSwitchPressedCount +
      (gamepadTriggerInput.weaponSwitch && !this.#lastGamepadWeaponSwitch ? 1 : 0);
    this.#mouseInput.primaryActionPressedCount = 0;
    this.#keyboardInput.weaponSwitchPressedCount = 0;
    this.#lastGamepadPrimaryAction = gamepadTriggerInput.primaryAction;
    this.#lastGamepadWeaponSwitch = gamepadTriggerInput.weaponSwitch;

    return Object.freeze({
      boost: this.#keyboardInput.boost,
      jump: this.#keyboardInput.jump,
      moveAxis:
        (this.#keyboardInput.moveForward ? 1 : 0) -
        (this.#keyboardInput.moveBackward ? 1 : 0),
      primaryAction:
        this.#mouseInput.primaryAction || gamepadTriggerInput.primaryAction,
      primaryActionPressedCount,
      pitchAxis,
      secondaryAction:
        this.#mouseInput.secondaryAction || gamepadTriggerInput.secondaryAction,
      strafeAxis:
        (this.#keyboardInput.strafeRight ? 1 : 0) -
        (this.#keyboardInput.strafeLeft ? 1 : 0),
      weaponSwitchPressedCount,
      yawAxis
    });
  }

  #readGamepadTriggerInput(): GamepadTriggerInputSnapshot {
    const getGamepads = globalThis.navigator?.getGamepads;

    if (typeof getGamepads !== "function") {
      return {
        primaryAction: false,
        secondaryAction: false,
        weaponSwitch: false
      };
    }

    const gamepads = getGamepads.call(globalThis.navigator);
    let primaryAction = false;
    let secondaryAction = false;
    let weaponSwitch = false;

    for (let gamepadIndex = 0; gamepadIndex < gamepads.length; gamepadIndex += 1) {
      const gamepad = gamepads[gamepadIndex];

      if (gamepad === null || gamepad === undefined) {
        continue;
      }

      primaryAction ||= isGamepadButtonPressed(gamepad.buttons[7]);
      secondaryAction ||= isGamepadButtonPressed(gamepad.buttons[6]);
      weaponSwitch ||= isGamepadButtonPressed(gamepad.buttons[3]);

      if (primaryAction && secondaryAction && weaponSwitch) {
        break;
      }
    }

    return {
      primaryAction,
      secondaryAction,
      weaponSwitch
    };
  }

  #exitPointerLockIfHeld(): void {
    if (
      this.#canvas !== null &&
      globalThis.document?.pointerLockElement === this.#canvas &&
      typeof globalThis.document.exitPointerLock === "function"
    ) {
      globalThis.document.exitPointerLock();
    }
  }

  #resolveLookSampleDurationSeconds(): number {
    const nowMs = this.#readWallClockMs();

    if (!Number.isFinite(nowMs)) {
      this.#lastSnapshotAtMs = null;
      return defaultMouseLookSampleDurationSeconds;
    }

    const previousSnapshotAtMs = this.#lastSnapshotAtMs;

    this.#lastSnapshotAtMs = nowMs;

    if (previousSnapshotAtMs === null) {
      return defaultMouseLookSampleDurationSeconds;
    }

    const elapsedSeconds = (nowMs - previousSnapshotAtMs) / 1_000;

    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
      return defaultMouseLookSampleDurationSeconds;
    }

    return elapsedSeconds;
  }
}
