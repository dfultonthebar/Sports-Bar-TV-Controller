# DJ Mode — Locking TVs During Hosted Events

**For:** the bartender setting up for trivia night, a hosted band, an MC-led event, or anything where TVs MUST stay on a specific source through the whole event.
**Goal:** stop the regular schedule from changing TVs mid-event.
**Time to set up:** about a minute.
**You can't break it:** turn DJ Mode off at the end of the event and everything goes back to normal scheduling. Try things.

---

## When you'd use this

It's Tuesday night at 7pm. Trivia is starting. The host needs all the front-bar TVs locked on the trivia laptop's feed — no game, no music video, no scheduled TV switching mid-question. DJ Mode is the lock.

Other use cases: a hosted live band where the TVs play the band's promo video on loop, a manager's announcement event where TVs show a slideshow, a private party with their own AV feed. Anything where "the TVs need to stay put for the next 2-4 hours."

**Don't use DJ Mode for normal game nights.** If you just want games on TVs, the Schedule tab (**[[SCHEDULING_GAMES_AHEAD]]**) is the right tool. DJ Mode is specifically for *locking out* the schedule.

---

## Where DJ Mode lives

DJ Mode is on the admin side of the iPad — bartenders may or may not have direct access depending on how your bar's PIN is set up.

1. On the iPad, tap **More** at the bottom (three-dot icon).
2. Look for **DJ Mode** or **DJ Control Panel** in the list. Tap it.
3. If you don't see it, you don't have admin access. Ask the manager to enable DJ Mode for you, or have them log in to set it up.

---

## Step-by-step — turning DJ Mode on

1. Open the DJ Control Panel (**More → DJ Mode**).
2. You'll see a list of available audio sources (Atlas inputs — the audio processor's source list) and a TV picker.
3. **Pick the Atlas source** the event will run through. For trivia, this is often "Mic 1" or "DJ Input". For a hosted band, the source is whatever input the band's audio feed is plugged into. Ask the host or check the masking-tape labels on the audio rack.
4. **Pick the TVs** that should be locked. Tap each TV in the picker to add it. Most events lock 4-8 TVs — the ones in the event area.
5. Tap **Enable DJ Mode** (or **Start**).
6. The panel confirms with a green badge: "DJ Mode active on source X, locking N TVs."

During DJ Mode, those TVs **will not respond to the Schedule tab's auto-tunes**. Bartender manual routes still work (so you can adjust if a customer asks), but scheduled games on those TVs are suppressed.

---

## During the event

You can still use the iPad normally — change TVs that aren't locked, look at the Guide tab, do anything else. **The locked TVs just won't switch on their own.**

If a customer asks for a game on a locked TV during the event, you have two options:

1. **Switch a non-locked TV** — say "I've got that game on TV 9 over there" and route it manually using **[[PUTTING_GAMES_ON_TVS_VIDEO_TAB]]**.
2. **Unlock the TV temporarily** — open the DJ Panel, un-select that TV from the locked list, route what the customer wants, then re-add the TV when they're done. Only do this if the host is OK with the swap.

---

## Step-by-step — turning DJ Mode off

When the event ends, **don't forget this step**. Otherwise the TVs stay locked and tomorrow's bartender wonders why the schedule is broken.

1. Open **More → DJ Mode** on the iPad.
2. You'll see the green "DJ Mode active" badge.
3. Tap **Disable DJ Mode** (or **Stop**).
4. The badge clears. The scheduled-game system resumes control of those TVs.

That's it. The TVs are back in normal rotation.

---

## How you know it worked (DJ Mode on)

- The DJ Panel shows a green "DJ Mode active" badge.
- The locked TVs show the Atlas source you picked (often the host's mic feed or the DJ laptop).
- If a scheduled game on one of those TVs reaches its kickoff time during DJ Mode, the Schedule tab logs it as "skipped (DJ Mode)" but does not actually switch the TV.

---

## How you know it worked (DJ Mode off)

- The green badge clears.
- The TVs are now responsive to normal Schedule tab tunes.
- If you have a scheduled game queued, the TVs will switch to it at its kickoff time.

---

## If this didn't work

- **DJ Mode says "no Atlas processor"** → the audio processor connection is down. The audio system uses a processor in the rack (the Atlas box) to route sound. If the panel can't see it, the connection dropped. Try the panel again in 60 seconds — it usually reconnects. If still no, text the manager.
- **TVs aren't actually locked** (the schedule still switched them) → check that you tapped **Enable DJ Mode** (not just selected sources). The green badge must be showing. If the badge is there and TVs still flip, the system may have a stuck schedule entry — go to the Schedule tab and manually cancel the conflicting game.
- **I forgot to turn DJ Mode off after the event** → no harm done. Just open the DJ Panel and tap **Disable DJ Mode** now. The schedule resumes immediately. The next bartender will be fine.
- **DJ Mode is on but the audio is wrong** (host's mic isn't coming through) → DJ Mode locks the *video routing*, but the audio is its own thing. Check the audio mixer or the **[[AUDIO_ZONES_AND_GROUPS]]** doc. The lock-source feature in DJ Mode pins the Atlas source to those TVs but doesn't override the bar's main audio routing.
- **I can't find the DJ Mode menu** → it lives under **More**. If it's not there, your bartender PIN may not have admin access. Ask the manager.
- **The locked TVs went black** → the Atlas source you picked isn't outputting anything. Check that the host's gear is plugged in and powered. If you don't know which source is right, ask the host or check the masking-tape labels on the audio rack.

---

## What NOT to do

- **Don't enable DJ Mode and forget about it.** Set a reminder on your phone to disable it at the event's end. Persistent DJ Mode breaks the schedule for the next shift.
- **Don't lock every TV in the bar for a small event.** If trivia is in the front, lock the front TVs; leave the back TVs on regular schedule so customers who don't care about trivia still get the games.
- **Don't enable DJ Mode mid-game on a TV customers are watching.** They'll be confused when their game disappears. Plan ahead — turn it on before the event starts, when those TVs are between events.

---

## When to text the manager

- The DJ Panel won't load at all.
- DJ Mode says it's active but TVs are still being switched by the schedule.
- The Atlas source picker is empty (no sources listed).
- An event is starting in 10 minutes and you can't get the lock to work.

Include: which event, what time it starts, what you're trying to lock, screenshot of the DJ Panel.

---

## Related

- **[[SCHEDULING_GAMES_AHEAD]]** — normal scheduled-games flow (the thing DJ Mode locks out).
- **[[PUTTING_GAMES_ON_TVS_VIDEO_TAB]]** — manual routing on a single TV.
- **[[AUDIO_ZONES_AND_GROUPS]]** — managing audio routing for an event.
- **[[OVERRIDE_LEARN]]** — when the system suggests a manual change pattern is worth keeping.
