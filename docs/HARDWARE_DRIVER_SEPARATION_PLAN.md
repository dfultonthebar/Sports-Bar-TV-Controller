# Hardware Driver Separation Plan

> **STATUS: DRAFT v1 — AI-generated, NEEDS HUMAN REVIEW.**
> Generated 2026-06-21 by the local **qwen2.5:14b** (off-hours T4 via Hermes infra), grounded in the
> actual codebase: the `input_sources` / `MatrixInput` / per-family device-table schema, the
> distribution-engine's `matrix_input_id`→`channelNumber` **two-lineage** resolution comment, the
> full 43-package layout, `device-db.ts` loaders, and `@sports-bar/logger`.
> **Tracking todo:** c81fc929-9abe-473b-88e1-fbc9f8f8d2af.
>
> **Known gaps to resolve in review / v2 (a deeper Grok-4 pass is queued to enrich these):**
> per-family **tables vs. views** trade-off for preserving the matrix_input_id resolution;
> step-by-step migration mechanics; concrete per-family logging-channel mechanism; how the
> already-separated control packages (`@sports-bar/firecube|directv|atlas|...`) plug into the new
> per-family driver/health contract.

---

# Design Plan: Separating Sports-Bar TV Controller's Hardware Drivers Per Device Family

## Summary
To enable developers to debug one device type in isolation, this plan focuses on separating cross-cutting layers (data model, logging, health, diagnostics) per hardware family. The existing control packages are already separated by family, so the focus is on unifying and isolating shared components.

## Current Problems
- `input_sources` table contains mixed data for all families, leading to issues like duplicate rows, orphaned entries, and inconsistent matrix_input_id resolution.
- Logging is aggregated into a single stream, making it hard to isolate logs by device family.
- Health monitoring is aggregated without per-family contracts, causing noise from excluded components (e.g., projector).
- Next.js App Router route handlers bundle separately, requiring careful management of singleton instances for cross-route managers.

## 1. DATA MODEL
### Unify `matrix_input_id` Mapping to One Lineage
- **Step 1:** Create a new table `input_sources_family` per device family (e.g., `cable_box_sources`, `directv_sources`, `firetv_sources`) with columns mirroring `input_sources`.
- **Step 2:** Migrate existing data from `input_sources` to the respective family-specific tables, resolving matrix_input_id lineage issues:
  - For CableBox: Use `matrixInputId` in `cableBoxes` table.
  - For DirecTVDevice: Use `inputChannel` in `direcTVDevices`.
  - For FireTVDevice: Use `inputChannel` in `fireTVDevices`.
- **Step 3:** Deprecate and remove the mixed `input_sources` table, ensuring all references are updated to use family-specific tables.

### Give Projector a Home
- **Step 1:** Create a new device table `epsonProjectors` with columns mirroring existing health monitoring data.
- **Step 2:** Migrate projector-related entries from health monitoring into the new `epsonProjectors` table.
- **Step 3:** Update health monitoring to reference this new table for projector-specific checks.

## 2. DRIVER/SERVICE INTERFACE
### Uniform Per-Family Driver and Health/Status Contract
- **Step 1:** Define a uniform interface contract for each family's driver/service, including methods for initialization, status retrieval, and health checks.
- **Step 2:** Implement these contracts in respective packages (e.g., `@sports-bar/directv`, `@sports-bar/firetv`).
- **Step 3:** Ensure singleton instances are hoisted to globalThis via Symbol.for() to respect Next.js App Router route handler bundling.

## 3. SCOPED LOGGING
### Per-Family Channels/Files atop [COMPONENT] Tags
- **Step 1:** Create per-family logging channels (e.g., `directv_logger`, `firetv_logger`) that inherit from the existing logger.
- **Step 2:** Implement a mechanism to route logs based on family-specific tags and component types.
- **Step 3:** Update loggers in respective packages to use these new scoped channels.

## 4. DIAGNOSTIC SURFACE
### Per-Family Diagnostics View
- **Step 1:** Develop per-family diagnostic views that aggregate health, status, and logs from the respective family's components.
- **Step 2:** Integrate these views into the existing UI framework (e.g., `ui-utils`).

## 5. STAGED MIGRATION
### One Family at a Time
- **First Family: DirecTV**
  - **Reasoning:** DirecTV has well-defined device tables (`DirecTVDevice`) and is less complex compared to Fire TV or CableBox.
  - **Steps:**
    - Implement data model changes for `directv_sources`.
    - Update driver/service interface for DirecTV.
    - Integrate scoped logging and diagnostics views.

## Risks & Open Questions
- **Risk:** Data migration could introduce inconsistencies if not thoroughly tested.
- **Question:** How to handle existing legacy data that doesn't fit the new schema cleanly?
- **Risk:** Singleton management in Next.js route handlers might lead to subtle bugs if not carefully managed.
- **Question:** What is the best approach for backfilling historical health monitoring data into family-specific tables?