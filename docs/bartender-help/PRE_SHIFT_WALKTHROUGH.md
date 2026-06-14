# The 5-Minute Pre-Shift Walkthrough

**For:** the bartender clocking in right now, at the start of your shift.
**Goal:** know — before the first customer walks in — that the mics work, the music is going, no warning banners are up, and the TVs are right.
**Time to do:** 5 minutes if everything's normal. Maybe 10 if you find something to fix.
**You can't break anything.** Every step here is just looking and tapping — none of it changes how the bar is set up.

---

## Why bother

It's much easier to swap a dying mic battery now — when the bar is empty — than at 8:47 PM mid-trivia with the host glaring and a customer waving an empty glass.

This walkthrough catches the four problems that ruin the most shifts: a wireless mic about to die mid-page, background music that's silent and nobody noticed, a warning banner about the audio system, or a TV on the wrong channel. All four take 30 seconds to fix if you catch them now. All four take 10 minutes and an apology later.

Five minutes. Coffee in one hand, iPad in the other. Here's the order.

---

## The walkthrough — top to bottom, in clock-in order

### 0:00 — Wake the iPad and log in

Pick up the iPad behind the bar (the one mounted near the register). Tap the screen to wake it. If you got logged out, punch in your bartender PIN.

You'll land on the home screen with a row of tabs across the top — **Video**, **Audio**, **Music**, and a few others. The **Video** tab is selected by default. That's where you start.

**What you'll see:** the floorplan of the bar with TV tiles laid out roughly where the TVs are on the walls, and right above it, a colored card called the **Shift Brief**.

If the iPad won't accept your PIN or looks frozen, try once more — sometimes the screen sleep takes an extra second. If it's truly stuck, text the manager and start your shift the old-fashioned way.

---

### 0:30 — Read the Shift Brief

The Shift Brief sits at the very top of the Video tab. Sparkle icon, "Shift Brief" in the corner. Inside is a short paragraph the system wrote for you, summarizing what's been happening and what to expect tonight.

**Read every line — it's 30 seconds.** Don't skip it just because it usually says "looks normal." When it doesn't, you really want to know.

Here's what each part means, in order.

#### "Mic status: ..."

This is the live, right-now health of the wireless mics. It says one of three things:

- **"Mic status: good"** — airwaves are clean, mics are fine. Move on.
- **"Mic status: 2 brief signal hiccups in the last hour. Probably fine."** — a couple of tiny blips, nothing serious. Glance at the silver wireless mic box on the rack when you walk past, but don't change anything.
- **"Mic status: 5 interference events in the last hour — wireless mic environment is busy."** — the airwaves are noisy. If you've got a hosted event tonight (trivia, paging, an MC), have the wired backup mic handy and ready to go.

#### "Heads up: [band/event] at [venue]..."

Warnings about stuff happening near the bar tonight that might mess with the wireless mic. The system checks for nearby concerts and ball games. You'll see lines like:

> Heads up: Packers vs Bears at Lambeau Sunday at 12:00 PM — stadium broadcast trucks usually cause RF noise

**What to do:** mostly just file it away. If trivia night is at 8 PM and a band starts next door at 8 PM, you've been warned — set the wired backup mic out before the host arrives.

#### "Last 24h Atlas priority recap: ..."

Yesterday's mic activity, summarized. Three things to watch for:

- **"mic-keys"** — number of times somebody pressed a mic / paging / intercom. Hundreds is normal.
- **"RF-induced ghosts"** — the system *thought* a mic was on but it was really interference. **This is the one to care about.** More than zero means something was acting up yesterday and might be back tonight.
- **"manual source overrides"** — somebody re-routed audio by hand. The manager tweaking things. Fine on its own.

If the line says "quiet (0 priority events)," last night was a snoozer.

#### Big games / scheduled games

What's important tonight — Packers at 7:30, Bucks at 8:00. Mentally line up which TVs you'll need on which channels. The big-screen always gets the home team.

#### What NOT to do with the Shift Brief

- **Don't bypass it because it usually says "looks normal."** When it doesn't, you really want to know.
- **Don't smash refresh.** It updates on its own; the refresh button is only for when your manager asks for a fresh one.
- **Don't worry if it shows "Brief unavailable."** AI is slow sometimes. Run the rest of the walkthrough manually.

Tap the X in the corner when you're done reading — it comes back next shift.

---

### 1:00 — Check the mic batteries

Tap the **Audio** tab. Scroll until you find the wireless mic panel. Each mic channel has a row with a battery icon and a signal-strength icon. **The color tells you everything:**

- **Green battery** — full or near-full. Good for the shift.
- **Teal or yellow** — getting low. **Swap it now.** It will absolutely die mid-shift.
- **Red, or "CRITICAL" / "Replace soon" label** — swap it NOW. Before the next step.
- **Gray "Unknown" or a dash** — the mic is off or running on disposable alkalines. Pick up the mic, power it on, and read the level off the handle screen.

**Healthy mic:** green battery, "Excellent" or "Good" signal, "Bodypack" or "Handheld" listed as the type.

**What NOT to do:** **never** skip the mic battery check. This is the single most common shift-killer in the bar. A page mic that dies during a 7 PM hosted event is a guaranteed apology. A dead mic swapped at 4:30 PM is 30 seconds nobody notices.

If you find a low battery, swap it now. Procedure is in `MIC_NOT_WORKING.md` section 1 — unscrew the bottom half, two fresh AAs (mind the + and −), screw it back. Spare batteries live in the drawer the manager pointed out on day one.

---

### 2:00 — Confirm music is playing

Tap the **Music** tab. At the top is a box called **Now Playing** — it should show a song title and album art with a pause button visible.

**Normal:** a song name, the album cover, and you can hear music in the bar.

**Not normal at clock-in:**

- **Now Playing is empty / "Nothing playing"** — music is paused. Tap the big triangle (Play). Starts in about 10 seconds.
- **Now Playing shows a song but you hear nothing** — a zone is muted. Pop back to Audio tab, drag any zero slider back to the middle.
- **The wrong playlist** — scroll past Now Playing, you'll see a grid of playlist tiles. Tap the one you want; new song starts in 5 seconds.

Full music troubleshooting in `MUSIC_OR_AUDIO_PROBLEM.md`. At clock-in it's almost always "tap Play" or "tap the right playlist."

**What NOT to do:** don't change playlists for fun while checking. Every tap is a song-skip on the speakers — a regular mid-song will glare.

---

### 2:30 — Scan for active banners

Still on the **Audio** tab. Look at the very top, above the zone sliders. **Any colored banners?**

- **No banners** — great, move on.
- **Yellow / amber** — "Atlas priority active." System thinks somebody is on a mic / page / intercom right now. **At clock-in with the bar empty, that's wrong.** A mic got left on somewhere — walk the floor, find it, turn it off. Banner clears in 5 seconds. Check the manager's office and the back patio if you can't find one out front.
- **Cyan / light blue** — RF interference detected. Uncommon at clock-in but not impossible (band setting up next door). **No action needed.** Just know if the wireless mic acts crackly later, this is why.
- **Both at once** — "fake mic" event: interference made the system think a mic was on. Sorts itself out in a few seconds. If it keeps cycling on and off, text the manager.

Full banner reference in `RF_INTERFERENCE_FOR_BARTENDERS.md`. At clock-in: **no banners = good. Yellow with nobody on a mic = find the hot mic. Cyan = heads-up.**

**What NOT to do:** don't ignore a yellow banner at clock-in. Audio is being ducked somewhere right now — music is quieter than it should be. Find the cause.

---

### 3:00 — Glance at the Video floorplan

Tap back to the **Video** tab — the floorplan with TV tiles.

**Quick visual scan: are all the TVs you expect to be on, on?**

Walk to the bar door, look out at the room, compare to the floorplan. The tiles show a tiny preview of what each TV is showing.

- All TVs lit up with a source — good.
- A TV showing "No Signal" or dark on the wall — TV is off or its cable box crashed. If a game's about to start on it, fix it now (`WRONG_CHANNEL_ON_TV.md`). If nobody'll look at it for two hours, fix it in the lull.
- A TV showing the wrong sport — leave it unless a customer's already there. Tonight's games load automatically as they start.

**What NOT to do:** don't start mass-rerouting during the walkthrough — you'll get tangled. Note what needs attention, finish the sweep, come back.

---

### 3:30 — Tap the floating "Ask AI" button

Bottom-right corner of the iPad screen — a **purple pill-shaped button** with a chat-bubble icon that says **"Ask AI."** It floats over everything; doesn't matter which tab you're on.

Tap it. A chat window opens. In the text box, type:

> Anything I should know about tonight?

Tap send. Wait 30 to 90 seconds. The AI combines the Shift Brief, recent system events, the schedule, and any RF activity it's seen, and gives you a plain-English heads-up.

**What you might get back:**

> Packers play at 7:30 tonight on Fox (channel 5). Bucks at 8 on FanDuel (channel 40). Mic batteries look good. Heads up: concert at Resch starting at 7 — wireless mic might get interference. Cable box on TV 7 had two static glitches last night, keep an eye on it.

**This is where the Ask AI button really shines.** The Shift Brief tells you what the system noticed automatically; the Ask AI button lets you ask follow-ups in plain English. If something in the brief was confusing:

> What does "3 RF-induced ghosts" mean?
> Should I worry about the cyan banner I saw earlier?
> What channel are the Brewers on tonight?

The AI talks like a coworker, not a tech manual. **No dumb questions.** You can't break anything by asking. If the answer doesn't help, close it and move on.

If the AI doesn't come back in 90 seconds, it timed out — close and skip to the next step.

---

### 4:00 — Last sweep — tabs specific to your bar

Different bars have different tabs. Glance at any of these your bar has:

- **Lighting** — if your bar has DMX or smart lights, are the scenes set for early-shift (usually "Bar Open" or "Daytime")? Tap the right scene if not.
- **Guide** — what live games are on which channels right now. Worth a peek before the rush so you know the numbers.
- **Schedule** — what got scheduled for tonight and which TVs are on the list.
- **Power** — bulk-turn-on TVs if any are off that shouldn't be. Otherwise skip.

If your bar has none of these, you're done early.

---

### 5:00 — You're ready

You now know: Shift Brief had nothing urgent (or you handled what it flagged), mic batteries are green (or you swapped the low ones), music is playing the right playlist, no banners are up (or you cleared them), TVs are roughly right, and the AI has nothing surprising to flag.

That's the whole shift downstream of you. **You're ahead of the game.** Pour yourself a coffee and roll into prep.

---

## What if I find a problem during the walkthrough?

Fix the one thing, then come back and finish. Don't abandon the sweep — the other checks still matter.

Where each problem lives:

- **Mic battery dying / mic not working** → `MIC_NOT_WORKING.md` (section 1 batteries, section 2 mute, section 4 re-pairing).
- **Yellow or cyan banner** → `RF_INTERFERENCE_FOR_BARTENDERS.md` (banner meanings + when to escalate).
- **Music silent or wrong** → `MUSIC_OR_AUDIO_PROBLEM.md` (scenario 1 stopped entirely, scenario 4 wrong music).
- **TV on wrong channel or static** → `WRONG_CHANNEL_ON_TV.md` (section 1 wrong source, section 3 static, section 4 dark TV).
- **Not sure what you're looking at** → tap the floating purple **Ask AI** button. "There's a yellow banner and nobody's on a mic" is a fine question.

When in doubt, open Ask AI first — it'll point you to the right section.

---

## What if I skip the walkthrough?

Honest answer: lots of bartenders will skip this some shifts. Fine. Here's the **absolute minimum** if you only have one minute:

1. **Glance at the Shift Brief.** Just read the "Mic status:" line. If it says "good," move on. Anything else, slow down for 30 more seconds.
2. **Listen for music.** Stand still 5 seconds. If silent, tap the Music tab and hit Play.
3. **Check the Audio tab for banners.** Yellow or cyan at clock-in is wrong.

Those three catch about 80% of what the full walkthrough catches. The full one gets the last 20% — the dying mic battery that hasn't quite hit "critical" yet, the TV that's been off since last night, the concert-next-door warning that'll mess with your trivia mic.

Skipping is allowed. Skipping every shift is how you end up with apologies.

---

## What if the Shift Brief shows an error?

Sometimes the brief shows "Brief unavailable" or just spins forever. The AI service can be slow or down.

**Not your problem to fix.** Run the rest of the walkthrough manually:

- Mic batteries (Audio tab) — covers the "Mic status:" line.
- Listen for music — covers the music check.
- Look for banners (Audio tab) — covers RF / priority.
- Tap the Ask AI button anyway — sometimes the chat works when the brief is down.

If both the brief AND Ask AI are broken, the AI service is having a bad day. Note the time, mention it to the manager, run the walkthrough manually. **None of the iPad's basic controls (channels, music, audio zones) depend on the AI**, so the bar still runs.

---

## When to text the manager

Don't text for one small thing you found and fixed. Save it for:

- **Three or more things wrong at clock-in.** That's a system problem, not a rough night. Audio processor crashed, cable's out, something physical happened.
- **A banner won't clear after 5 minutes of hunting.** Can't find the hot mic, cyan banner stays up — text with a photo and what you tried.
- **Mic batteries are bad on every channel.** Nobody's been swapping, or somebody pulled the spares.
- **Shift Brief or Ask AI hasn't worked in two consecutive shifts.** Real system issue.
- **Anything on fire, smoking, sparking, dangling, or warm to the touch on the rack.** Stop the walkthrough. Text immediately. Don't troubleshoot.

Include a photo and a short sentence about what you tried. Specific beats vague.

---

## What to read next

If you've never read any of the other how-tos, here's the order that pays off fastest. None take more than 10 minutes.

1. **`MIC_NOT_WORKING.md`** — wireless mic batteries, mute switches, re-pairing. The single most common "bar called me at 7 PM" call.
2. **`WRONG_CHANNEL_ON_TV.md`** — fix a TV showing the wrong game, static, or "No Signal." Comes up multiple times a shift on game days.
3. **`MUSIC_OR_AUDIO_PROBLEM.md`** — music stopped, wrong playlist, volume weird. Customers notice within seconds when the music goes quiet.
4. **`RF_INTERFERENCE_FOR_BARTENDERS.md`** — what the yellow and cyan banners mean and what to do about each. Banner literacy saves you chasing ghost mic events.
5. **`AUDIO_ZONES_AND_GROUPS.md`** — proactive zone control (patio loud, dining quiet, bar muted). Read once, refer back when a customer asks for volume changes.
6. **`PUTTING_GAMES_ON_TVS.md`** — the proactive companion to WRONG_CHANNEL. Schedule tab, AI Suggest, Guide-tab one-tap watch.
7. **`LIGHTING_AND_SCENES.md`** — recall scenes for trivia, game day, last call. Only matters if your bar has lighting on the iPad.
8. **`POWER_AND_NETWORK_TVS.md`** — bulk power, HDMI inputs, pairing new TVs. Only matters at open, close, or when the manager asks.

Read MIC + WRONG_CHANNEL + MUSIC + RF first — those four cover ~90% of shift problems. The rest you can grow into.

---

## You did great

Five minutes of attention at clock-in is the highest-leverage time you'll spend all night. Every problem you catch now is one that doesn't surprise you at 8 PM. Every dying battery you swap before the rush is one you don't have to chase down a hallway later.

Ran the whole sweep and everything was clean — perfect. Found one or two things and fixed them — even better. Found something you couldn't fix and texted the manager — also success, you escalated with details.

The walkthrough is a tool, not a test. You can't fail it. You can only get ahead of the night.

Now go pour drinks. You've got this.
