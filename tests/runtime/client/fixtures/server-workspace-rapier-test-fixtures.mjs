import { createRequire } from "node:module";

const serverWorkspaceRequire = createRequire(
  new URL("../../../../server/package.json", import.meta.url)
);

export async function createServerWorkspaceRapierPhysicsAddon() {
  const RAPIER = serverWorkspaceRequire("@dimforge/rapier3d-compat");

  await RAPIER.init();

  return Object.freeze({
    RAPIER,
    world: new RAPIER.World(new RAPIER.Vector3(0, -9.81, 0))
  });
}
