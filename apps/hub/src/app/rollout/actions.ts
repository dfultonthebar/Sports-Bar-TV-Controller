'use server'

import { revalidatePath } from 'next/cache'
import { createRollout, listLocations, getRollout, updateRollout } from '@/lib/repo'
import { ackAction as ackRolloutAction } from '@/lib/rollout-engine'

export async function startRollout(formData: FormData) {
  const targetVersion = String(formData.get('targetVersion') || '').trim()
  if (!targetVersion) return
  const canaryLocationId = String(formData.get('canaryLocationId') || 'leg-lamp')
  const minSoakMinutes = Number(formData.get('minSoakMinutes') || 30)
  const createdBy = String(formData.get('createdBy') || 'operator')

  const waveLocationIds = listLocations()
    .map((l) => l.id)
    .filter((id) => id !== canaryLocationId && id !== 'holmgren-way')

  createRollout({ targetVersion, canaryLocationId, minSoakMinutes, createdBy, waveLocationIds })
  revalidatePath('/rollout')
}

export async function ackRollout(rolloutId: string, role: 'canary' | 'wave') {
  try {
    ackRolloutAction(rolloutId, role)
  } catch (e: any) {
    // Most likely the gate hasn't actually cleared yet (e.g. soak timer,
    // canary unhealthy) — computeNextAction's rejection message explains why.
    // Swallow here; the page re-render after revalidate shows the real
    // current nextAction, which is the useful signal, not a stack trace.
    console.error('[rollout] ackRollout rejected:', e?.message || e)
  }
  revalidatePath('/rollout')
}

export async function abortRollout(rolloutId: string) {
  if (!getRollout(rolloutId)) return
  updateRollout(rolloutId, { status: 'aborted' })
  revalidatePath('/rollout')
}
