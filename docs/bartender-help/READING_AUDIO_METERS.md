# Reading the Audio Meters

**For:** the bartender at the bar with an iPad.
**Time to learn:** about 3 minutes.
**Promise:** the meters are just for looking — touching this screen can't break any audio or change any volume.

The iPad now shows you a live picture of every audio signal coming into the bar's sound system — every mic, every band input, every music source. You can watch the bars bounce in real time as someone talks, sings, or plays. This page tells you how to read them and what to do with what you see.

---

## When you'd use this

- **Before a band starts** — quick sound check: ask the band to play, watch their input bounce, make sure the signal is strong enough before the room fills up.
- **"I can't hear the band"** — peek at the meter for that input. If the bar is moving, the band is sending sound and your problem is downstream (zone routing or a muted speaker). If the bar is flat, the band itself isn't sending audio.
- **A musician asks you to help with their mix** — point them at the iPad so they can see their own level while they set their amp/mic.
- **The paging mic isn't working** — talk into MIC 1 or MIC 2, watch the meter. Bar moves = mic works. Bar flat = mic dead or unplugged.

---

## How to find the meters

1. On the iPad behind the bar, open the bartender app like normal.
2. Tap the **Audio** tab in the bottom row of tabs.
3. Scroll down a little. Look for a section labeled **Real-time Audio Meters**.
4. If the section is collapsed (you only see the title with a small arrow), tap the title to expand it. The list of meters will appear below.

You'll see a stack of horizontal bars — one row per audio input. Each row has:
- **A name on the left** — what's plugged into that input. Names you'll see at this bar: **Pavillion Band**, **Patio Band**, **VIP Band**, **MIC 1**, **MIC 2**, **Juke box**, **Matrix 1 / 2 / 3**, **DJ Audio**.
- **A green bar in the middle** — how much signal is currently arriving. The bar grows to the right as the signal gets louder.
- **A small dB number** on the right — the exact level, like `-11.7 dB`.

The bars update live, several times a second. Watch them while someone talks, plays, or sings and you'll see them bounce.

---

## Reading the levels

dB ("decibels") is just the unit audio people use for loudness. Smaller (more negative) numbers = quieter. Bigger numbers (closer to zero) = louder. **0 dB is the ceiling — louder than that, the sound distorts.**

Here's the cheat sheet:

| What the meter shows | What it means |
|---|---|
| **-80 to -40 dB** | Silent. No signal arriving. Mic off / instrument not playing / cable unplugged. |
| **-40 to -25 dB** | Very quiet. Mic too far from the singer, instrument too soft, or gain set too low. |
| **-20 to -10 dB** | **Sweet spot.** This is what a healthy band or mic looks like. Aim here. |
| **-10 to -3 dB** | Getting loud. Fine for occasional peaks but not where the average should sit. |
| **-3 to 0 dB** | Too loud. Sound will distort. The band needs to back off the mic or turn down. |

**Color cues on the bar itself:**
- **Green** = good. Sit here.
- **Yellow** = warning. Between -20 and -3 dB. OK for peaks, not for average.
- **Red** = danger. Above -3 dB. Distortion territory. Tell the band to back off.

Tonight's acoustic sound check showed Patio Band hitting -11.7 dB while the guitarist played his loudest part — that's textbook sweet-spot. That's the picture you're aiming for.

---

## Common scenarios

### Band setup before doors

1. Find the band on the meter list. Look for **Pavillion Band**, **Patio Band**, or **VIP Band** — whichever room they're playing in.
2. Ask them to play **their loudest part** for 20 seconds (the chorus, the solo, whatever).
3. Watch the meter while they play. You want the **peaks** to hit around **-10 dB** and the **average** to sit around **-15 to -18 dB**.
4. If the bar is barely moving (stuck below -25 dB), tell the band "you're a little quiet — can you turn up?" They handle their own gear; you're just reporting what you see.
5. If the bar is slamming into red (above -3 dB), tell them "you're peaking too hot — back off a bit." Again, they adjust their gear.
6. Done. You've sound-checked them in under a minute.

### Paging mic not working

1. Pick up the paging mic and speak into it normally ("test, test").
2. Watch the **MIC 1** or **MIC 2** row on the iPad.
3. **Bar bounces when you talk** = the mic itself is fine, the signal is reaching us. The problem is downstream — check `[[MIC_NOT_WORKING]]` for the zone routing and mute checks.
4. **Bar stays flat** = the mic isn't sending. Check that it's powered on (battery), unmuted, and the cable is plugged in.

### Guest DJ shows up

1. Their gear plugs into the **DJ Audio** input (input 11 on the rack).
2. After they cable up, ask them to play a track at their normal performance volume.
3. Watch the **DJ Audio** row. Same rule as a band — peaks around -10 dB, average around -15 to -18 dB.
4. If their level is way off, point them at the iPad: "here's your meter — adjust your output until you're peaking around -10."
5. They handle their own mix from there.

---

## If this didn't work

**All the meters are flat — every row stuck at -80 dB:**
The audio brain (the Atlas box on the wall) is probably disconnected. Tap the **gear icon** on the iPad (top right) and open `/system-admin`, then tap **Watchers**. If Atlas shows red or "offline," text the manager — they'll need to restart the rack. This isn't a bartender fix.

**One meter shows lots of signal but nobody can hear that channel in the room:**
The signal is arriving but the zone is silenced or routed somewhere else. Go to the Audio tab → Zones section. Check that the zone (Pavillion / Patio / VIP / etc.) isn't **muted** and is set to the right **source**. See `[[MUSIC_OR_AUDIO_PROBLEM]]`.

**One specific channel is dead — the band's mic isn't moving the meter:**
Walk over to the rack and check the physical XLR cable for that input. Is it actually plugged in? Is the mic powered on (if it's a condenser)? Is there a stand-by switch on the mic itself? If everything looks plugged in and the meter still doesn't move, that input might be broken — switch them to a different input and tell the manager.

---

## What NOT to do

- **Don't crank the Atlas input gain to mask a quiet band.** If the band sounds quiet, that's a band problem — they fix it on their own gear. Cranking gain on our side adds hiss and distortion without making them sound better.
- **Don't mute Atlas inputs.** Mute is for **zones** (rooms), not inputs. Muting an input cuts that source for everyone, in every room, forever — until someone unmutes it. That's almost never what you want.
- **Don't reset peak levels or hit "calibrate" during a live song.** The meters reset themselves. If you see a button labeled "reset" or "calibrate" anywhere near the meters, leave it alone during service.
- **Don't change input names.** "Pavillion Band" is labeled that way because the wiring goes to the pavilion. Renaming it just makes the next bartender confused.

---

## A few things worth knowing

- **The meters are just looking, not touching.** Watching the bars doesn't change anything. You can stare at them all night.
- **Green is good. Yellow is OK. Red is bad.** If you remember only one thing, remember that.
- **Bands fix their own mix.** Your job is to report what you see ("you're too quiet" or "you're peaking red"). Their job is to adjust their amp or mic.
- **The meters lag by less than a second.** What you see is essentially live. If something happens in the room, the meter shows it right away.
- **Note about the wireless mics:** the house wireless system is for paging and hosted events (trivia, MC nights, manager announcements). If a karaoke crew comes in, they bring their own gear — that won't show on these meters.

---

## Related

- `[[MIC_NOT_WORKING]]` — full troubleshooting if a wireless mic itself is broken (dead battery, mute, IR sync, interference).
- `[[WRONG_CHANNEL_ON_TV]]` — if a TV is on the wrong source, not an audio problem.
- `[[POWER_AND_NETWORK_TVS]]` — if equipment in the rack has lost power.
- `[[MUSIC_OR_AUDIO_PROBLEM]]` — zone-level audio (mute, routing, volume per room).

---

## Quick recap

1. Audio tab → **Real-time Audio Meters**.
2. Green bar = good, yellow = caution, red = too loud.
3. **Sweet spot is -20 to -10 dB.** Aim peaks around -10.
4. Bar moves = signal reaching us. Bar flat = something upstream is broken (mic, cable, instrument).
5. You can't break anything by looking. Look freely.

You've got this.
