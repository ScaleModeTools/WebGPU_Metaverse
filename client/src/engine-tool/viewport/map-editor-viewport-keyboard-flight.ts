import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PerspectiveCamera, Vector3 } from "three/webgpu";

const flightForwardVector = new Vector3();
const flightRightVector = new Vector3();
const flightTranslationVector = new Vector3();
const worldUpVector = new Vector3(0, 1, 0);

function isRecognizedFlightKey(code: string): boolean {
  return (
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD" ||
    code === "KeyQ" ||
    code === "KeyE" ||
    code === "ShiftLeft" ||
    code === "ShiftRight"
  );
}

interface MapEditorViewportKeyboardFlightControllerOptions {
  readonly camera: PerspectiveCamera;
  readonly hostElement: HTMLDivElement;
  readonly orbitControls: OrbitControls;
}

export class MapEditorViewportKeyboardFlightController {
  readonly #camera: PerspectiveCamera;
  readonly #hostElement: HTMLDivElement;
  readonly #orbitControls: OrbitControls;
  readonly #pressedKeys = new Set<string>();

  constructor({
    camera,
    hostElement,
    orbitControls
  }: MapEditorViewportKeyboardFlightControllerOptions) {
    this.#camera = camera;
    this.#hostElement = hostElement;
    this.#orbitControls = orbitControls;

    hostElement.addEventListener("blur", this.#handleBlur);
    hostElement.addEventListener("keydown", this.#handleKeyDown);
    hostElement.addEventListener("keyup", this.#handleKeyUp);
  }

  focus(): void {
    this.#hostElement.focus({ preventScroll: true });
  }

  update(deltaSeconds: number): void {
    if (document.activeElement !== this.#hostElement) {
      return;
    }

    if (this.#pressedKeys.size === 0) {
      return;
    }

    flightForwardVector.copy(this.#camera.getWorldDirection(flightForwardVector));
    flightForwardVector.y = 0;

    if (flightForwardVector.lengthSq() === 0) {
      flightForwardVector.set(0, 0, -1);
    } else {
      flightForwardVector.normalize();
    }

    flightRightVector.copy(flightForwardVector).cross(worldUpVector).normalize();
    flightTranslationVector.set(0, 0, 0);

    if (this.#pressedKeys.has("KeyW")) {
      flightTranslationVector.add(flightForwardVector);
    }

    if (this.#pressedKeys.has("KeyS")) {
      flightTranslationVector.sub(flightForwardVector);
    }

    if (this.#pressedKeys.has("KeyD")) {
      flightTranslationVector.add(flightRightVector);
    }

    if (this.#pressedKeys.has("KeyA")) {
      flightTranslationVector.sub(flightRightVector);
    }

    if (this.#pressedKeys.has("KeyE")) {
      flightTranslationVector.y += 1;
    }

    if (this.#pressedKeys.has("KeyQ")) {
      flightTranslationVector.y -= 1;
    }

    if (flightTranslationVector.lengthSq() === 0) {
      return;
    }

    flightTranslationVector.normalize();

    const baseSpeed = Math.max(
      8,
      this.#camera.position.distanceTo(this.#orbitControls.target) * 1.35
    );
    const speedMultiplier =
      this.#pressedKeys.has("ShiftLeft") || this.#pressedKeys.has("ShiftRight")
        ? 2.5
        : 1;
    const travelDistance = baseSpeed * speedMultiplier * deltaSeconds;

    this.#camera.position.addScaledVector(
      flightTranslationVector,
      travelDistance
    );
    this.#orbitControls.target.addScaledVector(
      flightTranslationVector,
      travelDistance
    );
    this.#orbitControls.update();
  }

  dispose(): void {
    this.#pressedKeys.clear();
    this.#hostElement.removeEventListener("blur", this.#handleBlur);
    this.#hostElement.removeEventListener("keydown", this.#handleKeyDown);
    this.#hostElement.removeEventListener("keyup", this.#handleKeyUp);
  }

  readonly #handleBlur = () => {
    this.#pressedKeys.clear();
  };

  readonly #handleKeyDown = (event: KeyboardEvent) => {
    if (!isRecognizedFlightKey(event.code)) {
      return;
    }

    event.preventDefault();
    this.#pressedKeys.add(event.code);
  };

  readonly #handleKeyUp = (event: KeyboardEvent) => {
    if (!isRecognizedFlightKey(event.code)) {
      return;
    }

    event.preventDefault();
    this.#pressedKeys.delete(event.code);
  };
}
