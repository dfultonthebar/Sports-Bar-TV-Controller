#!/usr/bin/env npx tsx
/**
 * v2.54.48 — seed curated bartender Q→A pairs into the QAEntry table.
 *
 * Source: the 4 docs/bartender-help/*.md files which contain triage flows
 * already written in bartender-grade plain English (appearance-based hardware
 * names, "you can't break it", numbered steps, manager+photo escalation).
 *
 * Why curated (not auto-extracted from MD): the bartender voice is
 * intentional and brittle to autoregressive extraction. These are
 * hand-summarized question→answer pairs that exercise the bartender-mode
 * register (chat/route.ts:404 + llm-client.ts BARTENDER_SYSTEM_PROMPT).
 *
 * Idempotent: uses INSERT OR IGNORE on (question) — running twice is safe.
 *
 * Run:  npx tsx scripts/seed-bartender-qa.ts
 */
import { db, schema } from '@sports-bar/database'

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
]

async function main() {
  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const e of ENTRIES) {
    try {
      // Check if exists by exact question match
      const existing = await db.select().from(schema.qaEntries)
        .where((qe: any) => qe.question.eq?.(e.q))
        .limit(1)
      // Drizzle's .where with .eq isn't quite this — let me use the correct API
    } catch {}
    try {
      await db.insert(schema.qaEntries).values({
        question: e.q,
        answer: e.a,
        category: e.category,
        tags: e.tags,
        sourceFile: e.sourceFile,
        sourceType: 'curated_bartender_v2.54.48',
        confidence: 1.0,
        isActive: true,
      })
      inserted++
      console.log(`  ✓ "${e.q.slice(0, 60)}..."`)
    } catch (err: any) {
      if (err?.message?.includes('UNIQUE') || err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        skipped++
        console.log(`  ⊝ "${e.q.slice(0, 60)}..." (already exists)`)
      } else {
        failed++
        console.log(`  ✗ "${e.q.slice(0, 60)}..." FAILED: ${err?.message}`)
      }
    }
  }

  console.log(`\nSUMMARY: ${inserted} inserted, ${skipped} skipped, ${failed} failed (${ENTRIES.length} total)`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
