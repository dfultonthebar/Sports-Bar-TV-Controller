import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { ObsbotTail2 } from '@sports-bar/obsbot'

/** Shared camera lookup used by every /api/obsbot/cameras/[id]/* route. */
export async function getCameraById(id: string) {
  return db.select()
    .from(schema.obsbotCameras)
    .where(eq(schema.obsbotCameras.id, id))
    .limit(1)
    .get()
}

export function cameraController(camera: { ipAddress: string; viscaPort: number }): ObsbotTail2 {
  return new ObsbotTail2({ ipAddress: camera.ipAddress, viscaPort: camera.viscaPort })
}
