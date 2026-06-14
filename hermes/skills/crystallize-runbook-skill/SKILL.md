---
name: crystallize-runbook-skill
description: After resolving a novel ops incident, distill the working fix into a new reusable SKILL.md runbook and prune stale ones.
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [ops, self-improvement, skills, runbook, incident-response, curation]
---

# Crystallize Runbook Skill

Turn a problem you just struggled through into a durable, reusable skill — the
way a human writes down a fix after solving it the hard way. Run this AFTER an
incident is verified-resolved, not during firefighting. (Source: NetworkChuck
"5 reasons I switched to Hermes" — the self-improvement loop that auto-authors a
skill after first solving a task manually.)

## When to trigger

Self-trigger when ALL of these are true:
- You just resolved an operator-facing issue (TV black, route wrong, mic ghost
  override, Atlas drop, auto-update stall, Fire TV deep-link, etc.).
- The resolution took **more than one non-obvious step** OR relied on a
  device/location quirk not already captured in an existing skill.
- The fix is **verified working** — you saw the live result, not just a 200/curl
  (the house rule: verify with observed behaviour / Playwright, not status codes).

Do NOT crystallize one-liners, pure lookups, or anything an existing skill
already covers (check first — Workflow step 1).

## Workflow

1. **Dedupe.** `hermes skills list` and `ls ~/.hermes/skills/`. Grep the
   frontmatter `description` + `tags` for the device/symptom you just handled.
   If a skill already covers it, IMPROVE that file (append the new edge case to
   its body) and STOP.
2. **Extract the reusable core** from the just-solved session:
   - The **symptom signature** (what the operator/agent observed).
   - The **root cause** in one sentence.
   - The **minimal ordered fix steps** — strip anything incidental ("simpler is
     better"; no speculative steps).
   - The **verification step** that proved it worked.
   - Any **location-specific value** → do NOT hardcode it; reference the
     location's `.claude/locations/<branch>.md` / the DB row instead, since IPs
     and offsets drift per location.
3. **Write** `~/.hermes/skills/<kebab-name>/SKILL.md` with frontmatter:
   `name` (kebab, symptom-led e.g. `fix-wolfpack-black-tv`), one-line
   `description`, `version: 1.0.0`, `author: Sports-Bar TV Controller`,
   `license: MIT`, `platforms: [linux]`, `metadata.hermes.tags` covering device
   family + symptom. Body: `## Symptom`, `## Root cause`, `## Fix` (numbered),
   `## Verify`. Tight — a runbook, not an essay.
4. **Pin it** so the Curator never auto-prunes a canonical runbook:
   `hermes curator pin <kebab-name>`.
5. **Mirror to the system of record.** Add a one-line entry to the System Admin
   Todos list (DB `Todo` table via the todos / propose_action MCP tool) naming
   the new skill and the incident it came from, marked COMPLETE — the operator's
   Todos list is the canonical status surface.
6. **Announce** to the operator on Telegram in one bartender-grade line:
   "I learned how to fix a black TV at Greenville and saved it as a reusable fix."

## Guardrails
- Crystallize from **success only** — never encode a guessed/unverified fix.
- One incident → at most one new skill. If it sprawls, the incident wasn't
  actually understood yet.
- Location-specific values stay as references, never baked into a shared skill.
- If unsure whether to create vs. improve, default to improving an existing skill.
