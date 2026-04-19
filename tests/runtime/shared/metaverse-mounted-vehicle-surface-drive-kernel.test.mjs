import assert from "node:assert/strict";
import test from "node:test";

import {
  canMetaverseMountedOccupancyRouteSurfaceDrive,
  isMetaverseMountedVehicleSurfaceDriveEnabled,
  resolveMetaverseMountedVehicleSurfaceDriveControlIntent,
  shellArcadeGameplayProfile
} from "@webgpu-metaverse/shared";

test("shared mounted routing policy keeps authored vehicle drive eligibility out of client-only heuristics", () => {
  assert.equal(
    canMetaverseMountedOccupancyRouteSurfaceDrive({
      controlRoutingPolicyId: "vehicle-surface-drive",
      occupantRole: "driver"
    }),
    true
  );
  assert.equal(
    canMetaverseMountedOccupancyRouteSurfaceDrive({
      controlRoutingPolicyId: "look-only",
      occupantRole: "driver"
    }),
    false
  );
  assert.equal(
    canMetaverseMountedOccupancyRouteSurfaceDrive({
      controlRoutingPolicyId: "vehicle-surface-drive",
      occupantRole: "passenger"
    }),
    false
  );
});

test("shared mounted vehicle surface-drive kernel enables propulsion only for waterborne drivers", () => {
  assert.equal(
    isMetaverseMountedVehicleSurfaceDriveEnabled({
      occupantRole: "driver",
      waterborne: true
    }),
    true
  );
  assert.equal(
    isMetaverseMountedVehicleSurfaceDriveEnabled({
      occupantRole: "driver",
      waterborne: false
    }),
    false
  );
  assert.equal(
    isMetaverseMountedVehicleSurfaceDriveEnabled({
      occupantRole: "passenger",
      waterborne: true
    }),
    false
  );
});

test("shared mounted vehicle surface-drive kernel routes yaw through the strafe axis and idles unsupported lanes", () => {
  const activeIntent = resolveMetaverseMountedVehicleSurfaceDriveControlIntent({
    boost: true,
    moveAxis: 1,
    occupantRole: "driver",
    strafeAxis: 0.5,
    waterborne: true,
    yawAxis: -0.25
  });
  const idleIntent = resolveMetaverseMountedVehicleSurfaceDriveControlIntent({
    boost: true,
    moveAxis: 1,
    occupantRole: "driver",
    strafeAxis: 1,
    waterborne: false,
    yawAxis: 1
  });

  assert.deepEqual(activeIntent, {
    boost: true,
    moveAxis: 1,
    strafeAxis: 0,
    yawAxis: 0.25
  });
  assert.deepEqual(idleIntent, {
    boost: false,
    moveAxis: 0,
    strafeAxis: 0,
    yawAxis: 0
  });
});

test("shared gameplay profiles carry authoritative vehicle water probe truth", () => {
  assert.equal(
    shellArcadeGameplayProfile.vehicleTraversal.waterContactProbeRadiusMeters,
    1.75
  );
  assert.equal(
    shellArcadeGameplayProfile.vehicleTraversal.waterlineHeightMeters,
    0.12
  );
});
