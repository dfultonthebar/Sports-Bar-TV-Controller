---
description: Multi-team adversarial audit of any subsystem using the Red/Blue/White/Green/Orange/Purple security taxonomy. Dispatches each team as a parallel agent and synthesizes findings into shippable fixes.
---

# team-audit

Run a multi-team audit of any subsystem in this codebase using the
full color-coded taxonomy. Used today for the scheduler audit
(v2.55.39/40/41); generalize to ANY system the operator names.

## When to invoke

- Operator says "audit X" or "let's audit X"
- Operator explicitly asks for Red/Blue/Green/Orange/Purple teams
- A subsystem has been silently failing and we need a structured
  multi-lens investigation before shipping fixes

## The teams

| Color | Role | Output |
|---|---|---|
| **Red** | Adversarial — find bugs, silent failures, races, edge cases | `findings[]` — file:line + severity + fix_path |
| **Blue** | Current-state defender — document HOW it actually behaves now vs how it SHOULD | `findings[]` — code reality vs docs/CLAUDE.md gaps |
| **White** | Impartial referee — check architecture against docs, find drift / dead code | `findings[]` — design vs implementation gaps |
| **Purple** | Bridge between Red + Blue — refuse fixes that don't address BOTH the theoretical break AND the observed current state | Triage with rationale showing it survived both lenses |
| **Green** | Builder — implement the fixes Purple greenlit | Worktree commits, version bumps, VERSION_SETUP_GUIDE entries |
| **Orange** | Secure-by-design probe of Green's commits — verify the fix doesn't introduce new attack surface or regress observed behavior | Per-fix verdict: SECURE-BY-DESIGN / REGRESSED / NEW_ATTACK_SURFACE |
| (Grok) | Optional final review before merge | GO / NO-GO + blocker list |

## How to dispatch (Workflow)

ALWAYS use the `Workflow` tool — these audits are heavy, multi-phase,
and benefit from deterministic orchestration. Skip the Workflow tool
only if the audit is tiny (≤2 issues) and one agent can cover it.

### Standard phases

```
Phase 1: Discovery (Red + Blue + White in parallel)
Phase 2: Purple triage — synthesize, rank by impact × likelihood, write fix plans
Phase 3: Green build (one worktree per top-3 ranked issue, in parallel)
Phase 4: Orange probe (one per Green branch, in parallel)
Phase 5: (Optional) Grok final review
```

### Workflow script skeleton

See `.claude/workflows/scripts/scheduler-audit-rwbg-grok-*.js` for a
working reference. Key shape:

```javascript
phase('Discovery (Red/Blue/White in parallel)')
const [red, blue, white] = await parallel([
  () => agent(`${SHARED_BACKGROUND}\n\nYou are the RED team — adversarial. ...`, { schema: FINDINGS_SCHEMA, label: 'red-team', agentType: 'feature-dev:code-explorer' }),
  () => agent(`${SHARED_BACKGROUND}\n\nYou are the BLUE team — current-state. ...`, { schema: FINDINGS_SCHEMA, label: 'blue-team', agentType: 'feature-dev:code-explorer' }),
  () => agent(`${SHARED_BACKGROUND}\n\nYou are the WHITE team — referee. ...`, { schema: FINDINGS_SCHEMA, label: 'white-team', agentType: 'feature-dev:code-explorer' }),
])

phase('Purple triage')
const purple = await agent(`You are PURPLE — the bridge. Inputs:
RED: ${JSON.stringify(red)}
BLUE: ${JSON.stringify(blue)}
WHITE: ${JSON.stringify(white)}

For each finding to keep, write a rationale showing it survived BOTH
the Red lens (theoretical break) AND the Blue lens (observed current
behavior). REJECT findings that only one lens supports — they're
either speculative or stale-state.

Rank by impact × likelihood. Cap at top 5.`, { schema: TRIAGE_SCHEMA, label: 'purple-triage' })

phase('Green build')
const green = await parallel(purple.ranked.slice(0,3).map((issue, idx) => () =>
  agent(`You are GREEN. Implement: ${JSON.stringify(issue)}. ...`, {
    label: `green-${idx}`,
    agentType: 'claude',
    isolation: 'worktree',
  })
))

phase('Orange probe')
const orange = await parallel(green.map((report, idx) => () =>
  agent(`You are ORANGE — secure-by-design probe of Green's commit.
Target worktree: ${WORKTREE_PATH_FOR(idx)}
What Green built: ${report}

Red angles to probe AT THE NEW CODE: ...`, {
    label: `orange-${idx}`,
    agentType: 'feature-dev:code-reviewer',
  })
))
```

## Shared background each team needs

Always include in the prompt:
- Repo path: `/home/ubuntu/Sports-Bar-TV-Controller`, branch context
- Specific subsystem under audit (entry points, key tables, watchers)
- Operator-reported failures with concrete log lines / DB evidence
- Read-only constraints (don't push, don't restart PM2, don't mutate prod DB)

## Things to avoid

- **Don't dispatch Orange or Green without Purple first.** Purple's
  rationale-per-finding is what prevents Green from chasing
  theoretical-only bugs.
- **Don't skip White.** The architecture-vs-docs drift it finds is
  often the root cause of the bugs Red surfaces.
- **Don't merge a Green branch on Orange's silence.** If Orange says
  "I checked the wrong worktree" or "the fix doesn't exist", verify
  manually before merging — Orange agents have been wrong before
  (mis-identified worktree numbers in the scheduler audit).
- **Don't cap to one team per finding.** A high-impact finding may
  need both Red AND Green attention; let Purple decide.

## Output format (operator-facing)

After the workflow completes, summarize:
- Discovery counts (Red N, Blue M, White P findings)
- Triage top-N with severity
- Green built (worktree branches + version bumps)
- Orange verdicts (per Green)
- Final merge order + version range
- Operator action required (if any)
