# AtlasIED Atmosphere AZM8 — Documentation Index

Public AtlasIED Atmosphere documentation, fetched 2026-05-18 and converted to markdown for RAG indexing. Source PDF URLs are at the top of each file.

| File | Topic | Source |
|---|---|---|
| [`AZM4-AZM8-third-party-control-protocol.md`](./AZM4-AZM8-third-party-control-protocol.md) | JSON-RPC TCP 5321 / UDP 3131 protocol spec — methods, parameter list, ranges, keep-alive, dynamic message table | atlasied.com — ATS006993 RevB |
| [`Atmosphere-firmware-release-notes.md`](./Atmosphere-firmware-release-notes.md) | Firmware release notes v1.1 → v4.5 — including v4.5 **Custom Priority Volume** | atlasied.com — ATS007022 RevL |
| [`AZM8-user-guide-physical-IO-scenes-priority.md`](./AZM8-user-guide-physical-IO-scenes-priority.md) | Physical I/O, Scenes/Routines, Zone Priority page, GPIO, accessories — curated from the 125-page user manual | atlasied.com — ATS006332 RevE |
| [`Crestron-Atlas-Atmosphere-command-processor-help.md`](./Crestron-Atlas-Atmosphere-command-processor-help.md) | Crestron SIMPL module v1.0 — confirms protocol behavior, integration patterns | applicationmarket.crestron.com |
| [`RTI-Atlas-Atmosphere-driver-notes.md`](./RTI-Atlas-Atmosphere-driver-notes.md) | RTI driver v2.22 — confirms ports, supported devices, integrator-specific quirks | driverstore.rticontrol.com |
| [`atlas-ai-knowledge-base.pdf`](./atlas-ai-knowledge-base.pdf) | (pre-existing) AtlasIED AI knowledge base | (binary, not indexed) |
| [`ATLAS_PHYSICAL_CONFIGURATION_PUBLIC.md`](./ATLAS_PHYSICAL_CONFIGURATION_PUBLIC.md) | (pre-existing) Our public-safe Atlas physical configuration summary | internal |

## Related codebase docs

- `packages/atlas/README.md` — Our `ExtendedAtlasClient` implementation (TCP 5321 + UDP 3131, hoisted singleton, meter manager, drop watcher, priority watcher)
- `CLAUDE.md` §7 — Atlas TCP+UDP architecture summary
- `CLAUDE.md` Gotcha #10 — Next.js per-bundle singleton hoist for socket managers
- Memory note `feedback_atlas_azm8_no_priority_param.md` — Why no `PriorityActive` parameter exists; infer from `SourceMeter_N` + `ZoneSource_N`
- Memory note `feedback_atlas_firmware_4_5_custom_priority_volume.md` — Custom Priority Volume in 4.5+ mimics a drop signature; check Atlas GUI before treating drop spam as a watcher bug
- Memory note `feedback_watcher_cache_after_action.md` — v2.42.1 fix: update `lastSeen` immediately after the read so a throwing INSERT doesn't strand the cache and re-fire 50 false drops

## How this was assembled

PDFs fetched with `curl` from public atlasied.com / Crestron / RTI URLs (no auth required), converted with `pdftotext -layout` (poppler-utils 24.02), then hand-transcribed into markdown preserving every parameter, range, command example, and version note. The RTI driver page is HTML and was extracted by WebFetch directly.

The full source PDFs are NOT committed — they're 35 MB combined and live in `/tmp/atlas-pdfs/` during the fetch session. Re-fetch with `bash scripts/scan-system-docs.ts` (or re-run the commands in this commit's notes) if the source documents update.
