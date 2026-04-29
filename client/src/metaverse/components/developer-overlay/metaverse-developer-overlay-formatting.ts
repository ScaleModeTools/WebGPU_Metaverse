import type { MetaverseHudSnapshot } from "../../types/metaverse-runtime";

type ReliableTransportSnapshot = MetaverseHudSnapshot["transport"]["presenceReliable"];
type DatagramTransportSnapshot =
  MetaverseHudSnapshot["transport"]["worldDriverDatagram"];
type SnapshotStreamTransportSnapshot =
  MetaverseHudSnapshot["transport"]["worldSnapshotStream"];

const metaversePresenceWebTransportTarget = resolveConfiguredWebTransportTarget(
  import.meta.env?.VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL
);
const metaverseWorldWebTransportTarget = resolveConfiguredWebTransportTarget(
  import.meta.env?.VITE_METAVERSE_WORLD_WEBTRANSPORT_URL
);

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatTransportStatus(snapshot: {
  readonly activeTransport: string | null;
  readonly webTransportStatus: string;
}): string {
  const activeTransportLabel =
    snapshot.activeTransport === null
      ? "inactive"
      : snapshot.activeTransport.replaceAll("-", " ");

  return `${snapshot.webTransportStatus.replaceAll("-", " ")} · ${activeTransportLabel}`;
}

function formatReliableTransportSummary(snapshot: ReliableTransportSnapshot): string {
  if (!snapshot.enabled) {
    return "Reliable lane disabled";
  }

  if (snapshot.fallbackActive) {
    if (snapshot.webTransportStatus === "localdev-host-unavailable") {
      return "HTTP fallback: localdev WebTransport host unavailable";
    }

    return "HTTP fallback: WebTransport failed";
  }

  switch (snapshot.webTransportStatus) {
    case "not-requested":
      return "HTTP only: WebTransport not requested";
    case "unconfigured":
      return "HTTP only: WebTransport URL missing";
    case "localdev-self-check-failed":
      return "HTTP only: localdev WebTransport self-check failed";
    case "browser-api-missing":
      return "HTTP only: browser WebTransport API missing";
    case "active":
      return snapshot.activeTransport === "webtransport"
        ? "WebTransport active"
        : "Reliable lane connecting";
    default:
      return formatTransportStatus(snapshot);
  }
}

function formatDatagramTransportSummary(snapshot: DatagramTransportSnapshot): string {
  if (!snapshot.enabled) {
    return "Datagram lane disabled";
  }

  if (snapshot.state === "degraded-to-reliable") {
    return "Reliable fallback: datagram send failed";
  }

  if (snapshot.state === "active") {
    return snapshot.activeTransport === "webtransport-datagram"
      ? "WebTransport datagrams active"
      : "Datagram lane active";
  }

  switch (snapshot.webTransportStatus) {
    case "not-requested":
      return "Datagrams off: WebTransport not requested";
    case "unconfigured":
      return "Datagrams off: WebTransport URL missing";
    case "localdev-self-check-failed":
      return "Datagrams off: localdev WebTransport self-check failed";
    case "browser-api-missing":
      return "Datagrams off: browser WebTransport API missing";
    default:
      return "Datagrams unavailable";
  }
}

function formatTransportError(lastTransportError: string | null): string {
  if (lastTransportError === null) {
    return "No transport error recorded.";
  }

  return lastTransportError;
}

function formatOptionalMilliseconds(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${value.toFixed(0)} ms`;
}

function formatOptionalCentimeters(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${(value * 100).toFixed(1)} cm`;
}

function formatBooleanFlag(value: boolean): string {
  return value ? "yes" : "no";
}

function formatOptionalDegrees(valueRadians: number | null): string {
  if (valueRadians === null) {
    return "n/a";
  }

  return `${((valueRadians * 180) / Math.PI).toFixed(1)} deg`;
}

function formatOptionalRateHz(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${value.toFixed(1)} Hz`;
}

function formatHeldWeaponGripStatus(hudSnapshot: MetaverseHudSnapshot): string {
  const gripSnapshot = hudSnapshot.telemetry.localHeldWeaponGrip;

  return `${gripSnapshot.stability} · ${gripSnapshot.phase.replaceAll("-", " ")}`;
}

function formatProjectilePresentationDebug(
  hudSnapshot: MetaverseHudSnapshot
): string {
  const debugSnapshot = hudSnapshot.telemetry.projectilePresentation[0] ?? null;

  if (debugSnapshot === null) {
    return "n/a";
  }

  return [
    debugSnapshot.deliveryModel,
    debugSnapshot.weaponId,
    `action ${debugSnapshot.actionSequence ?? "n/a"}`,
    `projectile ${debugSnapshot.projectileId ?? "n/a"}`,
    `hit ${debugSnapshot.hitscanHitKind ?? "n/a"}`,
    `start ${debugSnapshot.tracerStartSource ?? "n/a"}`,
    `endpoint ${debugSnapshot.visualEndpointSource ?? "n/a"}`,
    `policy ${debugSnapshot.finiteEndpointPolicy ?? "n/a"}`,
    `suppressed ${debugSnapshot.tracerSuppressedReason ?? "none"}`,
    `fire-drain ${formatOptionalCentimeters(debugSnapshot.postSyncFireActionToDrainTimeMuzzleDeltaMeters)}`,
    `ray-error ${formatOptionalCentimeters(debugSnapshot.endpointRayPerpendicularErrorMeters)}`,
    `ray-visual ${formatOptionalDegrees(debugSnapshot.cameraRayToVisualSegmentAngleRadians)}`,
    `muzzle-visual ${formatOptionalDegrees(debugSnapshot.muzzleForwardToVisualSegmentAngleRadians)}`,
    `muzzle-tip ${formatOptionalCentimeters(debugSnapshot.muzzleToSemanticTipDeltaMeters)}`,
    `tip-snapshot ${formatOptionalCentimeters(debugSnapshot.semanticTipToFirstSnapshotDeltaMeters)}`
  ].join(" · ");
}

function formatHeldWeaponMainHandDiagnosis(
  gripSnapshot: MetaverseHudSnapshot["telemetry"]["localHeldWeaponGrip"]
): string {
  if (gripSnapshot.mainHandGripErrorMeters === null) {
    return "n/a";
  }

  if (
    gripSnapshot.mainHandReachClampDeltaMeters !== null &&
    gripSnapshot.mainHandReachClampDeltaMeters >= 0.01 &&
    Math.abs(
      gripSnapshot.mainHandGripErrorMeters -
        gripSnapshot.mainHandReachClampDeltaMeters
    ) <= 0.01
  ) {
    return "reach clamp matches residual";
  }

  if (
    gripSnapshot.mainHandSolveErrorMeters !== null &&
    gripSnapshot.mainHandPostPoleBiasErrorMeters !== null &&
    gripSnapshot.mainHandGripErrorMeters >
      gripSnapshot.mainHandPostPoleBiasErrorMeters + 0.01
  ) {
    return "hand align step adds residual";
  }

  if (
    gripSnapshot.offHandPoleAngleRadians !== null &&
    Math.abs(gripSnapshot.offHandPoleAngleRadians) >= 0.35
  ) {
    return "left arm pole bias is rotating the support arm";
  }

  if (
    gripSnapshot.mainHandPoleAngleRadians !== null &&
    Math.abs(gripSnapshot.mainHandPoleAngleRadians) >= 0.35
  ) {
    return "main arm pole bias is rotating the weapon arm";
  }

  if (
    gripSnapshot.mainHandSocket === "palm" &&
    gripSnapshot.mainHandGripSocketComparisonErrorMeters !== null &&
    gripSnapshot.mainHandPalmSocketComparisonErrorMeters !== null &&
    gripSnapshot.mainHandGripSocketComparisonErrorMeters + 0.01 <
      gripSnapshot.mainHandPalmSocketComparisonErrorMeters
  ) {
    return "grip socket solves closer than palm";
  }

  if (
    gripSnapshot.mainHandSocket === "grip" &&
    gripSnapshot.mainHandGripSocketComparisonErrorMeters !== null &&
    gripSnapshot.mainHandPalmSocketComparisonErrorMeters !== null &&
    gripSnapshot.mainHandPalmSocketComparisonErrorMeters + 0.01 <
      gripSnapshot.mainHandGripSocketComparisonErrorMeters
  ) {
    return "palm socket solves closer than grip";
  }

  return "active socket remains closest";
}

function formatDecisionReason(
  reason: MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["surfaceRouting"]["local"]["decisionReason"]
): string {
  return reason.replaceAll("-", " ");
}

function formatSnapshotStreamPath(path: SnapshotStreamTransportSnapshot["path"]): string {
  return path.replaceAll("-", " ");
}

function formatSnapshotStreamLiveness(
  liveness: SnapshotStreamTransportSnapshot["liveness"]
): string {
  return liveness.replaceAll("-", " ");
}

function resolveConfiguredWebTransportTarget(rawUrl: string | undefined): string | null {
  const trimmedValue = rawUrl?.trim();

  if (trimmedValue === undefined || trimmedValue.length === 0) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    return `${parsedUrl.host}${parsedUrl.pathname}`;
  } catch {
    return trimmedValue;
  }
}

function formatReliableHandshakeDebugLine(
  snapshot: ReliableTransportSnapshot,
  target: string | null
): string {
  if (!snapshot.enabled) {
    return "Reliable lane disabled.";
  }

  if (target === null) {
    return snapshot.webTransportConfigured
      ? "WebTransport is configured, but the endpoint could not be parsed."
      : "No WebTransport endpoint configured for this lane.";
  }

  if (
    snapshot.activeTransport === "webtransport" &&
    snapshot.webTransportStatus === "active"
  ) {
    return `Handshake established to ${target}.`;
  }

  if (snapshot.fallbackActive) {
    return `WebTransport targeted ${target} before falling back to HTTP.`;
  }

  switch (snapshot.webTransportStatus) {
    case "not-requested":
      return `WebTransport is not requested. HTTP remains active while ${target} stays configured.`;
    case "unconfigured":
      return "No WebTransport endpoint configured for this lane.";
    case "browser-api-missing":
      return `The browser cannot open WebTransport to ${target} because the API is unavailable.`;
    case "localdev-self-check-failed":
      return `Localdev startup failed before the browser could attempt ${target}.`;
    case "localdev-host-unavailable":
      return `Configured endpoint ${target} was unreachable from the browser.`;
    case "runtime-fallback":
      return `WebTransport attempted ${target}, then runtime failover switched this lane to HTTP.`;
    case "active":
      return `WebTransport is targeting ${target}.`;
    default:
      return `Configured WebTransport endpoint ${target}.`;
  }
}

function formatDatagramHandshakeDebugLine(
  snapshot: DatagramTransportSnapshot,
  target: string | null
): string {
  if (!snapshot.enabled) {
    return "Datagram lane disabled.";
  }

  if (target === null) {
    return snapshot.webTransportConfigured
      ? "WebTransport datagrams are configured, but the endpoint could not be parsed."
      : "No WebTransport endpoint configured for datagrams.";
  }

  if (
    snapshot.activeTransport === "webtransport-datagram" &&
    snapshot.state === "active"
  ) {
    return `Datagrams live on ${target}.`;
  }

  if (snapshot.state === "degraded-to-reliable") {
    return `Datagrams targeted ${target} before degrading to reliable commands.`;
  }

  switch (snapshot.webTransportStatus) {
    case "not-requested":
      return `Datagrams stay off because WebTransport is not requested, even though ${target} is configured.`;
    case "unconfigured":
      return "No WebTransport endpoint configured for datagrams.";
    case "browser-api-missing":
      return `The browser cannot open WebTransport datagrams to ${target} because the API is unavailable.`;
    case "localdev-self-check-failed":
      return `Localdev startup failed before the browser could attempt datagrams on ${target}.`;
    case "runtime-fallback":
      return `Datagrams attempted ${target}, then runtime failover moved this lane to reliable commands.`;
    case "active":
      return `Datagrams are targeting ${target}.`;
    default:
      return `Configured datagram endpoint ${target}.`;
  }
}

function formatSnapshotStreamSummary(
  snapshot: SnapshotStreamTransportSnapshot
): string {
  if (!snapshot.available) {
    return "Polling only: snapshot stream unavailable";
  }

  if (snapshot.path === "fallback-polling") {
    return snapshot.liveness === "reconnecting"
      ? "Polling fallback: snapshot stream reconnecting"
      : "Polling fallback: snapshot stream failed";
  }

  if (
    snapshot.path === "reliable-snapshot-stream" &&
    snapshot.liveness === "subscribed"
  ) {
    return "Snapshot stream active";
  }

  if (snapshot.liveness === "reconnecting") {
    return "Snapshot stream reconnecting";
  }

  return `Snapshot path: ${formatSnapshotStreamPath(snapshot.path)}`;
}

function formatSnapshotStreamDebugLine(
  snapshot: SnapshotStreamTransportSnapshot,
  target: string | null
): string {
  if (!snapshot.available) {
    return "World snapshot updates are arriving through HTTP polling only.";
  }

  if (target === null) {
    return `Snapshot stream lane is ${formatSnapshotStreamLiveness(snapshot.liveness)}.`;
  }

  if (
    snapshot.path === "reliable-snapshot-stream" &&
    snapshot.liveness === "subscribed"
  ) {
    return `Snapshot stream subscribed on ${target}.`;
  }

  if (snapshot.path === "fallback-polling") {
    return snapshot.liveness === "reconnecting"
      ? `Snapshot stream is reconnecting to ${target} while HTTP polling stays active.`
      : `Snapshot stream targeted ${target} before falling back to HTTP polling.`;
  }

  if (snapshot.liveness === "reconnecting") {
    return `Snapshot stream is reconnecting to ${target}.`;
  }

  return `Snapshot stream is targeting ${target}.`;
}

function formatTopLevelHandshakeDebugLine(hudSnapshot: MetaverseHudSnapshot): string {
  if (
    hudSnapshot.transport.worldReliable.activeTransport === "webtransport" &&
    hudSnapshot.transport.worldReliable.webTransportStatus === "active" &&
    metaverseWorldWebTransportTarget !== null
  ) {
    const datagramsActive =
      hudSnapshot.transport.worldDriverDatagram.activeTransport ===
        "webtransport-datagram" &&
      hudSnapshot.transport.worldDriverDatagram.state === "active";

    return datagramsActive
      ? `World handshake established to ${metaverseWorldWebTransportTarget}. Datagrams live.`
      : `World handshake established to ${metaverseWorldWebTransportTarget}.`;
  }

  if (
    hudSnapshot.transport.worldSnapshotStream.path ===
      "reliable-snapshot-stream" &&
    hudSnapshot.transport.worldSnapshotStream.liveness === "subscribed" &&
    metaverseWorldWebTransportTarget !== null
  ) {
    return `World snapshot stream live on ${metaverseWorldWebTransportTarget}.`;
  }

  if (
    hudSnapshot.transport.presenceReliable.activeTransport === "webtransport" &&
    hudSnapshot.transport.presenceReliable.webTransportStatus === "active" &&
    metaversePresenceWebTransportTarget !== null
  ) {
    return `Presence handshake established to ${metaversePresenceWebTransportTarget}.`;
  }

  if (metaverseWorldWebTransportTarget !== null) {
    return `Configured WebTransport target ${metaverseWorldWebTransportTarget}.`;
  }

  if (metaversePresenceWebTransportTarget !== null) {
    return `Configured WebTransport target ${metaversePresenceWebTransportTarget}.`;
  }

  return "No WebTransport endpoints configured.";
}

function createDeveloperReport(hudSnapshot: MetaverseHudSnapshot): string {
  const authoritativeLocalPlayer =
    hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer;
  const combatAction = authoritativeLocalPlayer.combatAction;
  const heldWeaponGrip = hudSnapshot.telemetry.localHeldWeaponGrip;

  const sections = [
    {
      heading: "Metaverse developer report",
      lines: [
        `Lifecycle: ${hudSnapshot.lifecycle}`,
        `Boot phase: ${hudSnapshot.boot.phase.replaceAll("-", " ")}`,
        `Presence: ${hudSnapshot.presence.state} · ${hudSnapshot.presence.remotePlayerCount} remote`,
        `Handshake: ${formatTopLevelHandshakeDebugLine(hudSnapshot)}`
      ]
    },
    {
      heading: "Renderer",
      lines: [
        `Frame: ${formatCount(hudSnapshot.telemetry.renderedFrameCount)} · ${hudSnapshot.telemetry.frameRate.toFixed(1)} fps`,
        `DPR: ${hudSnapshot.telemetry.renderer.devicePixelRatio.toFixed(2)}`,
        `Draw calls: ${formatCount(hudSnapshot.telemetry.renderer.drawCallCount)}`,
        `Triangles: ${formatCount(hudSnapshot.telemetry.renderer.triangleCount)}`
      ]
    },
    {
      heading: "Authority",
      lines: [
        `Tick / poll: ${formatOptionalMilliseconds(hudSnapshot.telemetry.worldCadence.authoritativeTickIntervalMs)} · ${formatOptionalMilliseconds(hudSnapshot.telemetry.worldCadence.worldPollIntervalMs)}`,
        `Snapshot path: ${formatSnapshotStreamPath(hudSnapshot.transport.worldSnapshotStream.path)} · ${formatSnapshotStreamLiveness(hudSnapshot.transport.worldSnapshotStream.liveness)} · ${formatCount(hudSnapshot.telemetry.worldSnapshot.bufferDepth)} buffered · ${formatOptionalRateHz(hudSnapshot.telemetry.worldSnapshot.latestSnapshotUpdateRateHz)}`,
        `Age / offset: ${formatOptionalMilliseconds(hudSnapshot.telemetry.worldSnapshot.latestSimulationAgeMs)} · ${formatOptionalMilliseconds(hudSnapshot.telemetry.worldSnapshot.clockOffsetEstimateMs)}`
      ]
    },
    {
      heading: "Traversal",
      lines: [
        `Local locomotion routing: ${hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local.locomotionMode} · ${formatDecisionReason(hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local.decisionReason)}`,
        `Authority / ack: ${authoritativeLocalPlayer.locomotionMode === null ? "n/a" : `${authoritativeLocalPlayer.locomotionMode} · ack ${formatCount(authoritativeLocalPlayer.lastProcessedTraversalSequence ?? 0)}`}`,
        `Combat / ack: ${combatAction.highestProcessedPlayerActionSequence === null ? "n/a" : `ack ${formatCount(combatAction.highestProcessedPlayerActionSequence)} · ${combatAction.status ?? "none"} · action ${formatCount(combatAction.actionSequence ?? combatAction.highestProcessedPlayerActionSequence)} · projectile ${combatAction.sourceProjectileId ?? "n/a"} · reject ${combatAction.rejectionReason ?? "none"} · shot ${combatAction.shotResolution?.finalReason ?? "n/a"}`}`,
        `Projectile FX: ${formatProjectilePresentationDebug(hudSnapshot)}`
      ]
    },
    {
      heading: "Grip",
      lines: [
        `Status: ${formatHeldWeaponGripStatus(hudSnapshot)} · ${heldWeaponGrip.attachmentMountKind}`,
        `Weapon / aim: ${heldWeaponGrip.weaponId ?? "n/a"} · ${heldWeaponGrip.aimMode ?? "n/a"} · ads ${heldWeaponGrip.adsBlend?.toFixed(2) ?? "n/a"}`,
        `Sockets: mount ${heldWeaponGrip.heldMountSocketName ?? "n/a"} · main ${heldWeaponGrip.mainHandSocket} · off ${heldWeaponGrip.offHandSocket} · secondary contact ${formatBooleanFlag(heldWeaponGrip.secondaryGripContactAvailable)} · off-hand mount ${formatBooleanFlag(heldWeaponGrip.offHandGripMounted)}`,
        `Main: active ${formatOptionalCentimeters(heldWeaponGrip.mainHandGripErrorMeters)} · grip cmp ${formatOptionalCentimeters(heldWeaponGrip.mainHandGripSocketComparisonErrorMeters)} · palm cmp ${formatOptionalCentimeters(heldWeaponGrip.mainHandPalmSocketComparisonErrorMeters)}`,
        `Main stages: solve ${formatOptionalCentimeters(heldWeaponGrip.mainHandSolveErrorMeters)} · post pole ${formatOptionalCentimeters(heldWeaponGrip.mainHandPostPoleBiasErrorMeters)} · final ${formatOptionalCentimeters(heldWeaponGrip.mainHandGripErrorMeters)} · pole ${formatOptionalDegrees(heldWeaponGrip.mainHandPoleAngleRadians)}`,
        `Reach: target ${formatOptionalCentimeters(heldWeaponGrip.mainHandTargetDistanceMeters)} · max ${formatOptionalCentimeters(heldWeaponGrip.mainHandMaxReachMeters)} · clamp ${formatOptionalCentimeters(heldWeaponGrip.mainHandReachClampDeltaMeters)} · slack ${formatOptionalCentimeters(heldWeaponGrip.mainHandReachSlackMeters)}`,
        `Pose branches: ads anchor ${formatBooleanFlag(heldWeaponGrip.adsAnchorPoseActive)} · support palm ${formatBooleanFlag(heldWeaponGrip.supportPalmHintActive)} · off-hand ${heldWeaponGrip.offHandTargetKind} · profile ${heldWeaponGrip.poseProfileId ?? "n/a"} · weapon state ${formatBooleanFlag(heldWeaponGrip.weaponStatePresent)}`,
        `Off hand: pre ${formatOptionalCentimeters(heldWeaponGrip.offHandPreSolveErrorMeters)} · solve ${formatOptionalCentimeters(heldWeaponGrip.offHandInitialSolveErrorMeters)} · final ${formatOptionalCentimeters(heldWeaponGrip.offHandFinalErrorMeters)} · pole ${formatOptionalDegrees(heldWeaponGrip.offHandPoleAngleRadians)} · refine ${formatCount(heldWeaponGrip.offHandRefinementPassCount)}`,
        `Diagnosis: ${formatHeldWeaponMainHandDiagnosis(heldWeaponGrip)}`,
        `Degraded: ${heldWeaponGrip.lastDegradedReason ?? "none"} · ${formatOptionalMilliseconds(heldWeaponGrip.lastDegradedAgeMs)} ago · ${formatCount(heldWeaponGrip.degradedFrameCount)} total`
      ]
    },
    {
      heading: "Transport",
      lines: [
        `Presence reliable: ${formatReliableTransportSummary(hudSnapshot.transport.presenceReliable)}`,
        `World reliable: ${formatReliableTransportSummary(hudSnapshot.transport.worldReliable)}`,
        `World snapshot stream: ${formatSnapshotStreamSummary(hudSnapshot.transport.worldSnapshotStream)}`,
        `World latest-wins datagram: ${formatDatagramTransportSummary(hudSnapshot.transport.worldDriverDatagram)} · ${formatCount(hudSnapshot.telemetry.worldSnapshot.datagramSendFailureCount)} send failures`,
        `World debug: ${formatReliableHandshakeDebugLine(hudSnapshot.transport.worldReliable, metaverseWorldWebTransportTarget)}`
      ]
    }
  ];

  return sections
    .map((section) => [section.heading, ...section.lines].join("\n"))
    .join("\n\n");
}

export {
  createDeveloperReport,
  formatCount,
  formatDatagramHandshakeDebugLine,
  formatDatagramTransportSummary,
  formatDecisionReason,
  formatHeldWeaponMainHandDiagnosis,
  formatHeldWeaponGripStatus,
  formatOptionalCentimeters,
  formatOptionalDegrees,
  formatOptionalMilliseconds,
  formatOptionalRateHz,
  formatReliableHandshakeDebugLine,
  formatReliableTransportSummary,
  formatSnapshotStreamDebugLine,
  formatSnapshotStreamLiveness,
  formatSnapshotStreamPath,
  formatSnapshotStreamSummary,
  formatTopLevelHandshakeDebugLine,
  formatTransportError,
  formatTransportStatus,
  metaversePresenceWebTransportTarget,
  metaverseWorldWebTransportTarget,
  type DatagramTransportSnapshot,
  type ReliableTransportSnapshot,
  type SnapshotStreamTransportSnapshot
};
