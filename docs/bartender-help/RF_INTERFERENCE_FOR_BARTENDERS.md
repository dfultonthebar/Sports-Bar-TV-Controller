# The New "Radio Interference" Stuff — Bartender Help

**Use this when:** A yellow or cyan banner pops up on the iPad behind the bar. The karaoke mic acts weird out of nowhere. A regular asks why the music got quieter. Or someone told you "use the new RF thing" and you have no idea what they mean.

**How long this should take:** 30 seconds for most stuff. The system mostly takes care of itself — you barely have to do anything.

**Promise:** You can't break anything by reading the banners or tapping the buttons described here. Nothing in here makes changes to the mic or the speakers. It's all just looking at what the system already noticed.

---

## What's new (the 60-second version)

We added a little radio antenna to the equipment rack. Think of it as a **smoke detector for the airwaves around the bar.** It watches 24/7 to see if anything in the neighborhood — a band at the bar next door, a TV news truck, a stadium broadcast — is broadcasting on the same radio waves our karaoke mic uses.

Combined with the **silver box behind the bar** (the wireless mic receiver, the one you already know about), we now have two things watching the radio waves at the same time. When both of them agree something is wrong, you know it's real and not a false alarm.

You don't have to install it, check on it, or feed it. It runs itself. The only thing you need to know is **what the banners on the iPad mean** and **what to do when the karaoke mic acts up.**

---

## The two banners on the bartender remote

When you look at the **Audio** tab on the iPad, sometimes a colored banner shows up at the top. Here's what each one means.

### Quick reference card — yellow vs cyan (they are NOT the same)

| Color | Means | Triggered by | What to do |
|---|---|---|---|
| **Yellow** | Atlas priority active — somebody is on a mic / page / intercom right now | Atlas audio processor detects a priority input above −45 dB | Nothing. Music ducks automatically, comes back when the mic stops. |
| **Cyan** | Wireless mic RF interference detected | Shure wireless-mic receiver sees a foreign radio signal on our mic frequency | Watch the karaoke mic; if it acts up, follow "When the karaoke mic cuts out" below. |

The yellow banner is about **audio inputs being used inside the bar.** The cyan banner is about **radio interference coming from outside the bar.** Two different problems. Two different banners. Don't confuse them.

### Yellow banner — "Atlas priority active" (mic, page, or intercom is on)

**What it means in English:** Someone is on a microphone or the paging system right now. The music has been automatically turned down so the talking comes through clearly.

**What to do:** Nothing. This is the system doing its job. When the talking stops, the music comes back up on its own within a few seconds.

**When to worry:** If the yellow banner is up and **nobody is actually talking on a mic** anywhere in the bar. That probably means something is fake-triggering the mic system. Read the next section — there might be a cyan banner too.

### Cyan banner — "Wireless mic RF interference detected" (radio waves from outside the bar)

**What it means in English:** Our system noticed something is broadcasting on the same radio waves the karaoke mic uses. Could be a band next door warming up, could be a TV news truck for a Packers game, could be just a quick blip.

**What to do:**
- If the karaoke mic is in use and sounds fine — just keep an eye on it. The banner is a heads-up, not an emergency.
- If the karaoke mic is acting up (crackling, cutting in and out), the cyan banner explains why. Go to **"When the karaoke mic cuts out"** below.

### Both banners at once (yellow + cyan)

This is the most useful combo. It means: the system thinks a mic is active (yellow), AND it detected interference at the same time (cyan). Translation: **the "mic" that triggered the music ducking probably wasn't a real mic — it was interference from outside the bar.**

You don't have to do anything. The system itself figures this out and will sort it out within a few seconds. But if the music keeps getting weirdly ducked over and over with nobody on a mic, that's worth a text to the manager.

### "SDR-confirmed" — what that label means

Sometimes you'll see the cyan banner with extra words: **"SDR-confirmed"** or "(SDR-confirmed)" on an event in the history list.

In plain English: **both the antenna and the silver mic box agree.** Two separate gadgets saw the same thing. So this isn't a false alarm — it's real interference. Without the SDR label, it might just be the mic box being twitchy. With the label, you know something actually happened in the airwaves.

You don't need to do anything different — just know that "SDR-confirmed" means "definitely real."

---

## The "RF Environment Summary" card

This is something you'll only see if you go into the admin pages (your manager would have to set up your iPad to show it, or you'd be on a laptop). Most bartenders will never look at this. But if you do, here's what it is.

**Where to find it:** Device Config → Audio → Wireless Mics tab → scroll to the card called **"RF Environment Summary."**

**What it shows:** A short paragraph in plain English, written by an AI every 24 hours at midnight, summarizing what the radio waves around the bar did yesterday. Stuff like:

> "Things were quiet last night. One brief blip around 9:30pm that lined up with the band starting next door at Anduzzi's. The karaoke mic was fine — no real interference."

**When to refresh it:** Almost never. It updates by itself overnight. There's a **Refresh** button if you want a brand-new summary right now (takes about 30 seconds), but you only need to push it if your manager specifically asks "what does the AI say happened last night?"

**When to actually read it:** First thing in the morning after a weird shift. If staff says "the karaoke mic was acting up last night," open this summary — it might tell you exactly what was going on (band at the neighbor bar, news truck, stadium broadcast, etc.).

---

## The "Suggest a Clean Frequency" button

Right next to the summary card, there's a button: **"Suggest a Clean Frequency."**

**What it does:** Looks at the last 7 days of radio activity around the bar and tells you which mic frequency has been quietest. The idea is: if the karaoke mic is on a frequency that's been getting hit with interference, this button can suggest a better one.

**When to use it:** Only if your manager or the AV installer tells you to. This is not a tool for normal bartender duty.

**What NOT to do:**
- **Don't change frequencies in the middle of a busy night** without telling somebody. Changing the mic frequency means walking through the menu on the silver box AND on the mic itself, and there's a chance you'll mess it up and have no mic for 10 minutes during karaoke.
- **Don't push the button "just to see what happens"** during service. Looking at the suggestion is harmless, but acting on it requires you to physically reconfigure the mic.

If you ever do need to actually change the frequency, see the **"Wireless interference"** section in the `MIC_NOT_WORKING.md` doc — it walks you through the Group Scan, which is the safe way to switch.

---

## When you log in for your shift — the AI heads-up

When you start your shift and open the iPad, the AI might show you a short blurb. Here are the ones you might see related to the mic stuff.

### "Mics looking good"

Normal. Move on. Pour drinks.

### "Heads up: there's a band at [neighbor bar] at 9pm — might mess with the karaoke mic"

The AI is warning you that a nearby venue has a live band scheduled, and live bands sometimes broadcast on the same frequency as our karaoke mic. **What to do:**

1. Let the karaoke crew know: *"Hey, there's a band next door tonight — if the mic gets crackly, we'll do a quick reset, just give me a heads-up."*
2. If interference actually happens during karaoke, follow the **"When the karaoke mic cuts out"** steps below.
3. Worst case: switch to the wired backup mic for the night. It's no big deal.

---

## Other alerts you might see (not in the shift-brief)

These show up in the **Wireless Mics** tab on the device-config screen — not in the shift-brief blurb when you log in. Worth knowing about anyway.

### "Mic battery is low on channel [1 or 2]"

The karaoke mic is running out of juice. Change the batteries now, before someone is mid-song.

**Where you see it:** the Wireless Mics tab shows a yellow battery bar on whichever channel is dying. Some locations also email the manager when this fires. It does **not** appear in the shift-brief, so make a habit of glancing at the Wireless Mics tab once per shift.

**What to do:**
1. Find the spare AA batteries (your manager will have shown you where — usually a drawer near the register or by the back office).
2. Pick up the karaoke mic and unscrew the bottom half.
3. Swap in two fresh AAs (mind the + and − markings).
4. Screw it back together.

That's it. Takes 30 seconds. See `MIC_NOT_WORKING.md` section 1 for the slow-motion version if needed.

---

## When the karaoke mic cuts out

OK, the new RF stuff is supposed to make this easier. Here's the order to check things.

### Step 1 — Look at the silver box behind the bar

Glance at the front panel of the silver wireless mic box. The screen shows the mic channels (usually "Mic 1," "Mic 2").

- **Battery icon next to the mic name?** Box can see the mic. Good. Move to step 2.
- **No battery icon, even though the mic is on?** The mic and box have lost touch with each other. Skip to `MIC_NOT_WORKING.md` section 4 ("IR Sync").
- **No lights on the box at all?** Power problem. Check the power strip. If it's plugged in and on, text the manager.

### Step 2 — Look at the iPad's Audio tab

Open the **Audio** tab on the bartender remote. Is the **cyan banner** showing?

- **Yes, cyan banner is up:** Interference is the problem. The system is telling you what's wrong. Skip to step 4.
- **No cyan banner:** Probably not interference. Could be batteries, mute, or volume. Open `MIC_NOT_WORKING.md` and start from the top.

### Step 3 — Ask the AI Hub

If you're not sure what's going on, open the **AI Hub** (the chat box on the iPad — it's the icon that looks like a speech bubble or a chat box). Type something like:

> "The karaoke mic isn't working. What do I do?"

The AI knows about the new RF system and will look at what's happening right now. It might tell you:

> "I see interference on the karaoke mic frequency right now — looks like the band at Anduzzi's started 5 minutes ago. Try the Group Scan to find a clean frequency, or switch to the wired backup."

You can ask follow-ups: *"How do I do a Group Scan?"* or *"Where's the wired backup?"* — it'll walk you through it.

### Step 4 — If it's interference, run a Group Scan or use the backup

Two options:

1. **Quick fix — use the wired backup mic for the rest of the song or set.** No drama. Just hand the karaoke person the corded mic and tell them "the wireless is acting up, this is the backup."
2. **Real fix — do a Group Scan on the silver box.** This finds a fresh clean frequency. Takes about a minute. Full instructions in `MIC_NOT_WORKING.md` section 5. Only do this **between songs** or during a break — don't try it while someone is singing.

### Step 5 — When all else fails

Text the manager. Tell them:
- "Karaoke mic is crackling / cutting out."
- "The cyan interference banner is up." (or "isn't up" — both are useful info)
- "I tried [whatever you tried]."
- "Using the wired backup for now."

You've done everything you reasonably can. The manager or the AV tech can take it from there.

---

## What you DON'T need to do

This part is important. The new RF system was designed so bartenders don't have to think about most of it. Stuff you can safely **ignore:**

- **You don't need to install anything.** The antenna is on the rack already. It just works.
- **You don't need to "check on the SDR" or any other gadget.** It checks itself. If something breaks, the manager gets an alert.
- **You don't need to read scripts, terminal output, or any technical screen.** Everything you need is on the iPad in plain English.
- **You don't need to understand frequencies, decibels, megahertz, antennas, or any of that.** That's the AV tech's job.
- **You don't need to refresh, restart, or "reboot" anything.** If you think something needs a restart, text the manager.
- **You don't need to memorize what "Atlas priority" or "SDR" means.** Now you know what the banner colors mean and that's enough.

---

## When to escalate

### Text the manager when:
- The yellow priority banner keeps turning on and off when nobody is on a mic and nobody is paging.
- The cyan interference banner has been on for **more than 30 minutes straight** with no break.
- The karaoke mic has interference and the Group Scan didn't fix it (or you weren't comfortable doing one).
- You see a banner you don't recognize that isn't yellow or cyan.
- A regular asks a question about the system you can't answer (the AI Hub can usually answer it — try that first).

### It's probably normal and you can keep working when:
- Yellow banner turns on for a few seconds while someone is on a mic, then turns off — that's literally its job.
- Cyan banner pops up for under a minute and the karaoke mic still sounds fine — just a brief blip from a passing source.
- The "RF Environment Summary" mentions a band or neighbor venue from last night — you can read it in the morning, not during a shift.
- The shift-brief says "mics looking good" — no action needed.

---

## TL;DR — what to actually remember

1. **Yellow banner** = something is on a mic. Music auto-ducked. Normal.
2. **Cyan banner** = our system detected radio interference near the karaoke mic. Heads-up.
3. **Both at once** = the system thinks the "mic" trigger was probably interference, not a real mic. Watch it.
4. **"SDR-confirmed"** label = two gadgets agree, definitely real, not a false alarm.
5. **Karaoke mic acting up?** Check the cyan banner first. If it's up, it's interference — use the backup mic or run a Group Scan between songs.
6. **Ask the AI Hub.** It knows what's happening in the airwaves right now and can walk you through fixes in plain English.
7. **The system runs itself.** You don't need to install, check, or restart anything. Just glance at the banners and you're good.

You've got this. The new RF stuff is on your side — it's supposed to make game-night and karaoke nights smoother, not give you more to do.
