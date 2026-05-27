# Audio Zones and Groups — Bartender Help

**For:** the bartender who needs to make a specific area louder, quieter, silent, or hearing a different game. Or just trying to understand why the patio is blasting and the dining room is whispering.
**Goal:** every area sounds the way you (or the manager, or the guest at table 12) want it to.
**Time to fix:** under 30 seconds for slider tweaks. 1–2 minutes to switch what's playing in a zone.
**You can't break it:** every slider, dropdown, mute, and tap here is meant to be touched by you. If a change sounds wrong, slide it back. Nothing here can damage a speaker, amplifier, or the processor on the rack.

This is the **proactive** guide — using the Audio tab on purpose, before something feels broken. If something is already broken (no music, distortion, buzzing, whole bar suddenly silent), jump over to **MUSIC_OR_AUDIO_PROBLEM.md**.

---

## 30-second triage — start here

**What do you actually want different?**

- One area is too loud or too quiet, just nudge the volume → Scenario 1.
- One area is silent and shouldn't be, or you want a zone fully off → Scenario 2 (mute/unmute).
- A different game in one area while the rest of the bar stays the same → Scenario 3 (change source).
- Raise or lower the whole bar at once → Scenario 4 (groups).
- Yellow or cyan banner at the top and you're not sure if it matters → Scenario 5 (banners).
- "Mic 1" / "Mic 2" tiles at the top showing red or weird colors → Scenario 6 (mic tiles).
- No Audio tab at all → Scenario 7.

If you're just curious how the whole setup works, read the next section first — it's a 2-minute primer.

---

## How the audio is set up here — a primer

The bar is split into **zones**. A zone is one area where the speakers all play the same thing at the same volume — main bar might be one zone, patio another, dining room a third, bathrooms a fourth. Each zone has its own slider, so you can turn the dining room down without touching the patio.

Each zone is playing a **source**. A source is "what's coming through the speakers" — the music streaming service, the audio from a specific TV, the jukebox, the paging mic. Every zone picks its own source. That's how the dining room can hear the Packers audio while the bar hears the music service at the same time.

Some bars also have **groups**. A group is two or more zones linked together. "Indoor" might be a group of main bar + dining + bathrooms; "Outdoor" might be patio + pavilion. Groups let you raise the whole indoor area for happy hour without sliding three sliders one by one. Not every location has them — if you don't see any, your bar is zones-only, which is fine.

Behind all of that, a black or silver box on the equipment rack — the **audio processor** — does the actual mixing. You don't touch it. The iPad talks to it for you.

Zones = areas. Sources = what's playing. Groups = linked zones (when present). Processor = the mixer in the back. iPad = your controls.

---

## Scenario 1 — Adjust volume in one area

**What this looks like:** A patio guest says "we can barely hear the game out here," or a dining-room server says "the music is killing the conversation." You nudge one area without touching the rest.

**Time to fix:** 10 seconds.

**What the customer hears:** Almost nothing. The change lands about 2 seconds after you let go of the slider — no gap, no pop, just a smooth shift.

### Quick check first

Walk a few steps toward the area. Is it actually the music that's loud, or is it the TV sound from a nearby zone bleeding over? If the TV is the loud one, fixing the music slider won't help — see WRONG_CHANNEL_ON_TV.md for source/volume on a specific TV.

### What to do

1. Pick up the iPad behind the bar and tap the **Audio** tab near the top.
2. You'll see a list of zone names — **Main Bar**, **Patio**, **Dining**, **Pavilion**, etc. Each one has its own row with a horizontal slider and a pair of **−** and **+** buttons.
3. **Slow nudge:** tap **−** to lower or **+** to raise. Each tap moves one notch.
4. **Big change:** drag the dot on the slider — left for quieter, right for louder.
5. Walk back toward the area and listen. Adjust again if needed.

### How you know it worked

The slider stays where you put it. Volume changes in that area within about 2 seconds. Other zones don't change.

### If it didn't work

- **Slider moved but sound didn't change.** Walk closer to confirm you're in the right zone. If you are, the zone might be muted — see Scenario 2.
- **Slider jumps back after you let go.** Usually a hot mic is forcing the volume down — see Scenario 5 about the yellow banner.
- **Wrong area got louder.** You tapped the wrong row. Zone names are printed next to each slider; double-check before you slide.

### What NOT to do

- **Don't drag the slider all the way to 0 if you want the area "off."** A slider at 0 is "as quiet as it goes but still trying to play." For actual off, use the mute button (Scenario 2). Mute remembers the previous volume; sliding to 0 doesn't.
- **Don't keep tapping − or + faster than you can listen.** The change takes about 2 seconds to land. Tap, listen, tap again.

---

## Scenario 2 — Silence a zone (or wake up a silent zone)

**What this looks like:** A private meeting in the back room needs the music off in there, just there. Or the patio is closed for the night. Or a zone that should be playing isn't, and you suspect someone tapped mute earlier.

**Time to fix:** 5 seconds.

**What the customer hears:** Silence drops in (or sound returns) within about 1 second. No fade, no warning — clean on/off.

### Quick check first

Walk to the zone. Is it actually silent, or just quiet? Silent = mute icon at work. Quiet-but-not-silent = the slider — go back to Scenario 1.

### What to do

1. Tap the **Audio** tab and find the row for the zone.
2. Look for a small **speaker icon** next to the zone name.
3. **Speaker icon with a line through it** (a slash like a "no smoking" sign) = the zone is **already muted**. Tap once to un-mute; sound returns in about a second.
4. **Speaker icon normal, no line** = the zone is **playing**. Tap once to mute; sound drops in about a second.

### How you know it worked

The speaker icon changes (gains or loses the slash). The zone goes silent (or comes back) within a second. The slider stays where it was — mute doesn't move it, it just blocks the output.

### If it didn't work

- **Tapped the icon but nothing happened.** Pull-to-refresh the screen (drag the top of the iPad down like refreshing a webpage), then walk to the area and listen.
- **Zone keeps un-muting itself after you mute it.** Usually an automatic schedule or a paging system is reactivating it. Note time + zone, tell the manager — that's a settings change, not a bartender fix.

### What NOT to do

- **Don't mute the wrong zone in a rush.** Easy to tap "Main Bar" when you meant "Party Room." If you do, just tap the icon again — sound returns immediately.
- **Don't mute all zones to "turn off the music for the night."** That's a closing routine — your manager likely has a specific way they want this done (sometimes a closing scene, sometimes a physical rack power-down). Ask first.

---

## Scenario 3 — Play a different source in one zone (different game in the dining room than at the bar)

**What this looks like:** Packers on the main bar's TVs and audio. A dining-room regular asks "can I get the Brewers audio out here while you keep the Packers at the bar?" Yes — different zone, different source.

**Time to fix:** 30 seconds once you know which source goes with which feed.

**What the customer hears:** A brief gap of silence in the zone you're changing — usually 2–5 seconds, occasionally 10 — while the processor switches inputs. Other zones don't pause.

### Quick check first

The audio system has a list of sources. Each TV usually corresponds to one of them. Well-labeled sources have names like "TV 1 — Main Bar," "Matrix TV 1," "Spotify," "Jukebox" — the label tells you what's on each. If your sources are labeled vaguely ("Source 1, Source 2, Source 3") and you don't know what's on each, **don't guess in the middle of a rush**. Read "What NOT to do" below first.

### What to do

1. Tap the **Audio** tab and find the row for the zone (e.g. "Dining").
2. On that row, there's a **source picker** — a dropdown showing what's currently playing.
3. Tap it. A short list of available sources appears.
4. Tap the source you want — for example, the source for the TV showing the Brewers game.
5. The zone goes briefly silent, then audio returns from the new source.
6. Walk to the zone and confirm it's the right game.

### How you know it worked

The source picker shows the new source name. Sound returns in the zone within about 5 seconds. Other zones are unaffected.

### If it didn't work

- **Picked a new source and no sound returned.** That source might be silent right now (TV muted at the TV, streaming service paused, jukebox between songs). Pick a different one or check the source device.
- **Right source, wrong game.** Source labels can drift. Try the next source in the list, or tap the floating **Ask AI** button: "Which audio source goes with the TV showing the Brewers game?"
- **Dropdown is empty or only has one option.** Your location is set up with limited source choices. Ask the manager — might be a setup gap.

### What NOT to do

- **Don't switch sources blindly during a rush.** If you have no idea what's behind "Source 4," it might be a muted TV, an unplugged jukebox, or nothing at all. Better to tell the guest "sorry, the bar's hearing Packers tonight" than to randomize the dining room mid-meal.
- **Don't change the wrong zone.** Easy mistake when names are similar ("Bar 1" / "Bar 2," "Patio" / "Pavilion"). If you do, just change it back — the picker remembers.
- **Don't tap unfamiliar source dropdowns just to see what's in them mid-rush.** Opening the dropdown is harmless; tapping a source commits the change. Explore on a slow Monday, not Friday at 8pm.

### A polite touch

If the guest is sitting in the zone you're changing, they'll hear silence for 2–5 seconds. Say "switching the audio for you, give me five seconds" before you tap — sets the expectation that the brief silence is on purpose.

---

## Scenario 4 — Group volume (raise or lower the whole bar at once)

**What this looks like:** Happy hour starts and you want the whole indoor area louder before the crowd walks in. Or it's late and you want to dial everything indoors back for the late-dinner couples. Sliding five zones one by one works but is slow.

**Time to fix:** 10 seconds, if your bar has groups set up.

**What the customer hears:** A smooth shift, all linked zones moving together. Same 2-second response as a single-zone change.

### Does your bar have groups?

Not every bar uses groups. Open the Audio tab — if you see a section called **Groups** with names like "Indoor," "Outdoor," "Whole Bar," yes, you have groups. If you only see individual zone rows, your bar is zones-only — use Scenario 1 instead.

### What to do

1. Tap the **Audio** tab and find the **Groups** section.
2. Each group has the same controls as a zone: a slider, a mute button, sometimes a source picker.
3. Drag the group slider — every zone in the group moves together.
4. To mute the whole group, tap the speaker icon on the group row.

### How you know it worked

All zones inside the group adjust together. Watch the individual zone sliders — they slide in sync.

### If it didn't work

- **Group slider moved but only one zone changed.** Group membership may have been edited; only one zone is still linked. Ask the manager — group membership is set up in admin pages, not from the bartender remote.
- **Group is greyed out or won't move.** Sometimes happens during an active priority event (yellow banner) — the system pins the group while a paging mic is hot. Wait for the banner to clear.

### What NOT to do

- **Don't crank the group slider to maximum "just to see."** You'll blast every speaker in three rooms at once. If you want to test the top end, do it after closing with nobody in the building.
- **Don't mute a group when you only meant to mute one zone in it.** Muting a group silences everything in it. Be sure which control you're touching.

---

## Scenario 5 — Banners across the top of the Audio tab (yellow and cyan)

**What this looks like:** A colored bar across the top of the Audio tab — yellow (amber) mentioning "Priority" or "mic," or cyan (light blue) mentioning "RF" or "interference." Sometimes both.

**Time to react:** 5 seconds to read it. Usually no action required.

### Yellow banner — "Priority Override Active"

**Means:** someone is on a mic, paging system, or intercom right now. The audio processor lowered music in one or more zones so the talking comes through clearly. System doing its job.

**Do:** nothing. When talking stops, music comes back up within seconds.

**Worry when:** the yellow banner is up and **nobody is actually on a mic**. Walk the floor for an unattended hot mic (page mic on the bar, wireless mic on a stage, jukebox input). Switch it off — banner clears in about 5 seconds.

### Cyan banner — "Wireless mic RF interference detected"

**Means:** something nearby (a band next door, a TV broadcast truck, a brief blip) is broadcasting on the same radio waves our wireless mic uses. Heads-up that the wireless mic might act weird.

**Do:** usually nothing. If the wireless mic starts crackling, that's why — switch to the wired backup. Full deep-dive in **RF_INTERFERENCE_FOR_BARTENDERS.md** and **MIC_NOT_WORKING.md**.

### Both banners at once

**Means:** the system thinks a mic is hot (yellow) AND detected outside-the-bar interference at the same moment (cyan). The "mic" that ducked the music probably wasn't a real mic — it was the interference fooling the system. There's a name for this: an "RF-induced ghost." Sorts itself out in a few seconds.

**Do:** nothing, unless it keeps happening with nobody on a mic. Then text the manager.

### What you CAN and CANNOT touch

- **CAN:** read the banners. Walk the floor looking for a hot mic. Check the wireless-mic tiles (Scenario 6). All always safe.
- **CANNOT:** turn off the banners themselves — they're status lights, not buttons.
- **CANNOT:** change the wireless mic frequency from the bartender remote during a shift. Admin pages only; your manager or the AV tech handles it.

Read **RF_INTERFERENCE_FOR_BARTENDERS.md** once during a slow Monday and you'll never have to think about it again.

---

## Scenario 6 — The mic tiles at the top (battery and signal bars)

**What this looks like:** At the very top of the Audio tab, one or two small panels labeled "Mic 1" / "Mic 2" (or "Wireless 1," "Page Mic," etc.) each show a colored battery bar and signal indicator. Mostly green, ignore them. Sometimes yellow or red.

**Time to read:** 5 seconds at the start of each shift.

### Battery colors

- **Green ("5/5 bars"):** healthy, hours of life left.
- **Teal ("3/5 bars"):** still fine, watch it.
- **Amber ("Replace soon" / "1 bar"):** running low. Swap batteries when you have a quiet minute.
- **Red ("CRITICAL"):** about to die. Swap now.
- **Grey ("Unknown") or "—":** mic is currently off, or the system doesn't know. Normal if nobody's using it.

### Signal bars (RSSI)

- **Green ("Excellent"):** mic close to receiver, signal clean.
- **Teal ("Good"):** fine.
- **Amber ("Marginal"):** weak signal — mic too far, or interference (check the cyan banner).
- **Red ("Poor"):** barely getting through. Move closer to the receiver, or change batteries.

### What to do

- **All green/teal:** nothing.
- **Amber battery:** plan to swap between songs / between speakers.
- **Red battery:** swap now. Battery-swap walkthrough is in **MIC_NOT_WORKING.md** section 1 — takes 30 seconds.
- **Amber/red signal but battery fine:** usually interference (cyan banner) or distance. If a guest is far from the receiver, ask them to move closer.

### If the tiles aren't there at all

Either your location doesn't have a Shure wireless mic receiver hooked up, or it's offline. Don't worry — your wireless mic might still work fine. If it actually stops working, go to **MIC_NOT_WORKING.md**.

### What NOT to do

- **Don't try to change the mic frequency from the tiles.** They're read-only — status, not controls. Frequency changes happen on the silver receiver box front panel or in admin pages. **MIC_NOT_WORKING.md** section 5 has the Group Scan walkthrough.
- **Don't ignore a red battery hoping it lasts the night.** It won't. A wireless mic dies mid-sentence during the trivia winner announcement. Swap when you see red.

---

## Scenario 7 — There is no Audio tab on the iPad

**What this looks like:** You open the bartender remote on the iPad. You see tabs like Video, Guide, Music — but no Audio tab. Or the Audio tab exists but it's mostly empty, no zone sliders.

**Time to figure out:** 10 seconds.

### Why this happens

Some locations don't have a software-controlled audio processor on the rack. Their audio runs the old-fashioned way — physical knobs on an amplifier, or built into the same box as the music streaming service. No processor for the iPad to talk to means no Audio tab.

Other reasons it can look empty:

- The audio processor is offline (lost network or power).
- The processor is configured but the remote hasn't been pointed at it.
- You're logged in with a staff account restricted to certain tabs.

### What to do

1. **Is the music still playing?** Walk around. If yes, the audio system is working — the iPad just isn't your control surface. Your manager probably adjusts volumes a different way (knob behind the bar, wall control, separate app).
2. If you don't know how your bar's volume is adjusted, ask: "Where do I change the music volume here?" There's almost always an answer — a knob on an amplifier, a wall plate near the kitchen, another app on a different tablet.
3. If music is NOT playing AND no Audio tab, that's a music problem, not a Scenario 7 problem. Jump to **MUSIC_OR_AUDIO_PROBLEM.md** Scenario 1.

### What NOT to do

- **Don't dig through admin pages looking for "the Audio tab."** If it's not there, it's not there. Adding it back is admin work.
- **Don't unplug things on the rack hoping the tab will appear after a restart.** It won't, and you risk taking the TVs down too.

---

## Ask AI — the floating button

A purple pill-shaped button with a chat-bubble icon floats on the bartender iPad, bottom-right. That's the **Ask AI** button. Tap it any time you're not sure what to do. For audio questions, try:

> "How do I make the patio louder?"
> "What does the yellow banner mean?"
> "I want the dining room to hear a different game than the bar — how do I do that?"
> "Why does the Main Bar slider keep jumping back down?"

The AI knows your bar's specific zone names, source names, and group setup. Faster than scrolling this doc on a busy night.

---

## When to text the manager

Send a quick text — with one or two screenshots — when:

- The slider, mute, or source picker isn't responding for a zone (iPad shows the change, speakers don't follow).
- A zone has been silent more than 15 minutes despite the slider up and mute off — likely a hardware issue (blown speaker, tripped amplifier breaker).
- Yellow banner keeps cycling every few minutes with no mic in use anywhere.
- You see a banner you don't recognize that isn't yellow or cyan.
- Mic battery tiles stay red after you've swapped batteries.
- A regular asks an audio question you can't answer (try the **Ask AI** button first).

### Include in the text

- Short description ("Patio silent, slider middle, mute off, no banner").
- Exact time you noticed.
- What you tried, in order.
- Screenshots of the Audio tab + any banners.

Specific beats vague. "Audio is broken" starts the manager from zero; the message above gets them to the fix.

### While you wait

Don't keep restarting things — every change muddies what the manager can figure out remotely. If a zone absolutely needs quiet for a private event, mute every zone touching that area (Scenario 2) as a workaround.

---

## Things that are NOT your job to fix

- A speaker hanging from the ceiling by its wires.
- Burning smell near the equipment rack.
- The audio processor on the rack showing a red light, an error message, or a blank screen when it should be lit.
- Sound delayed from the picture (lips move before words).
- Sound in a completely different zone than the slider says (you adjust Patio, Main Bar volume changes).
- Whole rack dead — no lights on anything.

For any of those, take a screenshot + a photo of the rack and text the manager. Don't touch the rack hardware.

---

## You did great

Zones doing what you want? You fixed it. Had to text the manager? You also did great — you tried the right things and handed off a clean problem.

Every slider, mute, source switch, and group control is meant for your hand. You can't damage anything by tapping. Worst case is a second of confusion, then tap it back. So tap things — try a source switch on a slow Tuesday so you've got the muscle memory for Friday.
