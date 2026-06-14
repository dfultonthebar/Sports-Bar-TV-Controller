# The Shift Brief — Read This When You Clock In

**For:** every bartender, at the start of every shift.
**Goal:** know what's coming tonight in 60 seconds.
**Time to read:** about a minute.
**You can't break it:** the Shift Brief is read-only — looking at it does nothing to the bar. Read freely.

---

## When you'd use this

Every shift. As soon as you walk behind the bar and wake up the iPad. The Shift Brief is the system's heads-up to you: tonight's big games, any wireless mic interference seen recently, any concerts or events nearby that might cause problems, and a quick recap of last night's shift so you know what carried over.

A minute spent reading the brief saves you from being blindsided at 7pm when the Packers fans show up expecting the game on TV 7 — you already knew.

---

## Where the Shift Brief lives

On the iPad behind the bar, tap **Video** at the bottom. The Shift Brief sits **at the top of the screen as a purple-bordered card** before the floorplan. You can't miss it — it's the first thing on the page.

Sometimes it's collapsed to a single line (just the date + a "Show more" link). Tap **Show more** to expand it.

---

## What each section tells you

The brief is broken into clearly-labeled sections. You don't need to read every one — skim the section titles, dive into the ones that matter for tonight.

### Tonight's games

A short list of the live sports playing tonight, in order of priority. Home teams (Packers, Brewers, Bucks, Badgers) bubble to the top. Each game shows the matchup, the start time, and the channel.

**Example:** "Packers vs Bears, 7:20 PM, Channel 5 (Fox). Bucks @ Knicks, 7:30 PM, Channel 40."

Read this first. It tells you what to expect customers to ask about.

### Wireless mic status (one-liner)

A single sentence about the bar's house wireless mic system. The bar uses this mic for paging, hosted events (trivia, MC, manager announcements), and any in-house entertainment. **Karaoke crews bring their own mics — that's not what this section is about.**

You'll see one of these:

- "Mic status: good" → mic system is healthy, no action needed.
- "Mic status: low battery on Channel 1" → time to swap batteries before service. See **[[MIC_NOT_WORKING]]**.
- "Mic status: RF interference seen in the last 24h" → there's been a ghost signal or stray RF on our mic frequencies. Heads-up: may flicker again tonight. See **[[RF_INTERFERENCE_FOR_BARTENDERS]]**.

### Heads-up bullets (nearby events)

The system scans nearby venues — Lambeau, Resch Center, EPIC, the small bars within a mile — for events tonight and the next few days. Anything that could create extra paging traffic, RF interference, or unusual crowds gets a bullet here.

**Example:** "Concert at Lambeau tonight, 7pm — expect heavy radio chatter near stadium." Or: "Trivia night at the bar next door, 8pm — possible mic interference."

This isn't always actionable, but it's good to know.

### Atlas priority recap (last night)

The bar's audio system tracks every time the priority mic (paging, hosted events, manager announcements) was triggered. The brief shows yesterday's count. If the number is unusually high, you know last night's bartender used the mic a lot — maybe there was an event you should know about.

**Example:** "Yesterday: 12 mic-key events, 0 RF-induced ghost events, 2 unexpected source overrides."

If you see "RF-induced ghost events: 5+" — that's worth a quick read of **[[RF_INTERFERENCE_FOR_BARTENDERS]]** so you know what to do if it happens tonight.

### Anything else

Other sections may appear: scheduled games auto-tuning tonight (from the Schedule tab), DJ Mode notes if a hosted event is queued, override-learn suggestions (see **[[OVERRIDE_LEARN]]**). These rotate based on what's actually going on.

---

## The Refresh button

The brief is generated fresh every 10 minutes. If you walked in 5 minutes after the last refresh, it'll already be current — no action needed.

If the brief looks stale (says "last night" but you're starting a Sunday morning shift, or mentions a game that ended hours ago), tap the **Refresh** button at the top-right of the card. It rebuilds the brief from scratch. Takes about 10-30 seconds (the local AI is doing the work).

You'll see a spinner during refresh. **Don't tap Refresh again** — let the first one finish.

---

## What to act on first

You don't have to do anything based on the brief — it's a heads-up, not a task list. But if you do want to act:

1. **Mic warning?** Swap mic batteries before service starts. See **[[MIC_NOT_WORKING]]**.
2. **Big game tonight?** Open the **Schedule** tab and queue up the TVs ahead of kickoff. See **[[SCHEDULING_GAMES_AHEAD]]**.
3. **Nearby concert?** Be ready for the mic to get crackly if RF interference rolls in. See **[[RF_INTERFERENCE_FOR_BARTENDERS]]**.
4. **Quiet brief, normal night?** Just know what's on — you'll get to all of it as customers ask.

---

## If this didn't work

- **The brief is blank** → tap **Refresh**. If still blank after 30 seconds, the local AI may be offline. The brief will catch up on its next 10-minute cycle. In the meantime, glance at the **Guide** tab to see what live games are on tonight (see **[[FINDING_A_LIVE_GAME]]**).
- **It says mic issue but I tested fine** → the brief reports the last 24 hours of events. If the issue was last night and the mic works now, that's normal — the warning will roll off on the next refresh. If you're worried, do a quick test page and move on.
- **The games listed look wrong** → ESPN's data feeds the games list. If a game's start time is off, the league re-scheduled and the system hasn't pulled the update. Tap Refresh; if still wrong, fall back to the **Guide** tab for live data.
- **Same brief showing yesterday's info** → tap Refresh. If that fails, the AI may be stuck. The brief will still self-update on its 10-min schedule; meanwhile, work off the **Guide** and **Schedule** tabs directly.
- **A heads-up bullet mentions an event I know didn't happen** → some nearby-venue data comes from public-event scrapers that can be slightly off. Take it as a soft hint, not gospel. If multiple bullets look bogus, text the manager.

---

## What NOT to do

- **Don't tap Refresh repeatedly.** Each tap starts another 10-30 second AI job. One tap, wait for it.
- **Don't ignore the brief because it "looks long."** Most of it is short bullets — 60 seconds of skimming saves a lot of running around later.
- **Don't take the brief as instructions you must follow.** It's information, not orders. If a section conflicts with what you actually see (e.g. it says mic is fine but a customer says they can't be heard), trust what you see.

---

## Related

- **[[SCHEDULING_GAMES_AHEAD]]** — queueing up TVs for tonight's games.
- **[[MIC_NOT_WORKING]]** — the wireless mic isn't working.
- **[[RF_INTERFERENCE_FOR_BARTENDERS]]** — mic is crackly or cuts out (RF problems).
- **[[PRE_SHIFT_WALKTHROUGH]]** — the full clock-in checklist if you want more than just the brief.
