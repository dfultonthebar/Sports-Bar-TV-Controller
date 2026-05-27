# When the System Notices Your Pattern — Override-Learn

**For:** the bartender who keeps making the same correction (e.g. "the Packers always go on TV 7, not TV 12") and the iPad pops up a suggestion to make it permanent.
**Goal:** understand the suggestion, apply it (or dismiss it), and stop fighting the schedule.
**Time to fix:** about 30 seconds.
**You can't break it:** if you Apply a suggestion that turns out to be wrong, you just override it the next time and the system learns again. Try things.

---

## When you'd use this

You've manually corrected the same routing three or four times in the last 10 minutes. The system notices and pops up a small widget at the top of the iPad: **"Bartender override learned — apply this as a permanent rule?"** or **"You moved the Bears game off TV 12 three times this month — apply?"**

You don't *have* to do anything when the widget appears. You can dismiss it and keep working. But if the correction is genuinely how things should be from now on, applying it stops the system from making the same wrong assignment next week.

---

## Where Override-Learn shows up

There are two places you'll see it:

1. **A floating widget at the top of the Video or Schedule tab** — appears when the system detected a fresh pattern (within the last 10 minutes). The widget reads something like: *"Saw you switch the Packers game from TV 12 to TV 7 — apply as the default?"* with **Apply** and **Dismiss** buttons.

2. **A "Scheduler corrections" card near the bottom of the Schedule tab** — shows learned patterns over the last few weeks: *"Bartenders moved the Bears game off TV 12 three times this month."* with an **Apply** button to make that pattern permanent.

The widget version is more urgent (active right now). The card version is a slower review of older patterns.

---

## What "applying a suggestion" actually does

When you tap **Apply**:

- The system updates the future-game preferences to match the pattern.
- Next time a Packers (or Bears, etc.) game is on the Schedule tab, the AI Suggest feature will pick TV 7 by default instead of TV 12.
- The change persists across shifts and bartenders — until someone overrides it again.

Applying doesn't change anything happening right now. It's a forward-looking adjustment.

---

## Step-by-step — applying a suggestion

1. The widget pops up (or you spot a Scheduler-corrections card you want to action).
2. Read the suggestion. It will say something like: *"Apply: Packers games default to TV 7 (instead of TV 12)?"*
3. **Make sure it matches what you actually want.** If the suggestion is right, tap **Apply**. If it's wrong, tap **Dismiss**.
4. After Apply, the widget closes. A small confirmation banner appears: *"Override applied — Packers games will default to TV 7 going forward."*

That's the whole thing.

---

## Step-by-step — dismissing a suggestion

If the suggestion is wrong (you only moved the game by accident, or the customer asked for a one-off change), just tap **Dismiss**. The widget closes. The system records that you saw and rejected the pattern, so it won't keep nagging you about the same one.

If a Scheduler-corrections card looks wrong, you can usually tap an X on the row to dismiss it (the X is small — look in the corner of the card).

---

## When the widget appears: the 10-minute window

The system uses a **10-minute window** to detect "you're correcting the schedule." Within 10 minutes of a scheduled tune (the kickoff of a game), if you switch the TV manually:

- If your manual change matches the schedule's intent (you moved the Packers from a wrong TV to a right TV), it's recorded as a **correction**. The system may suggest making it permanent.
- If your manual change is unrelated (you switched a TV to something completely different), it's not learned.

**After the 10-minute window**, your manual changes are treated as unrelated activity, not corrections. So the widget only appears for changes made within that window.

This is why over-using manual overrides on already-scheduled games can fill the system with "noise" — every override gets recorded as a correction, even ones you'd consider routine. If you find yourself manually overriding the same game three times in a row, **fix the schedule entry instead** (**[[SCHEDULING_GAMES_AHEAD]]**) — it's faster and doesn't pollute the learning data.

---

## How you know it worked

- After tapping Apply, you see a confirmation banner.
- The Schedule tab's "Scheduler corrections" card no longer shows that pattern (it's been resolved).
- The next time AI Suggest runs for a Packers game (or whatever team), it picks the TV you taught it to pick.

---

## If this didn't work

- **The suggestion is wrong** (Packers should NOT default to TV 7) → tap **Dismiss**. The system stops suggesting that specific change. Continue routing manually for now. Over time, your corrections will teach a different default.
- **I applied but the next game still goes to the old TV** → AI Suggest uses learned patterns as one input among several (home-team priority, TV size, customer-pattern data). It may still pick differently. To force a specific TV every time, use the **Schedule** tab and assign manually instead — that overrides AI Suggest entirely.
- **Where do I see what Override-Learn knows?** → tap **More → Schedule → Scheduler corrections** card at the bottom. It lists recent learned patterns. If you see something that looks wrong, tap to inspect and either re-apply or dismiss.
- **The widget keeps popping up for the same change every time I work** → that means your corrections aren't being recorded (the Apply tap isn't sticking, or the data didn't save). Try Apply again and watch for the confirmation banner. If you don't see the banner, something's wrong — text the manager.
- **I can't find the widget** → it only appears for ~30 seconds after a corrective change. If you missed it, the same correction will be captured next time you make it within the 10-min window. Or look at the Scheduler corrections card on the Schedule tab — same data, slower view.
- **I want to undo an Override-Learn I applied** → go to **More → Schedule → Scheduler corrections**. The applied pattern shows there. Some bars allow a one-tap revert; if not, the next time you make a different correction within the 10-min window, the new pattern will overwrite the old one.

---

## What NOT to do

- **Don't manually override the same TV ten times in a row.** Each override gets logged as a correction, and the Scheduler digest becomes a mess. If you need a permanent fix, edit the Schedule entry directly (**[[SCHEDULING_GAMES_AHEAD]]**) or apply the next override-learn suggestion.
- **Don't tap Apply on every suggestion that pops up.** Read what it actually says first. Half the time you'll agree, half the time it's a one-off and you should Dismiss.
- **Don't worry about "training the AI wrong."** The system continuously learns. A bad pattern gets overwritten by your next correction within a few weeks of normal operation.

---

## When to text the manager

- The widget keeps appearing for the same suggestion even after you Apply.
- A Scheduler-corrections card shows a pattern you can't tell what means ("Bartenders moved game X — apply?" but no team or TV listed).
- You suspect Override-Learn has applied a wrong default that's causing repeat issues across shifts.
- You want to wipe all learned patterns and start fresh (only the manager can do this).

Include: screenshot of the Scheduler corrections card or widget, a one-sentence description of what's happening.

---

## Related

- **[[SCHEDULING_GAMES_AHEAD]]** — assigning TVs explicitly (bypasses Override-Learn entirely).
- **[[PUTTING_GAMES_ON_TVS_VIDEO_TAB]]** — manual route on a single TV.
- **[[FINDING_A_LIVE_GAME]]** — find a live game and route it via the Guide tab.
- **[[SHIFT_BRIEF_AT_CLOCK_IN]]** — heads-up on what the system noticed in the last shift.
