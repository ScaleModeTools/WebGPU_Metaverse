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

test("createDeveloperReport stays focused on live runtime summary instead of reconciliation detail", async () => {
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
  const nowMs = 0;
  const dependencies = createFakeHudPublisherDependencies(() => nowMs);
  dependencies.config = metaverseRuntimeConfig;
  const telemetryState = new MetaverseRuntimeHudTelemetryState(dependencies);
  const renderedCamera = createFakeRenderedCamera();

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

  assert.match(report, /^Metaverse developer report/m);
  assert.match(report, /Frame: 4 · 60\.0 fps/);
  assert.match(report, /Draw calls: 7/);
  assert.match(report, /Triangles: 42/);
  assert.match(
    report,
    /Tick \/ poll: 50 ms · 33 ms/
  );
  assert.match(
    report,
    /Snapshot path: reliable snapshot stream · subscribed · 2 buffered · 20\.0 Hz/
  );
  assert.match(report, /Local locomotion routing: grounded · capability maintained/);
  assert.match(report, /Authority \/ ack: n\/a/);
  assert.match(
    report,
    /World latest-wins datagram: WebTransport datagrams active · 3 send failures/
  );

  assert.doesNotMatch(report, /Reconciliation:/);
  assert.doesNotMatch(report, /Jump \/ traversal:/);
  assert.doesNotMatch(report, /Jump gate:/);
  assert.doesNotMatch(report, /Drive target:/);
  assert.doesNotMatch(report, /Body contact:/);
  assert.doesNotMatch(report, /Body interaction:/);
  assert.doesNotMatch(report, /Correction:/);
  assert.doesNotMatch(report, /Episode start:/);
  assert.doesNotMatch(report, /Last correction:/);
  assert.doesNotMatch(report, /Render offset:/);
});
