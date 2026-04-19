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

test("createDeveloperReport prints the last local-authority snap context", async () => {
  const [
    { MetaverseRuntimeHudTelemetryState },
    { createDeveloperReport }
  ] = await Promise.all([
    clientLoader.load(
      "/src/metaverse/hud/debug/metaverse-runtime-hud-telemetry-state.ts"
    ),
    clientLoader.load(
      "/src/metaverse/components/developer-overlay/metaverse-developer-overlay-formatting.ts"
    )
  ]);
  let nowMs = 0;
  const dependencies = createFakeHudPublisherDependencies(() => nowMs);
  const telemetryState = new MetaverseRuntimeHudTelemetryState(dependencies);
  const renderedCamera = createFakeRenderedCamera();

  dependencies.traversalRuntime.lastLocalAuthorityPoseCorrectionSnapshot =
    Object.freeze({
      authoritative: Object.freeze({
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
          jumpDebug: Object.freeze({
            groundedBodyGrounded: false,
            groundedBodyJumpReady: true,
            surfaceJumpSupported: false,
            supported: true,
            verticalSpeedUnitsPerSecond: -0.4
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
    /Last snap: local grounded @ \(0\.40, 1\.10, -3\.60\) · vel \(2\.20, 0\.00, -0\.50\) · capability maintained · support 0\.60 m · issued 25 · boost yes · move 1\.00 · strafe -0\.25 · turn 0\.50/
  );
  assert.match(
    report,
    /authority swim ack 24 @ \(1\.10, 0\.80, -4\.20\) · vel \(2\.40, 0\.00, -0\.70\) · capability transition validated · support n\/a/
  );
});
