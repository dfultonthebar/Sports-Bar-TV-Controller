/**
 * Fix Cable Box Device Paths
 *
 * Updates all cable boxes to use the correct CEC adapter device path (/dev/ttyACM0)
 */

import { db, schema } from '../src/db'
import { eq } from 'drizzle-orm'

async function fixCableBoxPaths() {
  try {
    console.log('Fetching CEC devices...')

    // Get all CEC devices
    const cecDevices = await db.select().from(schema.cecDevices).all()
    console.log(`Found ${cecDevices.length} CEC devices:`)
    cecDevices.forEach(dev => {
      console.log(`  - ${dev.id}: ${dev.name} (${dev.devicePath}) [${dev.deviceType}]`)
    })

    // Get all cable boxes
    const cableBoxes = await db.select().from(schema.cableBoxes).all()
    console.log(`\nFound ${cableBoxes.length} cable boxes:`)
    cableBoxes.forEach(box => {
      console.log(`  - ${box.id}: ${box.name} (CEC Device: ${box.cecDeviceId})`)
    })

    // Find or create the correct CEC device for /dev/ttyACM0
    const correctDevice = cecDevices.find(d => d.devicePath === '/dev/ttyACM0')

    if (!correctDevice) {
      console.log('\n❌ No CEC device found for /dev/ttyACM0')
      console.log('Creating new CEC device for /dev/ttyACM0...')

      const newDevice = await db.insert(schema.cecDevices).values({
        name: 'Pulse-Eight USB CEC Adapter',
        devicePath: '/dev/ttyACM0',
        deviceType: 'cable_box',
        isActive: true,
        description: 'Main Pulse-Eight USB-CEC Adapter for cable box control'
      }).returning().get()

      console.log(`✅ Created new CEC device: ${newDevice.id}`)

      // Update all cable boxes to use this device
      for (const box of cableBoxes) {
        await db.update(schema.cableBoxes)
          .set({
            cecDeviceId: newDevice.id,
            updatedAt: new Date().toISOString()
          })
          .where(eq(schema.cableBoxes.id, box.id))
          .run()

        console.log(`  ✅ Updated ${box.name} to use ${newDevice.devicePath}`)
      }
    } else {
      console.log(`\n✅ Found correct CEC device: ${correctDevice.id} (${correctDevice.devicePath})`)

      // Update all cable boxes to use this device
      for (const box of cableBoxes) {
        if (box.cecDeviceId !== correctDevice.id) {
          await db.update(schema.cableBoxes)
            .set({
              cecDeviceId: correctDevice.id,
              updatedAt: new Date().toISOString()
            })
            .where(eq(schema.cableBoxes.id, box.id))
            .run()

          console.log(`  ✅ Updated ${box.name} to use ${correctDevice.devicePath}`)
        } else {
          console.log(`  ⏭️  ${box.name} already uses ${correctDevice.devicePath}`)
        }
      }
    }

    console.log('\n✅ All cable boxes updated successfully!')

    // Verify the changes
    console.log('\n=== Verification ===')
    const updatedBoxes = await db
      .select({
        id: schema.cableBoxes.id,
        name: schema.cableBoxes.name,
        devicePath: schema.cecDevices.devicePath,
      })
      .from(schema.cableBoxes)
      .leftJoin(schema.cecDevices, eq(schema.cableBoxes.cecDeviceId, schema.cecDevices.id))
      .all()

    updatedBoxes.forEach(box => {
      console.log(`  ${box.name}: ${box.devicePath}`)
    })

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

fixCableBoxPaths().then(() => {
  console.log('\n✨ Done!')
  process.exit(0)
})
