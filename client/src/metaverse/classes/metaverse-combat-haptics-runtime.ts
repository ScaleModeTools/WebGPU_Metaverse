interface MetaverseCombatHapticEffectSnapshot {
  readonly durationMs: number;
  readonly strongMagnitude: number;
  readonly vibrationFallbackMs: number;
  readonly weakMagnitude: number;
}

interface GamepadHapticActuatorLike {
  playEffect?(
    effectType: "dual-rumble",
    params: {
      readonly duration: number;
      readonly startDelay: number;
      readonly strongMagnitude: number;
      readonly weakMagnitude: number;
    }
  ): Promise<unknown>;
  pulse?(value: number, duration: number): Promise<unknown>;
}

const metaverseCombatShotHapticEffect = Object.freeze({
  durationMs: 42,
  strongMagnitude: 0.72,
  vibrationFallbackMs: 34,
  weakMagnitude: 0.28
} satisfies MetaverseCombatHapticEffectSnapshot);

const metaverseCombatHitHapticEffect = Object.freeze({
  durationMs: 58,
  strongMagnitude: 0.44,
  vibrationFallbackMs: 48,
  weakMagnitude: 0.62
} satisfies MetaverseCombatHapticEffectSnapshot);

function readConnectedGamepads(): readonly Gamepad[] {
  const getGamepads = globalThis.navigator?.getGamepads;

  if (typeof getGamepads !== "function") {
    return [];
  }

  return getGamepads
    .call(globalThis.navigator)
    .filter((gamepad): gamepad is Gamepad => gamepad !== null);
}

function readGamepadHapticActuator(
  gamepad: Gamepad
): GamepadHapticActuatorLike | null {
  const gamepadWithHaptics = gamepad as unknown as {
    readonly hapticActuators?: readonly GamepadHapticActuatorLike[];
    readonly vibrationActuator?: GamepadHapticActuatorLike;
  };

  return (
    gamepadWithHaptics.vibrationActuator ??
    gamepadWithHaptics.hapticActuators?.[0] ??
    null
  );
}

function triggerActuatorEffect(
  actuator: GamepadHapticActuatorLike,
  effect: MetaverseCombatHapticEffectSnapshot
): boolean {
  if (typeof actuator.playEffect === "function") {
    void actuator
      .playEffect("dual-rumble", {
        duration: effect.durationMs,
        startDelay: 0,
        strongMagnitude: effect.strongMagnitude,
        weakMagnitude: effect.weakMagnitude
      })
      .catch(() => {});
    return true;
  }

  if (typeof actuator.pulse === "function") {
    void actuator
      .pulse(
        Math.max(effect.strongMagnitude, effect.weakMagnitude),
        effect.durationMs
      )
      .catch(() => {});
    return true;
  }

  return false;
}

function triggerNavigatorVibrationFallback(
  effect: MetaverseCombatHapticEffectSnapshot
): void {
  const vibrate = globalThis.navigator?.vibrate;

  if (typeof vibrate !== "function") {
    return;
  }

  vibrate.call(globalThis.navigator, [effect.vibrationFallbackMs]);
}

export class MetaverseCombatHapticsRuntime {
  triggerShot(): void {
    this.#triggerEffect(metaverseCombatShotHapticEffect);
  }

  triggerHit(): void {
    this.#triggerEffect(metaverseCombatHitHapticEffect);
  }

  #triggerEffect(effect: MetaverseCombatHapticEffectSnapshot): void {
    let triggeredGamepad = false;

    for (const gamepad of readConnectedGamepads()) {
      const actuator = readGamepadHapticActuator(gamepad);

      if (actuator === null) {
        continue;
      }

      triggeredGamepad =
        triggerActuatorEffect(actuator, effect) || triggeredGamepad;
    }

    if (!triggeredGamepad) {
      triggerNavigatorVibrationFallback(effect);
    }
  }
}
