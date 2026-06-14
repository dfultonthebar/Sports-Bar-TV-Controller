#!/usr/bin/env npx tsx
/**
 * v2.54.49 — seed curated bartender Q→A pairs into the QAEntry table.
 *
 * Source: the 9 docs/bartender-help/*.md files which contain triage flows
 * already written in bartender-grade plain English (appearance-based hardware
 * names, "you can't break it", numbered steps, manager+photo escalation).
 *
 * Why curated (not auto-extracted from MD): the bartender voice is
 * intentional and brittle to autoregressive extraction. These are
 * hand-summarized question→answer pairs that exercise the bartender-mode
 * register (chat/route.ts:404 + llm-client.ts BARTENDER_SYSTEM_PROMPT).
 *
 * Idempotent: deletes all prior `curated_bartender_%` rows before inserting,
 * so re-running this script is a clean reseed (not an append). The QAEntry
 * table has no UNIQUE on `question`, so an additive approach would dupe.
 *
 * Run:  npx tsx scripts/seed-bartender-qa.ts
 */
import { db, schema } from '@sports-bar/database'
import { like } from 'drizzle-orm'

const ENTRIES: Array<{
  q: string
  a: string
  category: string
  tags: string
  sourceFile: string
}> = [
  // --- MIC_NOT_WORKING ---
  {
    q: "The wireless mic isn't working",
    a: "1) Look at the silver box with the antennas (the mic receiver). Are the channel lights green?\n2) Check the mic itself — green light on top, battery indicator showing bars.\n3) If lights are red/dim, swap in fresh AA batteries (drawer behind the bar).\n4) If lights look fine but still no sound, try the mic on a different channel using the receiver's front button.\n\nIf this doesn't fix it: text the manager with a photo of the silver box and a photo of the mic.",
    category: "audio",
    tags: "mic,wireless,shure,bartender",
    sourceFile: "docs/bartender-help/MIC_NOT_WORKING.md",
  },
  {
    q: "How do I change the batteries in the wireless mic?",
    a: "1) Twist the bottom of the mic counter-clockwise to open the battery compartment.\n2) Slide out the old AAs, drop in two fresh ones from the drawer behind the bar.\n3) Twist the bottom back on. The green light on top should come back on within a few seconds.\n\nIf the green light doesn't come on: text the manager.",
    category: "audio",
    tags: "mic,battery,shure,bartender",
    sourceFile: "docs/bartender-help/MIC_NOT_WORKING.md",
  },
  {
    q: "The mic was working but suddenly cut out",
    a: "Most common cause: another wireless device nearby is interfering. The mic and the other device might both be using the same frequency.\n\n1) Try toggling the mic power off and on (button on the bottom).\n2) If still cutting out, look at the iPad — there may be a yellow or cyan banner at the top of the Audio tab telling you exactly what's interfering.\n3) The fastest fix is usually the mic's IR Sync button — point the mic at the silver receiver box and press the small button on the receiver labeled SYNC. The mic should re-pair on a clean channel.\n\nIf the banner says \"SDR-confirmed\" or you can't get it working: text the manager with a photo of the iPad banner.",
    category: "audio",
    tags: "mic,interference,rf,shure,bartender",
    sourceFile: "docs/bartender-help/MIC_NOT_WORKING.md",
  },

  // --- WRONG_CHANNEL_ON_TV ---
  {
    q: "TV 3 has the wrong game on",
    a: "1) On the iPad, tap the **Video** tab.\n2) Tap the picture of TV 3 in the floor plan (it'll have a yellow or red border if it's not on a sports channel).\n3) Tap the channel you want from the preset row at the bottom (presets show channel name and number).\n\nIf the channel doesn't change after ~5 seconds: tap **Reboot Box** under the TV. That power-cycles the cable box.\n\nIf still broken: text the manager — include a photo of the TV and a photo of the iPad showing TV 3.",
    category: "video",
    tags: "channel,tv,preset,bartender",
    sourceFile: "docs/bartender-help/WRONG_CHANNEL_ON_TV.md",
  },
  {
    q: "How do I change the channel on TV 5?",
    a: "1) Open the iPad **Video** tab.\n2) Find TV 5 in the floor plan and tap it.\n3) Tap the channel you want from the preset buttons at the bottom of the screen.\n\nThe channel should change within 2-3 seconds. If it doesn't change, tap **Reboot Box** under that TV.\n\nNote: presets show the channel name (e.g. \"ESPN\") and number. If you don't see the channel you want, scroll the preset row sideways — there are more than fit on screen.",
    category: "video",
    tags: "channel,tv,preset,bartender",
    sourceFile: "docs/bartender-help/WRONG_CHANNEL_ON_TV.md",
  },
  {
    q: "The TV is stuck on a black screen",
    a: "1) On the iPad **Video** tab, tap that TV.\n2) Tap **Reboot Box** (power-cycles the cable/Fire Cube behind the TV).\n3) Wait ~30 seconds for the box to come back up.\n\nIf still black: there's a physical remote in the drawer behind the bar — point at the TV (not the box), press power.\n\nIf the TV itself is dead (no power light at all): text the manager with a photo of the TV.",
    category: "video",
    tags: "tv,black,reboot,bartender",
    sourceFile: "docs/bartender-help/WRONG_CHANNEL_ON_TV.md",
  },
  {
    q: "All the TVs went out at once",
    a: "This is almost always the cable / internet feed, not the TVs.\n\n1) Check if WiFi/internet is working on your phone or the iPad.\n2) If internet is also out, call the cable company.\n3) If internet is fine but TVs are out: text the manager with a photo of one of the TVs.\n\nDon't try to fix individual TVs in this situation — if they all went out together, the problem is upstream.",
    category: "video",
    tags: "tv,outage,bartender",
    sourceFile: "docs/bartender-help/WRONG_CHANNEL_ON_TV.md",
  },

  // --- MUSIC_OR_AUDIO_PROBLEM ---
  {
    q: "The music stopped in the patio",
    a: "1) Open the iPad **Audio** tab.\n2) Find the Patio zone row.\n3) Check the volume slider — is it at zero? If yes, slide it up.\n4) Check the source dropdown — is it set to \"Soundtrack\" (or the music source you want)?\n\nIf source is right and volume is up but still no sound, there might be a Priority active (a mic or paging trying to play). Look for a yellow banner at the top of the Audio tab — it'll say which zone is on priority.\n\nIf no banner and still no sound: text the manager with a photo of the iPad Audio tab.",
    category: "audio",
    tags: "music,zone,source,bartender",
    sourceFile: "docs/bartender-help/MUSIC_OR_AUDIO_PROBLEM.md",
  },
  {
    q: "How do I change the music to a different playlist?",
    a: "1) Open the iPad **Music** tab.\n2) The current playlist is shown at the top with album art.\n3) Tap any other playlist in the grid below to switch.\n\nThe change takes a few seconds. If you don't hear a difference, check the Audio tab to make sure your zone is set to Soundtrack as the source (not a game).",
    category: "audio",
    tags: "music,playlist,soundtrack,bartender",
    sourceFile: "docs/bartender-help/MUSIC_OR_AUDIO_PROBLEM.md",
  },
  {
    q: "The volume is too quiet in the main bar",
    a: "1) Open the iPad **Audio** tab.\n2) Find Main Bar (or your zone name).\n3) Slide the volume up.\n\nThe slider goes 0-100. Normal background music is usually around 40-60. Game audio (loud crowd) usually 60-80.\n\nIf the slider is already maxed and it's still too quiet: text the manager — the audio rack in the office might need attention.",
    category: "audio",
    tags: "volume,zone,bartender",
    sourceFile: "docs/bartender-help/MUSIC_OR_AUDIO_PROBLEM.md",
  },
  {
    q: "I want to play the audio from TV 4 in the patio",
    a: "1) Open the iPad **Audio** tab.\n2) Find the Patio zone row.\n3) Tap the source dropdown.\n4) Pick \"TV 4 Audio\" (or whatever name matches).\n\nThe audio switches within a couple seconds. To go back to music, change the dropdown back to Soundtrack.",
    category: "audio",
    tags: "source,zone,tv-audio,bartender",
    sourceFile: "docs/bartender-help/MUSIC_OR_AUDIO_PROBLEM.md",
  },

  // --- RF_INTERFERENCE_FOR_BARTENDERS ---
  {
    q: "What does the yellow banner at the top of the Audio tab mean?",
    a: "Yellow banner = someone is on the mic right now (a real person paged, or there's a real priority event). The system is automatically lowering music volume in the affected zones so people can hear them.\n\nNo action needed — it'll clear automatically a few seconds after they stop talking.\n\nIf it stays yellow for more than a minute and nobody is on the mic, look at the cyan banner (if present). If you don't see one: text the manager.",
    category: "audio",
    tags: "banner,priority,mic,bartender",
    sourceFile: "docs/bartender-help/RF_INTERFERENCE_FOR_BARTENDERS.md",
  },
  {
    q: "What does the cyan banner mean?",
    a: "Cyan banner = the system detected an unfamiliar wireless signal on the same frequency as your bar's mic. This is usually a TV broadcast crew, a nearby event, or someone in a neighboring business with their own wireless gear.\n\nIf you ALSO see a yellow banner at the same time, that yellow is probably FALSE — the system might be hearing the interference and thinking it's your mic. The audio is dipping for no real reason.\n\nWorkaround: do an IR Sync on the mic to bump it to a different frequency (point mic at the silver receiver, press the small SYNC button on the receiver).\n\nIf the cyan banner says \"SDR-confirmed\", definitely text the manager with a photo — the interference is strong enough that you'll see this happen again until the source moves away.",
    category: "audio",
    tags: "banner,rf,interference,bartender",
    sourceFile: "docs/bartender-help/RF_INTERFERENCE_FOR_BARTENDERS.md",
  },

  // --- General onboarding-style ---
  {
    q: "How do I use the bartender remote?",
    a: "The iPad behind the bar has tabs at the top: **Video** (TVs and channels), **Audio** (zone volume + source), **Music** (playlists), **Guide** (what games are on), **Power** (turn TVs on/off).\n\nFor most jobs:\n- Wrong game on a TV? → **Video** tab, tap the TV, pick a channel.\n- Music problem? → **Music** or **Audio** tab.\n- Mic problem? → ask me directly (\"the mic isn't working\") and I'll walk you through it.\n\nYou can't break anything by tapping around. If you get stuck, text the manager with a photo of what the iPad is showing.",
    category: "onboarding",
    tags: "remote,tabs,bartender",
    sourceFile: "docs/bartender-help/",
  },
  {
    q: "How do I escalate a problem to the manager?",
    a: "Text the manager with:\n1) A photo of what's wrong (the TV, the iPad, the silver mic box, etc.)\n2) A photo of the iPad if it's showing any colored banners or error messages.\n3) A short description: \"TV 3 stuck on black screen\" / \"mic 1 not working\" / \"music stopped in patio\".\n\nThat's enough for them to start helping you remotely. Don't try to fix anything dangerous (anything behind locked panels, anything plugged into the wall). The iPad and the physical remote drawer are safe to use.",
    category: "onboarding",
    tags: "escalation,manager,bartender",
    sourceFile: "docs/bartender-help/",
  },
  {
    q: "Where's the physical remote?",
    a: "In the drawer behind the bar (the same drawer as the extra mic batteries). It's a black universal remote.\n\nUse it when:\n- The iPad isn't responding.\n- A specific TV needs power or a button the iPad doesn't have.\n\nPoint at the TV itself (not the cable box). The remote works on every TV in the bar.",
    category: "onboarding",
    tags: "remote,physical,bartender",
    sourceFile: "docs/bartender-help/",
  },
  {
    q: "What does the iPad show when nothing is wrong?",
    a: "Normal state for the **Video** tab: floor plan showing all TVs with green borders (online). For the **Audio** tab: zone rows with their volume sliders and source dropdowns, no colored banners at the top.\n\nIf you see red borders on TVs, that TV is offline (might be unplugged or the box is dead). One or two red borders is normal — text the manager if it's most of them.\n\nIf you see a yellow or cyan banner on the Audio tab — that's fine, it usually clears itself in seconds.",
    category: "onboarding",
    tags: "ui,normal,bartender",
    sourceFile: "docs/bartender-help/",
  },

  // --- PUTTING_GAMES_ON_TVS (v2.54.49) ---
  {
    q: "Where is the Packers game?",
    a: "1) Open the iPad **Guide** tab. The top of the page shows tonight's games with channel info.\n2) Look for the Packers row — it'll show which channel is carrying the game (e.g. WBAY, ESPN, Fox).\n3) Tap the **Watch** button on the game tile. A picker appears asking which TVs to send it to.\n4) Tap the TVs you want, then **Confirm**.\n\nThe system tunes the right box and routes it to those TVs within 5-10 seconds.\n\nIf the game isn't in the Guide: it might not have started yet, or it's on a streaming app. Try the floating **Ask AI** button: \"Where's the Packers game tonight?\"",
    category: "video",
    tags: "games,guide,packers,bartender",
    sourceFile: "docs/bartender-help/PUTTING_GAMES_ON_TVS.md",
  },
  {
    q: "Put the Brewers on TV 7",
    a: "Two ways:\n\n**Fastest (Guide tab):** Open **Guide**, find the Brewers tile, tap **Watch**, pick TV 7 in the popup, **Confirm**.\n\n**Manual (Video tab):** Tap TV 7 on the floor plan, then tap the Brewers channel from the preset row at the bottom.\n\nBoth work. Guide is faster if you don't know which channel carries it; manual is faster if you already know the preset.",
    category: "video",
    tags: "games,brewers,assignment,bartender",
    sourceFile: "docs/bartender-help/PUTTING_GAMES_ON_TVS.md",
  },
  {
    q: "The 4 o'clock game is starting — how do I get set up?",
    a: "1) Open the iPad **Schedule** tab. You'll see scheduled games for tonight grouped by start time.\n2) Find the 4 PM game row. If the AI has already suggested TVs for it, you'll see a green **Apply** button — tap it and the routing happens automatically.\n3) If no AI suggestion, tap **Pick TVs** (or the TV icon), select the TVs you want, **Confirm**.\n\nDoing this BEFORE the game starts means no customer ever sees the wrong content. The system queues the change for kickoff.",
    category: "video",
    tags: "schedule,games,proactive,bartender",
    sourceFile: "docs/bartender-help/PUTTING_GAMES_ON_TVS.md",
  },
  {
    q: "The customer wants a channel I don't see in the presets",
    a: "1) On the Video tab, tap the TV.\n2) Below the preset row there should be a **More Channels** button or a numeric keypad.\n3) Type the channel number directly. Hit **Tune** or Enter.\n\nIf the channel doesn't come in: the bar might not subscribe to it. Don't promise the customer something you can't deliver — say \"let me check\" and text the manager with the channel number and name.",
    category: "video",
    tags: "channel,manual,bartender",
    sourceFile: "docs/bartender-help/PUTTING_GAMES_ON_TVS.md",
  },

  // --- AUDIO_ZONES_AND_GROUPS (v2.54.49) ---
  {
    q: "How do I make the patio quieter?",
    a: "1) Open the iPad **Audio** tab.\n2) Find the Patio zone row.\n3) Drag the volume slider down. Customers in the patio will hear the change within a couple seconds.\n\nFor full silence, tap the **mute** icon (speaker with the slash through it) instead of dragging to zero — easier to remember to unmute later.",
    category: "audio",
    tags: "volume,zone,patio,bartender",
    sourceFile: "docs/bartender-help/AUDIO_ZONES_AND_GROUPS.md",
  },
  {
    q: "I want dining room and bar to hear different games",
    a: "1) Open the iPad **Audio** tab.\n2) Find the **Dining Room** zone — tap the source dropdown, pick the TV audio for the game you want.\n3) Find the **Bar** zone — tap its source dropdown, pick the TV audio for a different game.\n\nEach zone has its own source picker. The TVs themselves don't need to change — only what audio plays through which speakers.\n\nTip: TV audio sources are usually labeled like \"TV 4 Audio\" or with the TV's location name.",
    category: "audio",
    tags: "zone,source,multi-game,bartender",
    sourceFile: "docs/bartender-help/AUDIO_ZONES_AND_GROUPS.md",
  },
  {
    q: "What's the difference between zones and groups?",
    a: "**Zone** = one area's audio (Patio, Bar, Dining Room). Each zone has its own volume + source.\n\n**Group** = several zones tied together so changing one changes them all. Example: a \"Front of House\" group that includes Bar + Dining + Hostess Stand — sliding that one group slider up raises all three at once.\n\nNot every bar has groups configured. If you only see individual zone sliders on your Audio tab, that's normal — you're controlling each zone directly.",
    category: "audio",
    tags: "zones,groups,concept,bartender",
    sourceFile: "docs/bartender-help/AUDIO_ZONES_AND_GROUPS.md",
  },

  // --- LIGHTING_AND_SCENES (v2.54.49) ---
  {
    q: "How do I dim the lights for trivia?",
    a: "1) Open the iPad **Lighting** tab (if your bar has it).\n2) Look for a scene called **Trivia**, **Dim**, **Evening**, or similar.\n3) Tap it once. The lights smoothly transition to that scene over a few seconds.\n\nIf there's no Trivia scene, tap any darker-looking scene — you can always tap a different one to change.\n\nNothing about scene-tapping is permanent. You can recall any scene at any time.",
    category: "lighting",
    tags: "scene,trivia,dim,bartender",
    sourceFile: "docs/bartender-help/LIGHTING_AND_SCENES.md",
  },
  {
    q: "The lights are too bright for the game",
    a: "1) Open the **Lighting** tab.\n2) Find a darker scene — usually **Game Day**, **Evening**, or **Sports**.\n3) Tap it.\n\nFor finer control, if your bar has Commercial Lighting zones, you can drag individual zone brightness sliders down rather than recalling a whole scene.",
    category: "lighting",
    tags: "scene,brightness,game-day,bartender",
    sourceFile: "docs/bartender-help/LIGHTING_AND_SCENES.md",
  },
  {
    q: "Fire alarm — turn on all the lights",
    a: "1) Open the iPad **Lighting** tab.\n2) Look at the Commercial Lighting panel (amber/yellow buttons).\n3) Tap **All Lights On**.\n\nEvery overhead light comes up to full brightness instantly. This is for emergencies and end-of-night cleanup.\n\nFollow your bar's emergency protocol after that — the lighting is only one part.",
    category: "lighting",
    tags: "emergency,all-on,bartender",
    sourceFile: "docs/bartender-help/LIGHTING_AND_SCENES.md",
  },

  // --- POWER_AND_NETWORK_TVS (v2.54.49) ---
  {
    q: "How do I turn all the TVs on at opening?",
    a: "1) Open the iPad **Power** tab.\n2) Tap **Toggle All TVs**.\n\nEvery TV in the bar starts powering on. It takes 5-20 seconds for all of them to respond — they don't all come on instantly. Watch the dots next to each TV change from red to green as they wake up.\n\nIf one or two stay red after a minute, tap that TV's individual power button. If multiple stay red: text the manager.",
    category: "power",
    tags: "power,opening,bulk,bartender",
    sourceFile: "docs/bartender-help/POWER_AND_NETWORK_TVS.md",
  },
  {
    q: "TV 5 won't turn on",
    a: "1) On the **Power** tab, tap TV 5's power button. Wait 5 seconds — some TVs are slow.\n2) Still off? Tap power once more. (Don't repeatedly tap — you might toggle it back to off.)\n3) Still nothing? Check the wall switch behind the TV — if it's flipped, flip it back on and wait 30 seconds for the TV to boot.\n4) If still dead: text the manager with a photo of the TV.\n\nDon't unplug the TV from the wall as a first step. Almost everything can be fixed in software.",
    category: "power",
    tags: "power,tv,troubleshoot,bartender",
    sourceFile: "docs/bartender-help/POWER_AND_NETWORK_TVS.md",
  },
  {
    q: "Manager wants me to pair a new Samsung TV",
    a: "This takes about 15 minutes and requires you to walk to the TV with the physical remote. Do NOT start during a rush.\n\n1) On the iPad **Power** tab, find the new TV's tile.\n2) Tap **Pair**.\n3) Walk to the TV. A popup appears on the TV screen asking to allow the connection.\n4) Using the physical remote (drawer behind the bar), navigate to **Allow** and press **OK**.\n5) Come back to the iPad — pairing should show \"Connected\" within 30 seconds.\n\nIf the popup never appears on the TV: text the manager. The TV might be on the wrong network.",
    category: "power",
    tags: "samsung,pairing,setup,bartender",
    sourceFile: "docs/bartender-help/POWER_AND_NETWORK_TVS.md",
  },

  // --- PRE_SHIFT_WALKTHROUGH (v2.54.49) ---
  {
    q: "What should I check when I clock in?",
    a: "5 minutes of checks before the first customer:\n\n1) Open the iPad **Video** tab. Read the **Shift Brief** at the top — it tells you what's important tonight (big games, neighborhood events, mic issues from yesterday).\n2) Go to the **Audio** tab. Check the mic battery tiles — green good, yellow swap-now, red swap-immediately.\n3) Go to the **Music** tab. Confirm the right playlist is going and the volume is reasonable.\n4) Back to **Audio**. Look for yellow or cyan banners at the top — at clock-in those should NOT be up.\n5) Glance at the **Video** floor plan — TVs you expect on should be on (green borders).\n\nDone in 5 minutes. Catch a dying mic battery now and you won't chase one down a hallway at 8 PM. Full walkthrough in `PRE_SHIFT_WALKTHROUGH.md`.",
    category: "onboarding",
    tags: "pre-shift,checklist,clock-in,bartender",
    sourceFile: "docs/bartender-help/PRE_SHIFT_WALKTHROUGH.md",
  },
  {
    q: "What is the Shift Brief?",
    a: "The Shift Brief is the box at the top of the iPad **Video** tab when you clock in. The system writes it once per day — it summarizes:\n\n- **Mic status** — is every channel reading healthy?\n- **Tonight's games** — what's big, what to watch for.\n- **Neighborhood events** — concerts at Lambeau or Resch, plays at the Fox Cities PAC. These often cause RF interference at our bar (cyan banner).\n- **Yesterday's recap** — were there banner events or mic problems on yesterday's shift?\n\nRead it. It saves you surprises later.\n\nIf the brief is blank or shows an error: that's a system thing, not you. Run the rest of the walkthrough manually.",
    category: "onboarding",
    tags: "shift-brief,ai,clock-in,bartender",
    sourceFile: "docs/bartender-help/PRE_SHIFT_WALKTHROUGH.md",
  },
  {
    q: "The mic battery tiles show yellow when I clocked in",
    a: "Yellow = will die mid-shift if you don't swap. Swap NOW.\n\n1) Grab fresh AAs from the drawer behind the bar.\n2) Twist the bottom of the mic counter-clockwise to open the battery compartment.\n3) Drop the old batteries out, put two fresh ones in (mind the + and −).\n4) Twist the bottom back on.\n5) The tile should change from yellow to green within 30 seconds.\n\nIf it stays yellow after a battery swap: the mic itself might be drawing more current than normal — text the manager.\n\nFull mic procedure in `MIC_NOT_WORKING.md`.",
    category: "audio",
    tags: "mic,battery,pre-shift,bartender",
    sourceFile: "docs/bartender-help/PRE_SHIFT_WALKTHROUGH.md",
  },

  // --- General v2.54.49 ---
  {
    q: "I see a banner I don't recognize on the Audio tab",
    a: "Two banners are normal:\n- **Yellow** = mic or page is active right now.\n- **Cyan** = wireless interference detected.\n\nAnything else (red, white, a different color, or text you don't recognize) is unusual. Take a screenshot of the iPad and text the manager. Don't try to dismiss it or restart anything.\n\nThe bar still runs normally while a banner is up — banners are warnings, not blockers.",
    category: "audio",
    tags: "banner,unknown,bartender",
    sourceFile: "docs/bartender-help/RF_INTERFERENCE_FOR_BARTENDERS.md",
  },
  {
    q: "What is Override-Learn?",
    a: "When the AI assigns games to TVs (Schedule tab → AI Suggest), it sometimes gets the wrong TVs. If you fix the assignment manually, the system **learns** from your correction so next time it gets it right.\n\nYou don't have to do anything special — just tap the right TV in the picker. The system watches and learns.\n\nIf you keep having to override the same way every shift, the AI is learning. Within a week or two, AI Suggest should match your preferences automatically.",
    category: "video",
    tags: "ai,learn,schedule,bartender",
    sourceFile: "docs/bartender-help/PUTTING_GAMES_ON_TVS.md",
  },
  {
    q: "How does the Ask AI button work?",
    a: "The purple **Ask AI** button is in the bottom-right corner of every iPad screen. Tap it to open a chat. Type your question in plain English:\n\n- \"The mic isn't working\"\n- \"Where's the Brewers game?\"\n- \"Why is there a yellow banner?\"\n\nThe AI knows your bar's specific zone names, TV locations, channel presets, and the bartender how-to docs. It'll give you steps you can act on right now.\n\nIf it can't answer (network issue, AI down): just text the manager. The basic iPad controls work without the AI.",
    category: "onboarding",
    tags: "ai,chat,help,bartender",
    sourceFile: "docs/bartender-help/PRE_SHIFT_WALKTHROUGH.md",
  },
]

async function main() {
  const deleted = await db
    .delete(schema.qaEntries)
    .where(like(schema.qaEntries.sourceType, 'curated_bartender_%'))
  const deletedCount = (deleted as any)?.changes ?? (deleted as any)?.rowsAffected ?? 'unknown'
  console.log(`Deleted prior curated_bartender_% rows: ${deletedCount}`)

  let inserted = 0
  let failed = 0

  for (const e of ENTRIES) {
    try {
      await db.insert(schema.qaEntries).values({
        question: e.q,
        answer: e.a,
        category: e.category,
        tags: e.tags,
        sourceFile: e.sourceFile,
        sourceType: 'curated_bartender_v2.54.49',
        confidence: 1.0,
        isActive: true,
      })
      inserted++
      console.log(`  ✓ "${e.q.slice(0, 60)}..."`)
    } catch (err: any) {
      failed++
      console.log(`  ✗ "${e.q.slice(0, 60)}..." FAILED: ${err?.message}`)
    }
  }

  console.log(`\nSUMMARY: ${inserted} inserted, ${failed} failed (${ENTRIES.length} total)`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
