/**
 * Simple async file lock utility to prevent race conditions
 * during concurrent file read-modify-write operations.
 *
 * Uses a global singleton to ensure locks work across all modules.
 *
 * FIXED: Uses a proper queue pattern to ensure atomic lock acquisition.
 */

// Store lock queues in global object to ensure singleton behavior across Next.js modules
const globalAny = global as any
if (!globalAny.__fileLockQueues) {
  globalAny.__fileLockQueues = new Map<string, Promise<void>>()
}

const fileLockQueues: Map<string, Promise<void>> = globalAny.__fileLockQueues

/**
 * Execute an operation with exclusive file lock
 *
 * Uses a queue pattern: each new operation chains onto the previous one,
 * ensuring strictly serialized access to each file.
 *
 * @param filePath - The file path to lock (used as lock key)
 * @param operation - The async operation to perform
 * @returns The result of the operation
 */
export async function withFileLock<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
  // Get the current queue tail (or a resolved promise if no queue exists)
  const previousOperation = fileLockQueues.get(filePath) || Promise.resolve()

  // Create a new promise that will resolve when our operation is complete
  let resolve: () => void
  const ourOperation = new Promise<void>((r) => { resolve = r })

  // ATOMICALLY chain our operation to the queue
  // This must happen synchronously to prevent race conditions
  fileLockQueues.set(filePath, ourOperation)

  // Wait for all previous operations to complete
  await previousOperation

  try {
    // Now we have exclusive access - perform the operation
    return await operation()
  } finally {
    // Release the lock by resolving our promise
    resolve!()

    // Clean up the queue if we're the last operation
    // (only if no new operations were queued after us)
    if (fileLockQueues.get(filePath) === ourOperation) {
      fileLockQueues.delete(filePath)
    }
  }
}
