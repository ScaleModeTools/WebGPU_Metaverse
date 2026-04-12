# Localdev Docs

Role: index for local development notes.

Use one document role at a time:

| Type | Purpose |
| --- | --- |
| Canonical | How the system works now |
| Decision | Why the system has this shape |
| Plan | What we are doing next |

## Canonical

- `metaverse-canonical-rig.md`
- `metaverse-asset-delivery-rules.md`
- `metaverse-asset-pipeline.md`
- `metaverse-smooth-motion-validation.md`

## Decisions

- `decisions/decision-humanoid-v2.md`
- `decisions/decision-mesh2motion-intake.md`

## Plan

- `metaverse-smooth-motion-plan.md`
- `metaverse-webtransport-networking-plan.md`
- `metaverse-webtransport-datagram-plan.md`
- `metaverse-vehicle-seat-foundation-plan.md`

## Completed Slice Records

These are retained historical implementation records, not active plans:

- `metaverse-grounded-body-slice.md`
- `metaverse-grounded-collision-locomotion-slice.md`

## WebTransport Hookup

Current localdev WebTransport is no longer hidden only inside plan files.

- Code-near canonical reference:
  `../../client/src/network/README.md`
- Localdev boot path:
  `npm run dev` -> `tools/dev-server` -> generated
  `.local-dev/webgpu-metaverse-dev-client.env` -> `tools/dev-client`
- WSL NAT localdev now uses the active WSL guest IPv4 for the browser-facing
  WebTransport endpoint when mirrored networking is unavailable.
- The metaverse developer overlay now shows the active handshake target, so the
  browser-side WebTransport endpoint is visible in-app.

Use the network README when wiring:

- deployed `VITE_*_WEBTRANSPORT_URL` values
- public-cert versus certificate-hash setup
- the current production gap where the QUIC host still boots only through the
  localdev server adapter path
- AWS versus bare-metal routing decisions
