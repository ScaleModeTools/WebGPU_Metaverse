#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping

import numpy as np
import trimesh
from trimesh.transformations import euler_matrix, translation_matrix

ROOT = Path(__file__).resolve().parents[1]
ATTACHMENTS_DIR = ROOT / "client/public/models/metaverse/attachments"
MODULES_DIR = ATTACHMENTS_DIR / "modules"

Color = tuple[int, int, int, int]

STEEL: Color = (134, 142, 150, 255)
DARK_STEEL: Color = (84, 92, 100, 255)
BLACK: Color = (42, 44, 48, 255)
POLYMER: Color = (58, 60, 63, 255)
TAN: Color = (146, 131, 101, 255)
GREEN: Color = (94, 108, 87, 255)
RED: Color = (192, 54, 54, 255)
AMBER: Color = (210, 153, 52, 255)
BLUE: Color = (73, 129, 196, 255)
GLASS: Color = (96, 160, 188, 180)


def _rgba(color: Color) -> np.ndarray:
    return np.array(color, dtype=np.uint8)


def _apply_color(mesh: trimesh.Trimesh, color: Color) -> trimesh.Trimesh:
    mesh.visual.face_colors = np.tile(_rgba(color), (len(mesh.faces), 1))
    return mesh


def _transform_matrix(
    translation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotation_xyz: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> np.ndarray:
    matrix = euler_matrix(*rotation_xyz, axes="sxyz")
    matrix[:3, 3] = np.array(translation, dtype=float)
    return matrix


def _orient_z_to_x() -> np.ndarray:
    return trimesh.geometry.align_vectors([0, 0, 1], [1, 0, 0])


Z_TO_X = _orient_z_to_x()


def _box(extents: tuple[float, float, float], color: Color) -> trimesh.Trimesh:
    return _apply_color(trimesh.creation.box(extents=extents), color)


def _cylinder_x(length: float, radius: float, color: Color, sections: int = 24) -> trimesh.Trimesh:
    mesh = trimesh.creation.cylinder(radius=radius, height=length, sections=sections)
    mesh.apply_transform(Z_TO_X)
    return _apply_color(mesh, color)


def _cone_x(length: float, radius: float, color: Color, sections: int = 24) -> trimesh.Trimesh:
    mesh = trimesh.creation.cone(radius=radius, height=length, sections=sections)
    mesh.apply_transform(Z_TO_X)
    return _apply_color(mesh, color)


def _capsule_x(length: float, radius: float, color: Color, count: tuple[int, int] = (16, 16)) -> trimesh.Trimesh:
    mesh = trimesh.creation.capsule(height=length, radius=radius, count=count)
    mesh.apply_transform(Z_TO_X)
    return _apply_color(mesh, color)


def _annulus_x(inner_radius: float, outer_radius: float, height: float, color: Color, sections: int = 24) -> trimesh.Trimesh:
    mesh = trimesh.creation.annulus(r_min=inner_radius, r_max=outer_radius, height=height, sections=sections)
    mesh.apply_transform(Z_TO_X)
    return _apply_color(mesh, color)


def _icosphere(radius: float, color: Color, subdivisions: int = 2) -> trimesh.Trimesh:
    return _apply_color(trimesh.creation.icosphere(subdivisions=subdivisions, radius=radius), color)


@dataclass(frozen=True)
class MeshPart:
    node_name: str
    mesh: trimesh.Trimesh
    translation: tuple[float, float, float] = (0.0, 0.0, 0.0)
    rotation_xyz: tuple[float, float, float] = (0.0, 0.0, 0.0)


@dataclass(frozen=True)
class MarkerNode:
    name: str
    translation: tuple[float, float, float]
    rotation_xyz: tuple[float, float, float] = (0.0, 0.0, 0.0)


@dataclass(frozen=True)
class WeaponSpec:
    output_name: str
    root_name: str
    parts: tuple[MeshPart, ...]
    markers: tuple[MarkerNode, ...]
    required_nodes: tuple[str, ...]


@dataclass(frozen=True)
class ModuleSpec:
    output_name: str
    root_name: str
    parts: tuple[MeshPart, ...]


FORWARD_UP_MARKERS = (
    MarkerNode("forward_marker", (1.0, 0.0, 0.0)),
    MarkerNode("up_marker", (0.0, 1.0, 0.0)),
)


def _scene_from_parts(parts: Iterable[MeshPart], markers: Iterable[MarkerNode]) -> trimesh.Scene:
    scene = trimesh.Scene()
    for marker in markers:
        scene.graph.update(
            frame_from="world",
            frame_to=marker.name,
            matrix=_transform_matrix(marker.translation, marker.rotation_xyz),
        )
    for part in parts:
        scene.add_geometry(
            geometry=part.mesh,
            node_name=part.node_name,
            geom_name=f"{part.node_name}_geom",
            transform=_transform_matrix(part.translation, part.rotation_xyz),
        )
    return scene


def _write_embedded_gltf(scene: trimesh.Scene, destination: Path, root_name: str) -> None:
    exported = scene.export(file_type="gltf")
    gltf = json.loads(exported["model.gltf"].decode("utf-8"))

    if gltf.get("nodes"):
        gltf["nodes"][0]["name"] = root_name

    for buffer in gltf.get("buffers", []):
        uri = buffer.get("uri")
        if not uri:
            continue
        content = exported[uri]
        buffer["uri"] = (
            "data:application/octet-stream;base64,"
            + base64.b64encode(content).decode("ascii")
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(gltf, separators=(",", ":")), encoding="utf-8")


def _validate_gltf(path: Path, required_nodes: Iterable[str]) -> None:
    loaded = trimesh.load(path, force="scene")
    node_names = set(loaded.graph.nodes)
    missing = [name for name in required_nodes if name not in node_names]
    if missing:
        raise ValueError(f"{path.name} is missing required nodes: {missing}")


# --- weapon specifications -------------------------------------------------


def create_weapon_specs() -> list[WeaponSpec]:
    specs: list[WeaponSpec] = []

    specs.append(
        WeaponSpec(
            output_name="metaverse-service-pistol-v2.gltf",
            root_name="metaverse_service_pistol_root",
            parts=(
                MeshPart("metaverse_service_pistol_slide", _box((0.20, 0.03, 0.035), STEEL), (0.17, 0.045, 0.0)),
                MeshPart("metaverse_service_pistol_barrel", _cylinder_x(0.08, 0.0095, DARK_STEEL), (0.275, 0.03, 0.0)),
                MeshPart("metaverse_service_pistol_frame", _box((0.18, 0.04, 0.03), BLACK), (0.11, -0.003, 0.0)),
                MeshPart("metaverse_service_pistol_grip", _box((0.05, 0.11, 0.028), POLYMER), (0.04, -0.085, 0.0), (0.0, 0.0, 0.18)),
                MeshPart("metaverse_service_pistol_trigger_guard", _box((0.06, 0.028, 0.008), DARK_STEEL), (0.082, -0.055, 0.0)),
                MeshPart("metaverse_service_pistol_mag_floorplate", _box((0.038, 0.008, 0.026), BLACK), (0.018, -0.137, 0.0)),
            ),
            markers=tuple(
                [
                    MarkerNode("metaverse_service_pistol_forward_marker", (1.0, 0.0, 0.0)),
                    MarkerNode("metaverse_service_pistol_up_marker", (0.0, 1.0, 0.0)),
                    MarkerNode("metaverse_service_pistol_grip_hand_r_socket", (0.052, -0.055, 0.0)),
                    MarkerNode("metaverse_service_pistol_trigger_marker", (0.088, -0.032, 0.0)),
                    MarkerNode("metaverse_service_pistol_support_grip_marker", (0.04, -0.01, 0.025)),
                    MarkerNode("metaverse_service_pistol_front_sight_socket", (0.286, 0.064, 0.0)),
                    MarkerNode("metaverse_service_pistol_rear_sight_socket", (0.082, 0.061, 0.0)),
                    MarkerNode("metaverse_service_pistol_optic_mount_socket", (0.145, 0.061, 0.0)),
                    MarkerNode("metaverse_service_pistol_muzzle_socket", (0.312, 0.03, 0.0)),
                    MarkerNode("metaverse_service_pistol_ads_camera_anchor", (0.016, 0.059, 0.0)),
                    MarkerNode("metaverse_service_pistol_back_socket", (0.072, 0.012, 0.0)),
                ]
            ),
            required_nodes=(
                "metaverse_service_pistol_root",
                "metaverse_service_pistol_forward_marker",
                "metaverse_service_pistol_up_marker",
                "metaverse_service_pistol_grip_hand_r_socket",
                "metaverse_service_pistol_trigger_marker",
                "metaverse_service_pistol_support_grip_marker",
                "metaverse_service_pistol_front_sight_socket",
                "metaverse_service_pistol_rear_sight_socket",
                "metaverse_service_pistol_optic_mount_socket",
                "metaverse_service_pistol_muzzle_socket",
                "metaverse_service_pistol_ads_camera_anchor",
                "metaverse_service_pistol_back_socket",
            ),
        )
    )

    specs.append(
        WeaponSpec(
            output_name="metaverse-compact-smg.gltf",
            root_name="metaverse_compact_smg_root",
            parts=(
                MeshPart("metaverse_compact_smg_receiver", _box((0.34, 0.08, 0.05), BLACK), (0.14, 0.05, 0.0)),
                MeshPart("metaverse_compact_smg_barrel", _cylinder_x(0.22, 0.012, DARK_STEEL), (0.39, 0.045, 0.0)),
                MeshPart("metaverse_compact_smg_stock", _box((0.18, 0.06, 0.03), POLYMER), (-0.14, 0.055, 0.0)),
                MeshPart("metaverse_compact_smg_handguard", _box((0.18, 0.05, 0.045), DARK_STEEL), (0.27, 0.01, 0.0)),
                MeshPart("metaverse_compact_smg_grip", _box((0.055, 0.13, 0.035), POLYMER), (0.045, -0.05, 0.0), (0.0, 0.0, 0.15)),
                MeshPart("metaverse_compact_smg_magazine", _box((0.05, 0.12, 0.03), STEEL), (0.12, -0.07, 0.0)),
            ),
            markers=(
                MarkerNode("metaverse_compact_smg_forward_marker", (1.0, 0.0, 0.0)),
                MarkerNode("metaverse_compact_smg_up_marker", (0.0, 1.0, 0.0)),
                MarkerNode("metaverse_compact_smg_grip_hand_r_socket", (0.045, -0.018, 0.0)),
                MarkerNode("metaverse_compact_smg_trigger_marker", (0.115, 0.0, 0.0)),
                MarkerNode("metaverse_compact_smg_support_grip_marker", (0.23, -0.025, 0.03)),
                MarkerNode("metaverse_compact_smg_grip_module_socket", (0.22, -0.04, 0.0)),
                MarkerNode("metaverse_compact_smg_front_sight_socket", (0.47, 0.085, 0.0)),
                MarkerNode("metaverse_compact_smg_rear_sight_socket", (0.18, 0.085, 0.0)),
                MarkerNode("metaverse_compact_smg_optic_mount_socket", (0.22, 0.085, 0.0)),
                MarkerNode("metaverse_compact_smg_muzzle_socket", (0.50, 0.045, 0.0)),
                MarkerNode("metaverse_compact_smg_ads_camera_anchor", (0.08, 0.082, 0.0)),
                MarkerNode("metaverse_compact_smg_back_socket", (0.02, 0.05, 0.0)),
            ),
            required_nodes=(
                "metaverse_compact_smg_root",
                "metaverse_compact_smg_forward_marker",
                "metaverse_compact_smg_up_marker",
                "metaverse_compact_smg_grip_hand_r_socket",
                "metaverse_compact_smg_trigger_marker",
                "metaverse_compact_smg_support_grip_marker",
                "metaverse_compact_smg_grip_module_socket",
                "metaverse_compact_smg_front_sight_socket",
                "metaverse_compact_smg_rear_sight_socket",
                "metaverse_compact_smg_optic_mount_socket",
                "metaverse_compact_smg_muzzle_socket",
                "metaverse_compact_smg_ads_camera_anchor",
                "metaverse_compact_smg_back_socket",
            ),
        )
    )

    specs.append(
        WeaponSpec(
            output_name="metaverse-battle-rifle.gltf",
            root_name="metaverse_battle_rifle_root",
            parts=(
                MeshPart("metaverse_battle_rifle_receiver", _box((0.38, 0.085, 0.055), TAN), (0.16, 0.06, 0.0)),
                MeshPart("metaverse_battle_rifle_handguard", _box((0.24, 0.06, 0.045), GREEN), (0.43, 0.04, 0.0)),
                MeshPart("metaverse_battle_rifle_barrel", _cylinder_x(0.26, 0.0115, DARK_STEEL), (0.67, 0.05, 0.0)),
                MeshPart("metaverse_battle_rifle_stock", _box((0.24, 0.08, 0.035), POLYMER), (-0.15, 0.05, 0.0)),
                MeshPart("metaverse_battle_rifle_grip", _box((0.055, 0.13, 0.035), POLYMER), (0.08, -0.055, 0.0), (0.0, 0.0, 0.18)),
                MeshPart("metaverse_battle_rifle_magazine", _box((0.06, 0.16, 0.04), BLACK), (0.19, -0.08, 0.0)),
                MeshPart("metaverse_battle_rifle_top_rail", _box((0.22, 0.022, 0.045), DARK_STEEL), (0.24, 0.118, 0.0)),
            ),
            markers=(
                MarkerNode("metaverse_battle_rifle_forward_marker", (1.0, 0.0, 0.0)),
                MarkerNode("metaverse_battle_rifle_up_marker", (0.0, 1.0, 0.0)),
                MarkerNode("metaverse_battle_rifle_grip_hand_r_socket", (0.08, -0.02, 0.0)),
                MarkerNode("metaverse_battle_rifle_trigger_marker", (0.16, 0.0, 0.0)),
                MarkerNode("metaverse_battle_rifle_support_grip_marker", (0.31, -0.022, 0.028)),
                MarkerNode("metaverse_battle_rifle_grip_module_socket", (0.32, -0.04, 0.0)),
                MarkerNode("metaverse_battle_rifle_front_sight_socket", (0.79, 0.096, 0.0)),
                MarkerNode("metaverse_battle_rifle_rear_sight_socket", (0.18, 0.116, 0.0)),
                MarkerNode("metaverse_battle_rifle_optic_mount_socket", (0.33, 0.116, 0.0)),
                MarkerNode("metaverse_battle_rifle_muzzle_socket", (0.82, 0.05, 0.0)),
                MarkerNode("metaverse_battle_rifle_ads_camera_anchor", (0.03, 0.11, 0.0)),
                MarkerNode("metaverse_battle_rifle_back_socket", (0.12, 0.04, 0.0)),
            ),
            required_nodes=(
                "metaverse_battle_rifle_root",
                "metaverse_battle_rifle_forward_marker",
                "metaverse_battle_rifle_up_marker",
                "metaverse_battle_rifle_grip_hand_r_socket",
                "metaverse_battle_rifle_trigger_marker",
                "metaverse_battle_rifle_support_grip_marker",
                "metaverse_battle_rifle_grip_module_socket",
                "metaverse_battle_rifle_front_sight_socket",
                "metaverse_battle_rifle_rear_sight_socket",
                "metaverse_battle_rifle_optic_mount_socket",
                "metaverse_battle_rifle_muzzle_socket",
                "metaverse_battle_rifle_ads_camera_anchor",
                "metaverse_battle_rifle_back_socket",
            ),
        )
    )

    specs.append(
        WeaponSpec(
            output_name="metaverse-breacher-shotgun.gltf",
            root_name="metaverse_breacher_shotgun_root",
            parts=(
                MeshPart("metaverse_breacher_shotgun_receiver", _box((0.28, 0.09, 0.055), TAN), (0.12, 0.05, 0.0)),
                MeshPart("metaverse_breacher_shotgun_barrel", _cylinder_x(0.58, 0.0105, DARK_STEEL), (0.58, 0.06, 0.0)),
                MeshPart("metaverse_breacher_shotgun_tube", _cylinder_x(0.45, 0.009, STEEL), (0.48, 0.03, 0.0)),
                MeshPart("metaverse_breacher_shotgun_pump", _box((0.14, 0.06, 0.05), GREEN), (0.31, 0.01, 0.0)),
                MeshPart("metaverse_breacher_shotgun_stock", _box((0.28, 0.10, 0.04), POLYMER), (-0.18, 0.05, 0.0)),
                MeshPart("metaverse_breacher_shotgun_grip", _box((0.055, 0.13, 0.035), POLYMER), (0.02, -0.055, 0.0), (0.0, 0.0, 0.18)),
            ),
            markers=(
                MarkerNode("metaverse_breacher_shotgun_forward_marker", (1.0, 0.0, 0.0)),
                MarkerNode("metaverse_breacher_shotgun_up_marker", (0.0, 1.0, 0.0)),
                MarkerNode("metaverse_breacher_shotgun_grip_hand_r_socket", (0.03, -0.02, 0.0)),
                MarkerNode("metaverse_breacher_shotgun_trigger_marker", (0.10, 0.0, 0.0)),
                MarkerNode("metaverse_breacher_shotgun_support_grip_marker", (0.29, -0.03, 0.03)),
                MarkerNode("metaverse_breacher_shotgun_grip_module_socket", (0.31, -0.05, 0.0)),
                MarkerNode("metaverse_breacher_shotgun_front_sight_socket", (0.84, 0.085, 0.0)),
                MarkerNode("metaverse_breacher_shotgun_rear_sight_socket", (0.12, 0.105, 0.0)),
                MarkerNode("metaverse_breacher_shotgun_optic_mount_socket", (0.20, 0.105, 0.0)),
                MarkerNode("metaverse_breacher_shotgun_muzzle_socket", (0.88, 0.06, 0.0)),
                MarkerNode("metaverse_breacher_shotgun_ads_camera_anchor", (-0.02, 0.10, 0.0)),
                MarkerNode("metaverse_breacher_shotgun_back_socket", (0.10, 0.05, 0.0)),
            ),
            required_nodes=(
                "metaverse_breacher_shotgun_root",
                "metaverse_breacher_shotgun_forward_marker",
                "metaverse_breacher_shotgun_up_marker",
                "metaverse_breacher_shotgun_grip_hand_r_socket",
                "metaverse_breacher_shotgun_trigger_marker",
                "metaverse_breacher_shotgun_support_grip_marker",
                "metaverse_breacher_shotgun_grip_module_socket",
                "metaverse_breacher_shotgun_front_sight_socket",
                "metaverse_breacher_shotgun_rear_sight_socket",
                "metaverse_breacher_shotgun_optic_mount_socket",
                "metaverse_breacher_shotgun_muzzle_socket",
                "metaverse_breacher_shotgun_ads_camera_anchor",
                "metaverse_breacher_shotgun_back_socket",
            ),
        )
    )

    specs.append(
        WeaponSpec(
            output_name="metaverse-longshot-sniper.gltf",
            root_name="metaverse_longshot_sniper_root",
            parts=(
                MeshPart("metaverse_longshot_sniper_receiver", _box((0.34, 0.09, 0.06), GREEN), (0.14, 0.05, 0.0)),
                MeshPart("metaverse_longshot_sniper_barrel", _cylinder_x(0.72, 0.011, DARK_STEEL), (0.68, 0.06, 0.0)),
                MeshPart("metaverse_longshot_sniper_handguard", _box((0.24, 0.05, 0.045), TAN), (0.42, 0.02, 0.0)),
                MeshPart("metaverse_longshot_sniper_stock", _box((0.30, 0.10, 0.04), POLYMER), (-0.22, 0.05, 0.0)),
                MeshPart("metaverse_longshot_sniper_grip", _box((0.055, 0.13, 0.035), POLYMER), (0.03, -0.055, 0.0), (0.0, 0.0, 0.18)),
                MeshPart("metaverse_longshot_sniper_magazine", _box((0.05, 0.14, 0.035), BLACK), (0.12, -0.08, 0.0)),
                MeshPart("metaverse_longshot_sniper_scope_body", _cylinder_x(0.26, 0.028, BLUE), (0.28, 0.13, 0.0)),
                MeshPart("metaverse_longshot_sniper_scope_mount_front", _box((0.03, 0.05, 0.03), DARK_STEEL), (0.20, 0.095, 0.0)),
                MeshPart("metaverse_longshot_sniper_scope_mount_rear", _box((0.03, 0.05, 0.03), DARK_STEEL), (0.36, 0.095, 0.0)),
            ),
            markers=(
                MarkerNode("metaverse_longshot_sniper_forward_marker", (1.0, 0.0, 0.0)),
                MarkerNode("metaverse_longshot_sniper_up_marker", (0.0, 1.0, 0.0)),
                MarkerNode("metaverse_longshot_sniper_grip_hand_r_socket", (0.03, -0.02, 0.0)),
                MarkerNode("metaverse_longshot_sniper_trigger_marker", (0.11, 0.0, 0.0)),
                MarkerNode("metaverse_longshot_sniper_support_grip_marker", (0.39, -0.03, 0.035)),
                MarkerNode("metaverse_longshot_sniper_grip_module_socket", (0.40, -0.05, 0.0)),
                MarkerNode("metaverse_longshot_sniper_front_sight_socket", (0.99, 0.10, 0.0)),
                MarkerNode("metaverse_longshot_sniper_rear_sight_socket", (0.12, 0.11, 0.0)),
                MarkerNode("metaverse_longshot_sniper_optic_mount_socket", (0.28, 0.12, 0.0)),
                MarkerNode("metaverse_longshot_sniper_muzzle_socket", (1.04, 0.06, 0.0)),
                MarkerNode("metaverse_longshot_sniper_ads_camera_anchor", (0.06, 0.13, 0.0)),
                MarkerNode("metaverse_longshot_sniper_back_socket", (0.12, 0.04, 0.0)),
            ),
            required_nodes=(
                "metaverse_longshot_sniper_root",
                "metaverse_longshot_sniper_forward_marker",
                "metaverse_longshot_sniper_up_marker",
                "metaverse_longshot_sniper_grip_hand_r_socket",
                "metaverse_longshot_sniper_trigger_marker",
                "metaverse_longshot_sniper_support_grip_marker",
                "metaverse_longshot_sniper_grip_module_socket",
                "metaverse_longshot_sniper_front_sight_socket",
                "metaverse_longshot_sniper_rear_sight_socket",
                "metaverse_longshot_sniper_optic_mount_socket",
                "metaverse_longshot_sniper_muzzle_socket",
                "metaverse_longshot_sniper_ads_camera_anchor",
                "metaverse_longshot_sniper_back_socket",
            ),
        )
    )

    specs.append(
        WeaponSpec(
            output_name="metaverse-rocket-launcher.gltf",
            root_name="metaverse_rocket_launcher_root",
            parts=(
                MeshPart("metaverse_rocket_launcher_tube", _cylinder_x(1.0, 0.055, GREEN), (0.45, 0.08, 0.0)),
                MeshPart("metaverse_rocket_launcher_rear_housing", _box((0.25, 0.16, 0.12), POLYMER), (-0.05, 0.08, 0.0)),
                MeshPart("metaverse_rocket_launcher_front_shroud", _box((0.18, 0.14, 0.14), TAN), (0.92, 0.08, 0.0)),
                MeshPart("metaverse_rocket_launcher_primary_grip", _box((0.06, 0.16, 0.04), BLACK), (0.18, -0.05, 0.0), (0.0, 0.0, 0.10)),
                MeshPart("metaverse_rocket_launcher_support_handle", _box((0.08, 0.12, 0.05), BLACK), (0.36, -0.02, 0.0)),
                MeshPart("metaverse_rocket_launcher_optic_body", _box((0.20, 0.08, 0.06), DARK_STEEL), (0.25, 0.18, 0.0)),
            ),
            markers=(
                MarkerNode("metaverse_rocket_launcher_forward_marker", (1.0, 0.0, 0.0)),
                MarkerNode("metaverse_rocket_launcher_up_marker", (0.0, 1.0, 0.0)),
                MarkerNode("metaverse_rocket_launcher_grip_hand_r_socket", (0.18, -0.01, 0.0)),
                MarkerNode("metaverse_rocket_launcher_trigger_marker", (0.24, 0.02, 0.0)),
                MarkerNode("metaverse_rocket_launcher_support_grip_marker", (0.41, -0.04, 0.035)),
                MarkerNode("metaverse_rocket_launcher_grip_module_socket", (0.41, -0.065, 0.0)),
                MarkerNode("metaverse_rocket_launcher_front_sight_socket", (0.88, 0.17, 0.0)),
                MarkerNode("metaverse_rocket_launcher_rear_sight_socket", (0.18, 0.17, 0.0)),
                MarkerNode("metaverse_rocket_launcher_optic_mount_socket", (0.26, 0.20, 0.0)),
                MarkerNode("metaverse_rocket_launcher_muzzle_socket", (1.01, 0.08, 0.0)),
                MarkerNode("metaverse_rocket_launcher_ads_camera_anchor", (0.02, 0.19, 0.0)),
                MarkerNode("metaverse_rocket_launcher_back_socket", (0.18, 0.08, 0.0)),
            ),
            required_nodes=(
                "metaverse_rocket_launcher_root",
                "metaverse_rocket_launcher_forward_marker",
                "metaverse_rocket_launcher_up_marker",
                "metaverse_rocket_launcher_grip_hand_r_socket",
                "metaverse_rocket_launcher_trigger_marker",
                "metaverse_rocket_launcher_support_grip_marker",
                "metaverse_rocket_launcher_grip_module_socket",
                "metaverse_rocket_launcher_front_sight_socket",
                "metaverse_rocket_launcher_rear_sight_socket",
                "metaverse_rocket_launcher_optic_mount_socket",
                "metaverse_rocket_launcher_muzzle_socket",
                "metaverse_rocket_launcher_ads_camera_anchor",
                "metaverse_rocket_launcher_back_socket",
            ),
        )
    )

    return specs


# --- module specifications -------------------------------------------------


def create_module_specs() -> list[ModuleSpec]:
    specs: list[ModuleSpec] = []

    def module(name: str, parts: tuple[MeshPart, ...]) -> None:
        root = name.replace("-", "_").replace(".gltf", "") + "_root"
        specs.append(ModuleSpec(output_name=name, root_name=root, parts=parts))

    module(
        "metaverse-vertical-foregrip.gltf",
        (
            MeshPart("metaverse_vertical_foregrip_base", _box((0.04, 0.016, 0.028), DARK_STEEL), (0.02, -0.006, 0.0)),
            MeshPart("metaverse_vertical_foregrip_handle", _box((0.03, 0.09, 0.024), POLYMER), (0.02, -0.058, 0.0)),
        ),
    )

    module(
        "metaverse-angled-foregrip.gltf",
        (
            MeshPart("metaverse_angled_foregrip_base", _box((0.045, 0.014, 0.028), DARK_STEEL), (0.02, -0.004, 0.0)),
            MeshPart("metaverse_angled_foregrip_handle", _box((0.05, 0.06, 0.024), POLYMER), (0.03, -0.04, 0.0), (0.0, 0.0, -0.65)),
        ),
    )

    module(
        "metaverse-barricade-handstop.gltf",
        (
            MeshPart("metaverse_barricade_handstop_base", _box((0.04, 0.012, 0.025), DARK_STEEL), (0.02, -0.004, 0.0)),
            MeshPart("metaverse_barricade_handstop_stop", _box((0.02, 0.03, 0.022), POLYMER), (0.012, -0.02, 0.0), (0.0, 0.0, 0.35)),
        ),
    )

    module(
        "metaverse-heavy-stability-grip.gltf",
        (
            MeshPart("metaverse_heavy_stability_grip_base", _box((0.05, 0.018, 0.035), DARK_STEEL), (0.025, -0.007, 0.0)),
            MeshPart("metaverse_heavy_stability_grip_handle", _box((0.04, 0.10, 0.03), POLYMER), (0.025, -0.063, 0.0)),
        ),
    )

    module(
        "metaverse-low-profile-front-sight.gltf",
        (
            MeshPart("metaverse_low_profile_front_sight_base", _box((0.022, 0.01, 0.02), DARK_STEEL), (0.0, 0.005, 0.0)),
            MeshPart("metaverse_low_profile_front_sight_post", _box((0.008, 0.028, 0.006), STEEL), (0.0, 0.024, 0.0)),
        ),
    )

    module(
        "metaverse-fiber-front-sight.gltf",
        (
            MeshPart("metaverse_fiber_front_sight_base", _box((0.022, 0.01, 0.02), DARK_STEEL), (0.0, 0.005, 0.0)),
            MeshPart("metaverse_fiber_front_sight_post", _box((0.008, 0.024, 0.006), STEEL), (0.0, 0.022, 0.0)),
            MeshPart("metaverse_fiber_front_sight_bead", _icosphere(0.005, AMBER), (0.0, 0.038, 0.0)),
        ),
    )

    module(
        "metaverse-notch-rear-sight.gltf",
        (
            MeshPart("metaverse_notch_rear_sight_base", _box((0.03, 0.012, 0.026), DARK_STEEL), (0.0, 0.006, 0.0)),
            MeshPart("metaverse_notch_rear_sight_ears", _box((0.028, 0.018, 0.022), STEEL), (0.0, 0.020, 0.0)),
        ),
    )

    module(
        "metaverse-ghost-ring-rear-sight.gltf",
        (
            MeshPart("metaverse_ghost_ring_rear_sight_base", _box((0.03, 0.012, 0.026), DARK_STEEL), (0.0, 0.006, 0.0)),
            MeshPart("metaverse_ghost_ring_rear_sight_ring", _annulus_x(0.007, 0.011, 0.003, STEEL), (0.0, 0.03, 0.0)),
        ),
    )

    module(
        "metaverse-micro-red-dot.gltf",
        (
            MeshPart("metaverse_micro_red_dot_base", _box((0.05, 0.014, 0.03), DARK_STEEL), (0.0, 0.007, 0.0)),
            MeshPart("metaverse_micro_red_dot_body", _box((0.045, 0.03, 0.028), BLACK), (0.005, 0.028, 0.0)),
            MeshPart("metaverse_micro_red_dot_lens", _box((0.003, 0.018, 0.022), GLASS), (0.026, 0.03, 0.0)),
        ),
    )

    module(
        "metaverse-2x-combat-optic.gltf",
        (
            MeshPart("metaverse_2x_combat_optic_base", _box((0.10, 0.016, 0.03), DARK_STEEL), (0.0, 0.008, 0.0)),
            MeshPart("metaverse_2x_combat_optic_body", _cylinder_x(0.11, 0.018, BLACK), (0.015, 0.04, 0.0)),
            MeshPart("metaverse_2x_combat_optic_cap", _box((0.02, 0.03, 0.03), POLYMER), (-0.03, 0.04, 0.0)),
        ),
    )

    module(
        "metaverse-4x-scope.gltf",
        (
            MeshPart("metaverse_4x_scope_base", _box((0.11, 0.018, 0.03), DARK_STEEL), (0.0, 0.009, 0.0)),
            MeshPart("metaverse_4x_scope_body", _cylinder_x(0.16, 0.020, BLACK), (0.01, 0.048, 0.0)),
            MeshPart("metaverse_4x_scope_turret", _cylinder_x(0.015, 0.011, STEEL), (0.01, 0.07, 0.0), (0.0, 0.0, math.pi / 2)),
        ),
    )

    module(
        "metaverse-6x-variable-scope.gltf",
        (
            MeshPart("metaverse_6x_variable_scope_base", _box((0.12, 0.018, 0.032), DARK_STEEL), (0.0, 0.009, 0.0)),
            MeshPart("metaverse_6x_variable_scope_body", _cylinder_x(0.20, 0.022, BLACK), (0.02, 0.05, 0.0)),
            MeshPart("metaverse_6x_variable_scope_turret", _cylinder_x(0.018, 0.012, STEEL), (0.02, 0.073, 0.0), (0.0, 0.0, math.pi / 2)),
            MeshPart("metaverse_6x_variable_scope_eyepiece", _capsule_x(0.03, 0.016, BLUE), (-0.08, 0.05, 0.0)),
        ),
    )

    module(
        "metaverse-smart-link-launcher-optic.gltf",
        (
            MeshPart("metaverse_smart_link_launcher_optic_base", _box((0.14, 0.022, 0.04), DARK_STEEL), (0.0, 0.011, 0.0)),
            MeshPart("metaverse_smart_link_launcher_optic_body", _box((0.12, 0.05, 0.05), BLACK), (0.01, 0.048, 0.0)),
            MeshPart("metaverse_smart_link_launcher_optic_lens", _box((0.004, 0.03, 0.03), GLASS), (0.06, 0.05, 0.0)),
            MeshPart("metaverse_smart_link_launcher_optic_sensor", _box((0.03, 0.025, 0.025), BLUE), (-0.05, 0.055, 0.0)),
        ),
    )

    module(
        "metaverse-pistol-compensator.gltf",
        (
            MeshPart("metaverse_pistol_compensator_body", _box((0.06, 0.02, 0.024), DARK_STEEL), (0.03, 0.0, 0.0)),
            MeshPart("metaverse_pistol_compensator_port", _box((0.02, 0.01, 0.012), BLACK), (0.03, 0.012, 0.0)),
        ),
    )

    module(
        "metaverse-rifle-suppressor.gltf",
        (
            MeshPart("metaverse_rifle_suppressor_body", _cylinder_x(0.18, 0.017, BLACK), (0.09, 0.0, 0.0)),
        ),
    )

    module(
        "metaverse-battle-rifle-brake.gltf",
        (
            MeshPart("metaverse_battle_rifle_brake_body", _cylinder_x(0.09, 0.014, DARK_STEEL), (0.045, 0.0, 0.0)),
            MeshPart("metaverse_battle_rifle_brake_port_top", _box((0.03, 0.008, 0.02), BLACK), (0.035, 0.012, 0.0)),
            MeshPart("metaverse_battle_rifle_brake_port_side", _box((0.02, 0.01, 0.008), BLACK), (0.045, 0.0, 0.015)),
        ),
    )

    module(
        "metaverse-full-choke.gltf",
        (
            MeshPart("metaverse_full_choke_body", _cylinder_x(0.08, 0.016, DARK_STEEL), (0.04, 0.0, 0.0)),
            MeshPart("metaverse_full_choke_taper", _cone_x(0.03, 0.012, STEEL), (0.095, 0.0, 0.0)),
        ),
    )

    module(
        "metaverse-breacher-choke.gltf",
        (
            MeshPart("metaverse_breacher_choke_body", _cylinder_x(0.08, 0.016, DARK_STEEL), (0.04, 0.0, 0.0)),
            MeshPart("metaverse_breacher_choke_tooth_top", _box((0.015, 0.012, 0.008), STEEL), (0.082, 0.013, 0.0)),
            MeshPart("metaverse_breacher_choke_tooth_left", _box((0.015, 0.008, 0.008), STEEL), (0.082, 0.0, -0.012)),
            MeshPart("metaverse_breacher_choke_tooth_right", _box((0.015, 0.008, 0.008), STEEL), (0.082, 0.0, 0.012)),
        ),
    )

    module(
        "metaverse-guidance-shroud.gltf",
        (
            MeshPart("metaverse_guidance_shroud_body", _box((0.12, 0.08, 0.08), TAN), (0.06, 0.0, 0.0)),
            MeshPart("metaverse_guidance_shroud_fin_top", _box((0.05, 0.02, 0.01), DARK_STEEL), (0.08, 0.05, 0.0)),
            MeshPart("metaverse_guidance_shroud_fin_left", _box((0.04, 0.01, 0.02), DARK_STEEL), (0.08, 0.0, -0.045)),
            MeshPart("metaverse_guidance_shroud_fin_right", _box((0.04, 0.01, 0.02), DARK_STEEL), (0.08, 0.0, 0.045)),
        ),
    )

    return specs


# --- generation / verification --------------------------------------------


def _gltf_paths_from_manifests() -> list[Path]:
    model_paths: list[Path] = []
    pattern = re.compile(r'modelPath:\s*"([^"]+\.gltf)"')
    for manifest in (
        ROOT / "client/src/assets/config/weapon-archetype-manifest.ts",
        ROOT / "client/src/assets/config/weapon-module-manifest.ts",
    ):
        text = manifest.read_text(encoding="utf-8")
        for match in pattern.findall(text):
            model_paths.append(ROOT / "client/public" / match.lstrip("/"))
    return model_paths


def main() -> None:
    weapon_specs = create_weapon_specs()
    module_specs = create_module_specs()

    generated: list[Path] = []

    for spec in weapon_specs:
        path = ATTACHMENTS_DIR / spec.output_name
        scene = _scene_from_parts(spec.parts, spec.markers)
        _write_embedded_gltf(scene, path, spec.root_name)
        _validate_gltf(path, spec.required_nodes)
        generated.append(path)

    for spec in module_specs:
        path = MODULES_DIR / spec.output_name
        scene = _scene_from_parts(spec.parts, ())
        _write_embedded_gltf(scene, path, spec.root_name)
        _validate_gltf(path, (spec.root_name,))
        generated.append(path)

    expected_paths = _gltf_paths_from_manifests()
    missing = [path for path in expected_paths if not path.exists()]
    if missing:
        missing_labels = "\n".join(str(path.relative_to(ROOT)) for path in missing)
        raise FileNotFoundError(f"Generated assets still missing:\n{missing_labels}")

    inventory_path = ROOT / "docs/generated-gltf-inventory.md"
    inventory_lines = [
        "# Generated modular weapon GLTF inventory",
        "",
        "These are graybox authoring assets with the correct node/socket contract.",
        "They are intended to unblock loading, grip alignment, ADS anchoring, and module mounting.",
        "",
        "## Base weapons",
        "",
    ]
    inventory_lines.extend(
        [f"- `{path.relative_to(ROOT / 'client/public')}`" for path in generated if path.parent == ATTACHMENTS_DIR]
    )
    inventory_lines.extend(["", "## Modules", ""])
    inventory_lines.extend(
        [f"- `{path.relative_to(ROOT / 'client/public')}`" for path in generated if path.parent == MODULES_DIR]
    )
    inventory_path.write_text("\n".join(inventory_lines) + "\n", encoding="utf-8")

    print(f"Generated {len(generated)} GLTF files.")
    print("Manifest verification passed.")


if __name__ == "__main__":
    main()
