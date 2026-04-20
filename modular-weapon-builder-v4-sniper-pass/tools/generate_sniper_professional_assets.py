#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
import trimesh
from trimesh.transformations import euler_matrix

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
BLUE: Color = (73, 129, 196, 255)
GLASS: Color = (96, 160, 188, 180)
RUBBER: Color = (36, 38, 40, 255)
BRASS: Color = (177, 146, 78, 255)
ORANGE: Color = (218, 140, 63, 255)


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


def _cylinder_x(length: float, radius: float, color: Color, sections: int = 32) -> trimesh.Trimesh:
    mesh = trimesh.creation.cylinder(radius=radius, height=length, sections=sections)
    mesh.apply_transform(Z_TO_X)
    return _apply_color(mesh, color)


def _capsule_x(length: float, radius: float, color: Color, count: tuple[int, int] = (16, 16)) -> trimesh.Trimesh:
    mesh = trimesh.creation.capsule(height=length, radius=radius, count=count)
    mesh.apply_transform(Z_TO_X)
    return _apply_color(mesh, color)


def _annulus_x(inner_radius: float, outer_radius: float, height: float, color: Color, sections: int = 32) -> trimesh.Trimesh:
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
class ModelSpec:
    destination: Path
    root_name: str
    parts: Sequence[MeshPart]
    markers: Sequence[MarkerNode]
    required_nodes: Sequence[str]


FORWARD_UP = (
    MarkerNode("forward_marker", (1.0, 0.0, 0.0)),
    MarkerNode("up_marker", (0.0, 1.0, 0.0)),
)


OPTIC_RESERVED_MARKERS = (
    MarkerNode("optic_forward_marker", (1.0, 0.0, 0.0)),
    MarkerNode("optic_up_marker", (0.0, 1.0, 0.0)),
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


# ---------------------------------------------------------------------------
# Professional sniper pass
# ---------------------------------------------------------------------------


def create_longshot_sniper_spec() -> ModelSpec:
    prefix = "metaverse_longshot_sniper"
    parts: list[MeshPart] = [
        MeshPart(f"{prefix}_chassis_spine", _box((0.78, 0.034, 0.042), DARK_STEEL), (0.32, 0.052, 0.0)),
        MeshPart(f"{prefix}_top_rail", _box((0.58, 0.012, 0.03), STEEL), (0.43, 0.108, 0.0)),
        MeshPart(f"{prefix}_receiver_upper", _box((0.25, 0.055, 0.058), GREEN), (0.17, 0.066, 0.0)),
        MeshPart(f"{prefix}_receiver_lower", _box((0.17, 0.06, 0.05), GREEN), (0.12, 0.03, 0.0)),
        MeshPart(f"{prefix}_magwell", _box((0.08, 0.055, 0.04), DARK_STEEL), (0.18, -0.005, 0.0)),
        MeshPart(f"{prefix}_magazine", _box((0.06, 0.12, 0.038), BLACK), (0.20, -0.085, 0.0), (0.0, 0.0, 0.11)),
        MeshPart(f"{prefix}_pistol_grip", _box((0.05, 0.14, 0.036), POLYMER), (0.07, -0.05, 0.0), (0.0, 0.0, 0.28)),
        MeshPart(f"{prefix}_trigger_guard", _box((0.072, 0.03, 0.014), DARK_STEEL), (0.115, -0.03, 0.0), (0.0, 0.0, 0.15)),
        MeshPart(f"{prefix}_rear_stock_spine", _box((0.30, 0.05, 0.034), DARK_STEEL), (-0.18, 0.06, 0.0)),
        MeshPart(f"{prefix}_buttpad", _box((0.03, 0.15, 0.048), RUBBER), (-0.35, 0.05, 0.0)),
        MeshPart(f"{prefix}_cheek_rest", _box((0.16, 0.022, 0.05), TAN), (-0.15, 0.11, 0.0)),
        MeshPart(f"{prefix}_stock_lower_rail", _box((0.20, 0.022, 0.025), POLYMER), (-0.14, 0.015, 0.0)),
        MeshPart(f"{prefix}_handguard_core", _box((0.42, 0.045, 0.05), TAN), (0.58, 0.037, 0.0)),
        MeshPart(f"{prefix}_handguard_top_strip", _box((0.34, 0.018, 0.028), GREEN), (0.61, 0.077, 0.0)),
        MeshPart(f"{prefix}_handguard_bottom_rail", _box((0.30, 0.016, 0.026), DARK_STEEL), (0.60, -0.002, 0.0)),
        MeshPart(f"{prefix}_vent_left_1", _box((0.045, 0.012, 0.006), BLACK), (0.48, 0.05, -0.024)),
        MeshPart(f"{prefix}_vent_left_2", _box((0.045, 0.012, 0.006), BLACK), (0.60, 0.05, -0.024)),
        MeshPart(f"{prefix}_vent_left_3", _box((0.045, 0.012, 0.006), BLACK), (0.72, 0.05, -0.024)),
        MeshPart(f"{prefix}_vent_right_1", _box((0.045, 0.012, 0.006), BLACK), (0.48, 0.05, 0.024)),
        MeshPart(f"{prefix}_vent_right_2", _box((0.045, 0.012, 0.006), BLACK), (0.60, 0.05, 0.024)),
        MeshPart(f"{prefix}_vent_right_3", _box((0.045, 0.012, 0.006), BLACK), (0.72, 0.05, 0.024)),
        MeshPart(f"{prefix}_barrel_shroud", _cylinder_x(0.32, 0.018, BLACK), (0.83, 0.058, 0.0)),
        MeshPart(f"{prefix}_barrel", _cylinder_x(0.58, 0.0105, DARK_STEEL), (0.96, 0.058, 0.0)),
        MeshPart(f"{prefix}_thread_collar", _cylinder_x(0.035, 0.013, STEEL), (1.20, 0.058, 0.0)),
        MeshPart(f"{prefix}_bolt_channel", _box((0.12, 0.018, 0.024), BLACK), (0.18, 0.078, 0.0)),
        MeshPart(f"{prefix}_bolt_handle_root", _cylinder_x(0.03, 0.006, STEEL), (0.10, 0.062, -0.037), (0.0, 0.0, math.pi / 2)),
        MeshPart(f"{prefix}_bolt_handle_knob", _icosphere(0.012, STEEL), (0.10, 0.025, -0.037)),
        MeshPart(f"{prefix}_rail_rear_riser", _box((0.06, 0.022, 0.03), STEEL), (0.18, 0.094, 0.0)),
        MeshPart(f"{prefix}_rail_front_riser", _box((0.09, 0.022, 0.03), STEEL), (0.52, 0.094, 0.0)),
    ]
    markers = [
        MarkerNode(f"{prefix}_forward_marker", (1.0, 0.0, 0.0)),
        MarkerNode(f"{prefix}_up_marker", (0.0, 1.0, 0.0)),
        MarkerNode(f"{prefix}_grip_hand_r_socket", (0.085, -0.028, 0.0)),
        MarkerNode(f"{prefix}_trigger_marker", (0.16, -0.006, 0.0)),
        MarkerNode(f"{prefix}_support_grip_marker", (0.57, -0.018, 0.03)),
        MarkerNode(f"{prefix}_grip_module_socket", (0.61, -0.013, 0.0)),
        MarkerNode(f"{prefix}_front_sight_socket", (1.10, 0.103, 0.0)),
        MarkerNode(f"{prefix}_rear_sight_socket", (0.27, 0.103, 0.0)),
        MarkerNode(f"{prefix}_optic_mount_socket", (0.49, 0.118, 0.0)),
        MarkerNode(f"{prefix}_muzzle_socket", (1.225, 0.058, 0.0)),
        MarkerNode(f"{prefix}_ads_camera_anchor", (0.18, 0.168, 0.0)),
        MarkerNode(f"{prefix}_back_socket", (-0.05, 0.06, 0.0)),
    ]
    required = tuple(marker.name for marker in markers) + (f"{prefix}_root",)
    return ModelSpec(
        destination=ATTACHMENTS_DIR / "metaverse-longshot-sniper.gltf",
        root_name=f"{prefix}_root",
        parts=tuple(parts),
        markers=tuple(markers),
        required_nodes=required,
    )


# --- sniper modules -------------------------------------------------------


def _scope_markers(prefix: str, eye_box_x: float, reticle_x: float, objective_x: float, body_y: float) -> tuple[MarkerNode, ...]:
    return (
        MarkerNode(f"{prefix}_optic_forward_marker", (1.0, 0.0, 0.0)),
        MarkerNode(f"{prefix}_optic_up_marker", (0.0, 1.0, 0.0)),
        MarkerNode(f"{prefix}_eye_box_anchor", (eye_box_x, body_y, 0.0)),
        MarkerNode(f"{prefix}_reticle_plane", (reticle_x, body_y, 0.0)),
        MarkerNode(f"{prefix}_ocular_lens_marker", (eye_box_x + 0.03, body_y, 0.0)),
        MarkerNode(f"{prefix}_objective_lens_marker", (objective_x, body_y, 0.0)),
    )


def create_sniper_module_specs() -> list[ModelSpec]:
    specs: list[ModelSpec] = []

    def add(name: str, root_name: str, parts: Sequence[MeshPart], markers: Sequence[MarkerNode] = (), required: Sequence[str] = ()) -> None:
        specs.append(
            ModelSpec(
                destination=MODULES_DIR / name,
                root_name=root_name,
                parts=tuple(parts),
                markers=tuple(markers),
                required_nodes=tuple(required),
            )
        )

    add(
        "metaverse-precision-bipod.gltf",
        "metaverse_precision_bipod_root",
        parts=(
            MeshPart("metaverse_precision_bipod_mount", _box((0.07, 0.016, 0.03), DARK_STEEL), (0.0, -0.004, 0.0)),
            MeshPart("metaverse_precision_bipod_body", _box((0.045, 0.028, 0.022), POLYMER), (0.01, -0.018, 0.0)),
            MeshPart("metaverse_precision_bipod_leg_left", _box((0.012, 0.07, 0.008), STEEL), (-0.016, -0.055, -0.014), (0.0, 0.0, 0.35)),
            MeshPart("metaverse_precision_bipod_leg_right", _box((0.012, 0.07, 0.008), STEEL), (-0.016, -0.055, 0.014), (0.0, 0.0, 0.35)),
            MeshPart("metaverse_precision_bipod_foot_left", _box((0.018, 0.008, 0.01), RUBBER), (-0.03, -0.09, -0.014)),
            MeshPart("metaverse_precision_bipod_foot_right", _box((0.018, 0.008, 0.01), RUBBER), (-0.03, -0.09, 0.014)),
        ),
    )

    add(
        "metaverse-folding-front-sight.gltf",
        "metaverse_folding_front_sight_root",
        parts=(
            MeshPart("metaverse_folding_front_sight_base", _box((0.032, 0.012, 0.022), DARK_STEEL), (0.0, 0.006, 0.0)),
            MeshPart("metaverse_folding_front_sight_tower", _box((0.012, 0.038, 0.008), STEEL), (0.0, 0.026, 0.0)),
            MeshPart("metaverse_folding_front_sight_hood_left", _box((0.006, 0.03, 0.006), STEEL), (-0.008, 0.026, 0.0)),
            MeshPart("metaverse_folding_front_sight_hood_right", _box((0.006, 0.03, 0.006), STEEL), (0.008, 0.026, 0.0)),
            MeshPart("metaverse_folding_front_sight_post", _box((0.004, 0.02, 0.004), ORANGE), (0.0, 0.036, 0.0)),
        ),
    )

    add(
        "metaverse-micro-aperture-rear-sight.gltf",
        "metaverse_micro_aperture_rear_sight_root",
        parts=(
            MeshPart("metaverse_micro_aperture_rear_sight_base", _box((0.034, 0.012, 0.024), DARK_STEEL), (0.0, 0.006, 0.0)),
            MeshPart("metaverse_micro_aperture_rear_sight_frame", _box((0.014, 0.028, 0.01), STEEL), (0.0, 0.022, 0.0)),
            MeshPart("metaverse_micro_aperture_rear_sight_ring", _annulus_x(0.005, 0.009, 0.003, STEEL), (0.0, 0.026, 0.0)),
            MeshPart("metaverse_micro_aperture_rear_sight_wing_left", _box((0.006, 0.018, 0.005), STEEL), (-0.012, 0.018, 0.0)),
            MeshPart("metaverse_micro_aperture_rear_sight_wing_right", _box((0.006, 0.018, 0.005), STEEL), (0.012, 0.018, 0.0)),
        ),
    )

    four_x_prefix = "metaverse_4x_scope"
    add(
        "metaverse-4x-scope.gltf",
        f"{four_x_prefix}_root",
        parts=(
            MeshPart(f"{four_x_prefix}_mount_block", _box((0.11, 0.02, 0.034), DARK_STEEL), (0.0, 0.01, 0.0)),
            MeshPart(f"{four_x_prefix}_cantilever", _box((0.08, 0.018, 0.028), STEEL), (-0.09, 0.02, 0.0)),
            MeshPart(f"{four_x_prefix}_rear_ring", _box((0.024, 0.032, 0.034), STEEL), (-0.13, 0.024, 0.0)),
            MeshPart(f"{four_x_prefix}_front_ring", _box((0.024, 0.032, 0.034), STEEL), (-0.03, 0.024, 0.0)),
            MeshPart(f"{four_x_prefix}_tube", _cylinder_x(0.30, 0.018, BLACK), (-0.08, 0.046, 0.0)),
            MeshPart(f"{four_x_prefix}_ocular_bell", _capsule_x(0.08, 0.022, BLACK), (-0.255, 0.046, 0.0)),
            MeshPart(f"{four_x_prefix}_objective_bell", _capsule_x(0.09, 0.024, BLACK), (0.10, 0.046, 0.0)),
            MeshPart(f"{four_x_prefix}_turret_vertical", _cylinder_x(0.024, 0.011, STEEL), (-0.075, 0.073, 0.0), (0.0, 0.0, math.pi / 2)),
            MeshPart(f"{four_x_prefix}_turret_side", _cylinder_x(0.020, 0.009, STEEL), (-0.075, 0.046, -0.029)),
            MeshPart(f"{four_x_prefix}_objective_lens", _box((0.004, 0.024, 0.024), GLASS), (0.145, 0.046, 0.0)),
            MeshPart(f"{four_x_prefix}_ocular_lens", _box((0.004, 0.018, 0.018), GLASS), (-0.302, 0.046, 0.0)),
        ),
        markers=_scope_markers(four_x_prefix, eye_box_x=-0.312, reticle_x=-0.08, objective_x=0.145, body_y=0.046),
        required=[
            f"{four_x_prefix}_optic_forward_marker",
            f"{four_x_prefix}_optic_up_marker",
            f"{four_x_prefix}_eye_box_anchor",
            f"{four_x_prefix}_reticle_plane",
            f"{four_x_prefix}_ocular_lens_marker",
            f"{four_x_prefix}_objective_lens_marker",
        ],
    )

    six_x_prefix = "metaverse_6x_variable_scope"
    add(
        "metaverse-6x-variable-scope.gltf",
        f"{six_x_prefix}_root",
        parts=(
            MeshPart(f"{six_x_prefix}_mount_block", _box((0.13, 0.02, 0.036), DARK_STEEL), (0.0, 0.01, 0.0)),
            MeshPart(f"{six_x_prefix}_cantilever", _box((0.09, 0.018, 0.03), STEEL), (-0.09, 0.02, 0.0)),
            MeshPart(f"{six_x_prefix}_rear_ring", _box((0.024, 0.034, 0.036), STEEL), (-0.145, 0.026, 0.0)),
            MeshPart(f"{six_x_prefix}_front_ring", _box((0.024, 0.034, 0.036), STEEL), (-0.015, 0.026, 0.0)),
            MeshPart(f"{six_x_prefix}_tube", _cylinder_x(0.36, 0.019, BLACK), (-0.08, 0.05, 0.0)),
            MeshPart(f"{six_x_prefix}_ocular_bell", _capsule_x(0.09, 0.024, BLACK), (-0.255, 0.05, 0.0)),
            MeshPart(f"{six_x_prefix}_mag_ring", _annulus_x(0.020, 0.026, 0.016, DARK_STEEL), (-0.18, 0.05, 0.0)),
            MeshPart(f"{six_x_prefix}_objective_bell", _capsule_x(0.11, 0.028, BLACK), (0.16, 0.05, 0.0)),
            MeshPart(f"{six_x_prefix}_turret_vertical", _cylinder_x(0.03, 0.012, STEEL), (-0.06, 0.08, 0.0), (0.0, 0.0, math.pi / 2)),
            MeshPart(f"{six_x_prefix}_turret_side", _cylinder_x(0.024, 0.010, STEEL), (-0.06, 0.05, -0.031)),
            MeshPart(f"{six_x_prefix}_objective_lens", _box((0.004, 0.028, 0.028), GLASS), (0.225, 0.05, 0.0)),
            MeshPart(f"{six_x_prefix}_ocular_lens", _box((0.004, 0.02, 0.02), GLASS), (-0.304, 0.05, 0.0)),
        ),
        markers=_scope_markers(six_x_prefix, eye_box_x=-0.314, reticle_x=-0.06, objective_x=0.225, body_y=0.05),
        required=[
            f"{six_x_prefix}_optic_forward_marker",
            f"{six_x_prefix}_optic_up_marker",
            f"{six_x_prefix}_eye_box_anchor",
            f"{six_x_prefix}_reticle_plane",
            f"{six_x_prefix}_ocular_lens_marker",
            f"{six_x_prefix}_objective_lens_marker",
        ],
    )

    ten_x_prefix = "metaverse_10x_precision_scope"
    add(
        "metaverse-10x-precision-scope.gltf",
        f"{ten_x_prefix}_root",
        parts=(
            MeshPart(f"{ten_x_prefix}_mount_block", _box((0.15, 0.022, 0.038), DARK_STEEL), (0.0, 0.011, 0.0)),
            MeshPart(f"{ten_x_prefix}_cantilever", _box((0.06, 0.018, 0.03), STEEL), (-0.07, 0.02, 0.0)),
            MeshPart(f"{ten_x_prefix}_rear_ring", _box((0.024, 0.036, 0.038), STEEL), (-0.065, 0.028, 0.0)),
            MeshPart(f"{ten_x_prefix}_front_ring", _box((0.024, 0.036, 0.038), STEEL), (0.075, 0.028, 0.0)),
            MeshPart(f"{ten_x_prefix}_tube", _cylinder_x(0.40, 0.019, BLACK), (0.0, 0.054, 0.0)),
            MeshPart(f"{ten_x_prefix}_ocular_bell", _capsule_x(0.09, 0.026, BLACK), (-0.245, 0.054, 0.0)),
            MeshPart(f"{ten_x_prefix}_eye_relief_ring", _annulus_x(0.022, 0.028, 0.018, DARK_STEEL), (-0.18, 0.054, 0.0)),
            MeshPart(f"{ten_x_prefix}_objective_bell", _capsule_x(0.12, 0.032, BLACK), (0.27, 0.054, 0.0)),
            MeshPart(f"{ten_x_prefix}_sunshade", _cylinder_x(0.10, 0.024, BLACK), (0.40, 0.054, 0.0)),
            MeshPart(f"{ten_x_prefix}_turret_vertical", _cylinder_x(0.032, 0.013, STEEL), (0.03, 0.086, 0.0), (0.0, 0.0, math.pi / 2)),
            MeshPart(f"{ten_x_prefix}_turret_side", _cylinder_x(0.026, 0.010, STEEL), (0.03, 0.054, -0.034)),
            MeshPart(f"{ten_x_prefix}_objective_lens", _box((0.004, 0.034, 0.034), GLASS), (0.44, 0.054, 0.0)),
            MeshPart(f"{ten_x_prefix}_ocular_lens", _box((0.004, 0.022, 0.022), GLASS), (-0.295, 0.054, 0.0)),
        ),
        markers=_scope_markers(ten_x_prefix, eye_box_x=-0.304, reticle_x=0.01, objective_x=0.44, body_y=0.054),
        required=[
            f"{ten_x_prefix}_optic_forward_marker",
            f"{ten_x_prefix}_optic_up_marker",
            f"{ten_x_prefix}_eye_box_anchor",
            f"{ten_x_prefix}_reticle_plane",
            f"{ten_x_prefix}_ocular_lens_marker",
            f"{ten_x_prefix}_objective_lens_marker",
        ],
    )

    add(
        "metaverse-precision-muzzle-brake.gltf",
        "metaverse_precision_muzzle_brake_root",
        parts=(
            MeshPart("metaverse_precision_muzzle_brake_body", _cylinder_x(0.11, 0.016, DARK_STEEL), (0.055, 0.0, 0.0)),
            MeshPart("metaverse_precision_muzzle_brake_chamber_1", _box((0.018, 0.02, 0.03), BLACK), (0.03, 0.0, 0.0)),
            MeshPart("metaverse_precision_muzzle_brake_chamber_2", _box((0.018, 0.02, 0.03), BLACK), (0.065, 0.0, 0.0)),
            MeshPart("metaverse_precision_muzzle_brake_top_port", _box((0.028, 0.008, 0.018), BLACK), (0.045, 0.014, 0.0)),
            MeshPart("metaverse_precision_muzzle_brake_side_port_left", _box((0.018, 0.01, 0.006), BLACK), (0.07, 0.0, -0.016)),
            MeshPart("metaverse_precision_muzzle_brake_side_port_right", _box((0.018, 0.01, 0.006), BLACK), (0.07, 0.0, 0.016)),
        ),
    )

    add(
        "metaverse-long-suppressor.gltf",
        "metaverse_long_suppressor_root",
        parts=(
            MeshPart("metaverse_long_suppressor_body", _cylinder_x(0.24, 0.018, BLACK), (0.12, 0.0, 0.0)),
            MeshPart("metaverse_long_suppressor_rear_collar", _cylinder_x(0.03, 0.021, DARK_STEEL), (0.02, 0.0, 0.0)),
            MeshPart("metaverse_long_suppressor_front_cap", _cylinder_x(0.02, 0.016, DARK_STEEL), (0.24, 0.0, 0.0)),
        ),
    )

    return specs


# ---------------------------------------------------------------------------


def write_inventory(sniper_specs: list[ModelSpec]) -> None:
    doc_path = ROOT / "docs/sniper-professional-pass.md"
    lines = [
        "# Sniper professional pass",
        "",
        "This pass intentionally focuses on the longshot sniper base and sniper-adjacent modules.",
        "",
        "## What changed",
        "",
        "- removed the baked-in scope silhouette from the sniper base so optics are truly modular",
        "- rebuilt the rifle as a chassis/receiver/barrel/rail/stock package with clean module sockets",
        "- added sniper-specific grip, backup iron sights, optics, and muzzle options",
        "- authored reserved optic markers for future eye-box / reticle-plane work",
        "",
        "## Reserved optic markers on professional scope modules",
        "",
        "- `<optic>_eye_box_anchor`",
        "- `<optic>_reticle_plane`",
        "- `<optic>_ocular_lens_marker`",
        "- `<optic>_objective_lens_marker`",
        "- `<optic>_optic_forward_marker`",
        "- `<optic>_optic_up_marker`",
        "",
        "These markers are not required by your current runtime, but they give you a clean next step for true optic-specific ADS work.",
        "",
        "## Generated files",
        "",
    ]
    for spec in sniper_specs:
        rel = spec.destination.relative_to(ROOT / "client/public")
        lines.append(f"- `{rel.as_posix()}`")
    doc_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    specs = [create_longshot_sniper_spec(), *create_sniper_module_specs()]
    for spec in specs:
        scene = _scene_from_parts(spec.parts, spec.markers)
        _write_embedded_gltf(scene, spec.destination, spec.root_name)
        _validate_gltf(spec.destination, spec.required_nodes)
    write_inventory(specs)
    print(f"Wrote {len(specs)} professional sniper assets.")


if __name__ == "__main__":
    main()
