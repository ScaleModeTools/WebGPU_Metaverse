#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node inspect-weapon-gltf.mjs <weapon.gltf>");
  process.exit(1);
}

const gltf = JSON.parse(fs.readFileSync(file, "utf8"));
const nodes = gltf.nodes ?? [];
const meshes = gltf.meshes ?? [];
const root = nodes[0]?.name ?? path.basename(file, path.extname(file));

function stripRootPrefix(name) {
  const prefix = root.replace(/_root$/, "");
  return name.startsWith(prefix + "_") ? name.slice(prefix.length + 1) : name;
}

function classifyNode(node) {
  if (node.mesh !== undefined) return "mesh";
  if ((node.name ?? "").endsWith("_root")) return "root";
  if (/(socket|marker|anchor)/.test(node.name ?? "")) return "socket_or_marker";
  return "empty";
}

const roleMap = new Map([
  ["forward_marker", "basis.forward"],
  ["up_marker", "basis.up"],
  ["grip_hand_r_socket", "grip.primary.right_hint"],
  ["trigger_marker", "trigger.index"],
  ["support_marker", "grip.secondary.optional"],
  ["support_grip_marker", "grip.secondary.required"],
  ["grip_module_socket", "module.underbarrel_grip"],
  ["front_sight_socket", "sight.front"],
  ["rear_sight_socket", "sight.rear"],
  ["optic_mount_socket", "module.optic"],
  ["muzzle_socket", "projectile.muzzle"],
  ["ads_camera_anchor", "camera.ads_anchor"],
  ["back_socket", "carry.back"],
]);

function matrixTranslation(node) {
  if (Array.isArray(node.matrix)) return [node.matrix[12], node.matrix[13], node.matrix[14]];
  if (Array.isArray(node.translation)) return node.translation;
  return [0, 0, 0];
}

const socketRows = [];
for (const [index, node] of nodes.entries()) {
  const base = stripRootPrefix(node.name ?? "");
  const role = roleMap.get(base);
  if (role) {
    socketRows.push({
      index,
      role,
      nodeName: node.name,
      position: matrixTranslation(node),
    });
  }
}

const attrs = new Set();
for (const mesh of meshes) {
  for (const prim of mesh.primitives ?? []) {
    for (const attr of Object.keys(prim.attributes ?? {})) attrs.add(attr);
  }
}

const warnings = [];
if ((gltf.materials ?? []).length === 0) warnings.push("No materials.");
if (!attrs.has("NORMAL")) warnings.push("No NORMAL attributes.");
if (!attrs.has("TEXCOORD_0")) warnings.push("No TEXCOORD_0 attributes.");
if (nodes.every((n, i) => i === 0 || nodes[0].children?.includes(i))) {
  warnings.push("All nodes appear to be direct root children; parent moving sockets to moving parts when needed.");
}
if (socketRows.length > 0) warnings.push("Socket orientation not validated; production sockets should be full transforms.");

const result = {
  sourceFile: path.basename(file),
  root,
  nodeCount: nodes.length,
  meshCount: meshes.length,
  materialCount: (gltf.materials ?? []).length,
  animationCount: (gltf.animations ?? []).length,
  skinCount: (gltf.skins ?? []).length,
  attributes: [...attrs].sort(),
  sockets: socketRows,
  warnings,
};

console.log(JSON.stringify(result, null, 2));
