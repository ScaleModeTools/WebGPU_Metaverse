import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram,
  createMetaverseSyncDriverVehicleControlCommand
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("createMetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransport sends explicit driver-control datagrams", async () => {
  const {
    createMetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransport
  } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const sentDatagrams = [];
  const transport =
    createMetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransport(
      {
        webTransportUrl: "https://example.test/metaverse/world"
      },
      {
        channel: {
          dispose() {},
          async sendDatagram(datagram) {
            sentDatagrams.push(datagram);
          }
        }
      }
    );

  await transport.sendDriverVehicleControlDatagram(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: true,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0.2
      },
      controlSequence: 2,
      playerId
    })
  );

  assert.deepEqual(
    sentDatagrams[0],
    createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram({
      command: createMetaverseSyncDriverVehicleControlCommand({
        controlIntent: {
          boost: true,
          environmentAssetId: "metaverse-hub-skiff-v1",
          moveAxis: 1,
          strafeAxis: 0,
          yawAxis: 0.2
        },
        controlSequence: 2,
        playerId
      })
    })
  );
});

test("createMetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransport disposes the underlying datagram channel", async () => {
  const {
    createMetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransport
  } = await clientLoader.load("/src/network/index.ts");

  let disposed = false;
  const transport =
    createMetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransport(
      {
        webTransportUrl: "https://example.test/metaverse/world"
      },
      {
        channel: {
          dispose() {
            disposed = true;
          },
          async sendDatagram() {}
        }
      }
    );

  transport.dispose();

  assert.equal(disposed, true);
});
