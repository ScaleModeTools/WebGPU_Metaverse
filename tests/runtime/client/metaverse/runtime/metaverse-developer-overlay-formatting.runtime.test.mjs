import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createFakeHudPublisherDependencies,
  createFakeRenderedCamera,
  createPublishInput
} from "./fixtures/metaverse-runtime-hud-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("createDeveloperReport prints the last local-authority convergence context", async () => {
  const [
    { MetaverseRuntimeHudTelemetryState },
    { metaverseRuntimeConfig },
    { createDeveloperReport }
  ] = await Promise.all([
    clientLoader.load(
      "/src/metaverse/hud/debug/metaverse-runtime-hud-telemetry-state.ts"
    ),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load(
      "/src/metaverse/components/developer-overlay/metaverse-developer-overlay-formatting.ts"
    )
  ]);
  let nowMs = 0;
  const dependencies = createFakeHudPublisherDependencies(() => nowMs);
  dependencies.config = metaverseRuntimeConfig;
  const telemetryState = new MetaverseRuntimeHudTelemetryState(dependencies);
  const renderedCamera = createFakeRenderedCamera();

  dependencies.remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot =
    () =>
      Object.freeze({
        groundedBody: Object.freeze({
          contact: Object.freeze({
            appliedMovementDelta: Object.freeze({ x: 0, y: 0, z: 0 }),
            blockedPlanarMovement: true,
            blockedVerticalMovement: false,
            desiredMovementDelta: Object.freeze({ x: 0.2, y: 0, z: -0.4 }),
            supportingContactDetected: false
          }),
          driveTarget: Object.freeze({
            boost: true,
            moveAxis: 1,
            movementMagnitude: 1,
            strafeAxis: 0,
            targetForwardSpeedUnitsPerSecond: 6.6,
            targetPlanarSpeedUnitsPerSecond: 6.6,
            targetStrafeSpeedUnitsPerSecond: 0
          }),
          interaction: Object.freeze({
            applyImpulsesToDynamicBodies: true
          }),
          jumpBody: Object.freeze({
            grounded: false,
            jumpGroundContactGraceSecondsRemaining: 0.1,
            jumpReady: false,
            jumpSnapSuppressionActive: true,
            verticalSpeedUnitsPerSecond: 4.2
          })
        }),
        jumpDebug: Object.freeze({
          pendingActionSequence: 8,
          pendingActionBufferAgeMs: 42,
          resolvedActionSequence: 7,
          resolvedActionState: "accepted",
          surfaceJumpSupported: false,
          supported: false
        }),
        lastProcessedInputSequence: 24,
        locomotionMode: "grounded",
        position: Object.freeze({
          x: 0.8,
          y: 0.6,
          z: -2.8
        }),
        traversalAuthority: Object.freeze({
          currentActionKind: "jump",
          currentActionPhase: "rising",
          currentActionSequence: 7,
          lastConsumedActionSequence: 7,
          lastRejectedActionReason: "none",
          lastRejectedActionSequence: 0,
          phaseStartedAtTick: 16
        }),
        yawRadians: 0
      });
  dependencies.traversalRuntime.surfaceRoutingLocalTelemetrySnapshot =
    Object.freeze({
      autostepHeightMeters: 0.2,
      blockingAffordanceDetected: false,
      decisionReason: "capability-maintained",
      groundedBody: Object.freeze({
        contact: Object.freeze({
          appliedMovementDelta: Object.freeze({ x: 0.1, y: 0, z: -0.2 }),
          blockedPlanarMovement: false,
          blockedVerticalMovement: false,
          desiredMovementDelta: Object.freeze({ x: 0.1, y: 0, z: -0.2 }),
          supportingContactDetected: true
        }),
        driveTarget: Object.freeze({
          boost: true,
          moveAxis: 1,
          movementMagnitude: 1,
          strafeAxis: -0.25,
          targetForwardSpeedUnitsPerSecond: 5.8,
          targetPlanarSpeedUnitsPerSecond: 5.98,
          targetStrafeSpeedUnitsPerSecond: -1.45
        }),
        interaction: Object.freeze({
          applyImpulsesToDynamicBodies: false
        }),
        jumpBody: Object.freeze({
          grounded: false,
          jumpGroundContactGraceSecondsRemaining: 0,
          jumpReady: true,
          jumpSnapSuppressionActive: false,
          verticalSpeedUnitsPerSecond: -0.4
        })
      }),
      jumpDebug: Object.freeze({
        surfaceJumpSupported: false,
        supported: true
      }),
      locomotionMode: "grounded",
      resolvedSupportHeightMeters: 0.6,
      supportingAffordanceSampleCount: 2,
      traversalAuthority: Object.freeze({
        currentActionKind: "none",
        currentActionPhase: "idle",
        currentActionSequence: 0,
        lastConsumedActionSequence: 0,
        lastRejectedActionReason: "none",
        lastRejectedActionSequence: 0,
        phaseStartedAtTick: 0
      })
    });

  dependencies.traversalRuntime.lastLocalAuthorityPoseCorrectionSnapshot =
    Object.freeze({
      authoritative: Object.freeze({
        groundedBody: Object.freeze({
          contact: Object.freeze({
            appliedMovementDelta: Object.freeze({ x: 0, y: 0, z: 0 }),
            blockedPlanarMovement: true,
            blockedVerticalMovement: false,
            desiredMovementDelta: Object.freeze({ x: 0.2, y: 0, z: -0.4 }),
            supportingContactDetected: false
          }),
          driveTarget: Object.freeze({
            boost: false,
            moveAxis: 0,
            movementMagnitude: 0,
            strafeAxis: 0,
            targetForwardSpeedUnitsPerSecond: 0,
            targetPlanarSpeedUnitsPerSecond: 0,
            targetStrafeSpeedUnitsPerSecond: 0
          }),
          interaction: Object.freeze({
            applyImpulsesToDynamicBodies: true
          }),
          jumpBody: Object.freeze({
            grounded: false,
            jumpGroundContactGraceSecondsRemaining: 0,
            jumpReady: false,
            jumpSnapSuppressionActive: false,
            verticalSpeedUnitsPerSecond: 0
          })
        }),
        lastProcessedInputSequence: 24,
        linearVelocity: Object.freeze({
          x: 2.4,
          y: 0,
          z: -0.7
        }),
        locomotionMode: "swim",
        position: Object.freeze({
          x: 1.1,
          y: 0.8,
          z: -4.2
        }),
        surfaceRouting: Object.freeze({
          blockingAffordanceDetected: false,
          decisionReason: "capability-transition-validated",
          resolvedSupportHeightMeters: null,
          supportingAffordanceSampleCount: 0
        })
      }),
      local: Object.freeze({
        groundedBody: Object.freeze({
          contact: Object.freeze({
            appliedMovementDelta: Object.freeze({ x: 0.1, y: 0, z: -0.2 }),
            blockedPlanarMovement: false,
            blockedVerticalMovement: false,
            desiredMovementDelta: Object.freeze({ x: 0.1, y: 0, z: -0.2 }),
            supportingContactDetected: true
          }),
          driveTarget: Object.freeze({
            boost: true,
            moveAxis: 1,
            movementMagnitude: 1,
            strafeAxis: -0.25,
            targetForwardSpeedUnitsPerSecond: 5.8,
            targetPlanarSpeedUnitsPerSecond: 5.98,
            targetStrafeSpeedUnitsPerSecond: -1.45
          }),
          interaction: Object.freeze({
            applyImpulsesToDynamicBodies: false
          }),
          jumpBody: Object.freeze({
            grounded: false,
            jumpGroundContactGraceSecondsRemaining: 0,
            jumpReady: true,
            jumpSnapSuppressionActive: false,
            verticalSpeedUnitsPerSecond: -0.4
          })
        }),
        issuedTraversalIntent: Object.freeze({
          actionIntent: Object.freeze({
            kind: "none",
            pressed: false,
            sequence: 0
          }),
          bodyControl: Object.freeze({
            boost: true,
            moveAxis: 1,
            strafeAxis: -0.25,
            turnAxis: 0.5
          }),
          inputSequence: 25,
          locomotionMode: "swim"
        }),
        linearVelocity: Object.freeze({
          x: 2.2,
          y: 0,
          z: -0.5
        }),
        locomotionMode: "grounded",
        position: Object.freeze({
          x: 0.4,
          y: 1.1,
          z: -3.6
        }),
        surfaceRouting: Object.freeze({
          autostepHeightMeters: 0.2,
          blockingAffordanceDetected: false,
          decisionReason: "capability-maintained",
          groundedBody: Object.freeze({
            contact: Object.freeze({
              appliedMovementDelta: Object.freeze({ x: 0.1, y: 0, z: -0.2 }),
              blockedPlanarMovement: false,
              blockedVerticalMovement: false,
              desiredMovementDelta: Object.freeze({ x: 0.1, y: 0, z: -0.2 }),
              supportingContactDetected: true
            }),
            driveTarget: Object.freeze({
              boost: true,
              moveAxis: 1,
              movementMagnitude: 1,
              strafeAxis: -0.25,
              targetForwardSpeedUnitsPerSecond: 5.8,
              targetPlanarSpeedUnitsPerSecond: 5.98,
              targetStrafeSpeedUnitsPerSecond: -1.45
            }),
            interaction: Object.freeze({
              applyImpulsesToDynamicBodies: false
            }),
            jumpBody: Object.freeze({
              grounded: false,
              jumpGroundContactGraceSecondsRemaining: 0,
              jumpReady: true,
              jumpSnapSuppressionActive: false,
              verticalSpeedUnitsPerSecond: -0.4
            })
          }),
          jumpDebug: Object.freeze({
            surfaceJumpSupported: false,
            supported: true
          }),
          locomotionMode: "grounded",
          resolvedSupportHeightMeters: 0.6,
          supportingAffordanceSampleCount: 2,
          traversalAuthority: Object.freeze({
            currentActionKind: "none",
            currentActionPhase: "idle",
            currentActionSequence: 0,
            lastConsumedActionSequence: 0,
            lastRejectedActionReason: "none",
            lastRejectedActionSequence: 0,
            phaseStartedAtTick: 0
          })
        })
      })
    });

  telemetryState.trackFrame(
    nowMs,
    dependencies.traversalRuntime.cameraSnapshot,
    renderedCamera
  );

  const report = createDeveloperReport(
    Object.freeze({
      boot: Object.freeze({
        phase: "ready"
      }),
      lifecycle: "running",
      presence: Object.freeze({
        remotePlayerCount: 0,
        state: "connected"
      }),
      telemetry: telemetryState.createSnapshot(nowMs, createPublishInput()),
      transport: Object.freeze({
        presenceReliable: Object.freeze({
          activeTransport: "webtransport",
          enabled: true,
          fallbackActive: false,
          webTransportConfigured: true,
          webTransportStatus: "active"
        }),
        worldDriverDatagram: Object.freeze({
          activeTransport: "webtransport-datagram",
          enabled: true,
          state: "active",
          webTransportConfigured: true,
          webTransportStatus: "active"
        }),
        worldReliable: Object.freeze({
          activeTransport: "webtransport",
          enabled: true,
          fallbackActive: false,
          webTransportConfigured: true,
          webTransportStatus: "active"
        }),
        worldSnapshotStream: Object.freeze({
          available: true,
          liveness: "subscribed",
          path: "reliable-snapshot-stream"
        })
      })
    })
  );

  assert.match(
    report,
    /Jump gate: local grounded no · ready yes · surface no · supported yes · vy -0\.40 u\/s -> authority grounded no · ready no · surface no · supported no · vy 4\.20 u\/s/
  );
  assert.match(
    report,
    /Drive target: local boost yes · move 1\.00 · strafe -0\.25 · target 5\.80\/-1\.45 u\/s -> authority boost yes · move 1\.00 · strafe 0\.00 · target 6\.60\/0\.00 u\/s/
  );
  assert.match(
    report,
    /Body contact: local support yes · planar blocked no · vertical blocked no -> authority support no · planar blocked yes · vertical blocked no/
  );
  assert.match(
    report,
    /Body interaction: local dynamic impulses no -> authority dynamic impulses yes/
  );
  assert.match(
    report,
    /Last correction: local grounded @ \(0\.40, 1\.10, -3\.60\) · vel \(2\.20, 0\.00, -0\.50\) · capability maintained · support 0\.60 m · issued 25 · boost yes · move 1\.00 · strafe -0\.25 · turn 0\.50/
  );
  assert.match(
    report,
    /Last correction contact: local support yes · planar blocked no · vertical blocked no -> authority support no · planar blocked yes · vertical blocked no/
  );
  assert.match(
    report,
    /Last correction drive: local boost yes · move 1\.00 · strafe -0\.25 · target 5\.80\/-1\.45 u\/s -> authority boost no · move 0\.00 · strafe 0\.00 · target 0\.00\/0\.00 u\/s/
  );
  assert.match(
    report,
    /Last correction interaction: local dynamic impulses no -> authority dynamic impulses yes/
  );
  assert.match(
    report,
    /authority swim ack 24 @ \(1\.10, 0\.80, -4\.20\) · vel \(2\.40, 0\.00, -0\.70\) · capability transition validated · support n\/a/
  );
});
