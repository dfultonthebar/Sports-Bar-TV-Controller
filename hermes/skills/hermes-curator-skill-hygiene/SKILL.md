---
name: hermes-curator-skill-hygiene
description: Use the Hermes Curator to prune stale auto-generated skills and pin canonical ones, cutting token cost and context rot.
version: 1.0.0
author: Sports-Bar TV Controller
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [curator, skills, token-savings, context-hygiene, maintenance]
---

# Hermes Curator — Skill Hygiene

The self-improving loop generates skills automatically; left unchecked they pile
up, load into every prompt, and cause context rot + real token spend. The Curator
fixes that. (Source: David Andre "7 Levels of Hermes" — Level 3.)

**On this box the Curator is ALREADY ENABLED** — interval every 7d, `stale after`
30d unused, `archive after` 90d unused. So this skill is about *driving* it
correctly, not turning it on.

## Real verbs (verified on this box)
`hermes curator {status,run,pause,resume,pin,unpin,restore,list-archived,archive,prune,backup,rollback}`

## Workflow

### 1. Check state
```bash
hermes curator status            # enabled?, last run, interval, stale/archive thresholds
```

### 2. Preview before any bulk action (never prune blind)
```bash
hermes curator run --dry-run     # what WOULD be consolidated/archived this cycle
```

### 3. Protect canonical, hand-authored skills from auto-prune — PIN them
The Curator archives *agent-created* skills idle >= N days. Pin anything we wrote
by hand and want kept regardless of use frequency (seasonal/ops playbooks):
```bash
hermes curator pin sports-bar-troubleshooting
hermes curator pin sports-bar-investigate
hermes curator pin sports-bar-shift-check
hermes curator pin sports-bar-rf-response
hermes curator pin crystallize-runbook-skill
hermes curator pin fleet-heartbeat-watch
hermes curator pin session-recall
hermes curator pin hermes-self-backup-to-github
hermes curator pin hermes-curator-skill-hygiene
```

### 4. Recover if the Curator archived something still wanted
```bash
hermes curator list-archived
hermes curator restore <skill-name>     # or: hermes curator rollback
```

### 5. Periodic review (monthly is enough)
```bash
hermes curator status
hermes skills list                       # eyeball low-use skills before they age out
```

## Why this matters
- **Token cost:** dead skills loaded every prompt = recurring spend for zero value.
- **Attention:** fewer, relevant skills = sharper, less-distracted responses.
- **Safety net:** PIN canonical skills so an auto-prune never silently removes a
  load-bearing runbook that just happened to go quiet.

## Notes
- If a deleted skill keeps regenerating, the loop still finds it useful — promote
  it to a permanent pinned SKILL.md instead of fighting the Curator.
- `hermes curator backup` before a big manual `prune` so you can `rollback`.
