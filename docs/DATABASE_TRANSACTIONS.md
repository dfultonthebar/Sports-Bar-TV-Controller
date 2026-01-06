# Database Transactions Guide

## Overview

This document provides comprehensive guidance on using database transactions in the Sports-Bar-TV-Controller system. Transactions ensure data consistency and integrity by making multi-step operations atomic - they either all succeed or all fail together.

## Table of Contents

- [Why Use Transactions?](#why-use-transactions)
- [Transaction Wrapper API](#transaction-wrapper-api)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)

## Why Use Transactions?

Transactions are critical for maintaining data integrity in multi-step operations:

### Without Transactions (❌ RISKY)
```typescript
// PROBLEM: If step 2 or 3 fails, step 1 is already committed
await db.insert(config).values(newConfig)  // Step 1: Committed
await db.insert(auditLog).values(log)      // Step 2: Might fail
await db.update(cache).set(invalidate)     // Step 3: Never executes if step 2 fails
```

**Result**: Database is in inconsistent state - config is created but not logged or cached.

### With Transactions (✅ SAFE)
```typescript
await withTransaction(async (tx) => {
  await tx.insert(config).values(newConfig)  // Step 1
  await tx.insert(auditLog).values(log)      // Step 2
  await tx.update(cache).set(invalidate)     // Step 3
  // All steps commit together, or all roll back on error
})
```

**Result**: Either all operations succeed, or none do. Data stays consistent.

## Transaction Wrapper API

### Core Functions

#### `withTransaction<T>`

Execute operations within a transaction with automatic rollback on error.

```typescript
import { withTransaction } from '@/lib/db/transaction-wrapper'

const result = await withTransaction(async (tx) => {
  // Your database operations here
  const record = await tx.insert(table).values(data).returning().get()
  return record
}, {
  name: 'operation-name',     // For logging
  maxRetries: 3,              // Retry on transient failures
  retryDelay: 100,            // Delay between retries (ms)
  timeout: 30000,             // Transaction timeout (ms)
  isolationLevel: 'IMMEDIATE' // SQLite isolation level
})
```

#### `batchTransaction<T>`

Execute multiple operations in a single transaction.

```typescript
import { batchTransaction } from '@/lib/db/transaction-wrapper'

const [result1, result2, result3] = await batchTransaction([
  (tx) => tx.insert(table1).values(data1).returning().get(),
  (tx) => tx.insert(table2).values(data2).returning().get(),
  (tx) => tx.update(table3).set(data3).where(condition)
], {
  name: 'batch-operation'
})
```

#### `transactionHelpers`

Convenience helpers for common transaction patterns.

```typescript
import { transactionHelpers } from '@/lib/db/transaction-wrapper'

// Create with audit log
const record = await transactionHelpers.createWithAudit(
  async (tx) => {
    return await tx.insert(table).values(data).returning().get()
  },
  {
    action: 'record_created',
    details: { recordType: 'config' },
    userId: 'user123'
  }
)

// Update with audit log
await transactionHelpers.updateWithAudit(
  async (tx) => {
    return await tx.update(table).set(updates).where(condition).returning().get()
  },
  {
    action: 'record_updated',
    details: { changes: updates },
    userId: 'user123'
  }
)

// Delete with audit log
await transactionHelpers.deleteWithAudit(
  async (tx) => {
    return await tx.delete(table).where(condition).returning().get()
  },
  {
    action: 'record_deleted',
    details: { recordId: id },
    userId: 'user123'
  }
)
```

## Usage Examples

### Example 1: Matrix Route Change

Ensure route change and database update happen atomically:

```typescript
import { withTransaction } from '@/lib/db/transaction-wrapper'

export async function routeMatrix(inputNum: number, outputNum: number) {
  return await withTransaction(async (tx) => {
    // Send hardware command first
    const commandSuccess = await sendWolfPackCommand(...)

    if (!commandSuccess) {
      throw new Error('Hardware command failed')
    }

    // Update database record
    const existingRoute = await tx.select()
      .from(schema.matrixRoutes)
      .where(eq(schema.matrixRoutes.outputNum, outputNum))
      .get()

    if (existingRoute) {
      await tx.update(schema.matrixRoutes)
        .set({ inputNum, updatedAt: now })
        .where(eq(schema.matrixRoutes.id, existingRoute.id))
    } else {
      await tx.insert(schema.matrixRoutes)
        .values({ inputNum, outputNum, createdAt: now })
    }

    return true
  }, {
    name: `matrix-route-${inputNum}-to-${outputNum}`,
    maxRetries: 2
  })
}
```

### Example 2: Configuration Update with Audit

Update configuration and log the change atomically:

```typescript
import { transactionHelpers } from '@/lib/db/transaction-wrapper'

export async function updateMatrixConfig(configId: string, updates: any) {
  return await transactionHelpers.updateWithAudit(
    async (tx) => {
      // Deactivate other configs if this one is being activated
      if (updates.isActive) {
        await tx.update(schema.matrixConfigurations)
          .set({ isActive: false })
          .where(ne(schema.matrixConfigurations.id, configId))
      }

      // Update the target config
      const [updated] = await tx.update(schema.matrixConfigurations)
        .set(updates)
        .where(eq(schema.matrixConfigurations.id, configId))
        .returning()

      return updated
    },
    {
      action: 'matrix_config_updated',
      details: { configId, updates },
      userId: 'admin'
    },
    { name: 'update-matrix-config' }
  )
}
```

### Example 3: Bulk Preset Reordering

Reorder multiple presets atomically:

```typescript
import { withTransaction } from '@/lib/db/transaction-wrapper'

export async function reorderPresets(deviceType: string) {
  return await withTransaction(async (tx) => {
    // Get all presets sorted by usage
    const presets = await tx.select()
      .from(schema.channelPresets)
      .where(eq(schema.channelPresets.deviceType, deviceType))
      .orderBy(desc(schema.channelPresets.usageCount))
      .all()

    // Update order for each preset
    for (let i = 0; i < presets.length; i++) {
      await tx.update(schema.channelPresets)
        .set({ order: i, updatedAt: now })
        .where(eq(schema.channelPresets.id, presets[i].id))
    }

    return { reordered: presets.length }
  }, {
    name: 'reorder-presets',
    maxRetries: 3
  })
}
```

### Example 4: Scheduled Command with Validation

Create scheduled command with validation and logging:

```typescript
import { transactionHelpers } from '@/lib/db/transaction-wrapper'

export async function createScheduledCommand(data: CommandData) {
  return await transactionHelpers.createWithAudit(
    async (tx) => {
      // Validate that target outputs exist
      const outputs = await tx.select()
        .from(schema.matrixOutputs)
        .where(inArray(schema.matrixOutputs.channelNumber, data.targets))
        .all()

      if (outputs.length !== data.targets.length) {
        throw new Error('Some target outputs do not exist')
      }

      // Calculate next execution time
      const nextExecution = calculateNextExecution(data.scheduleData)

      // Create the command
      const [command] = await tx.insert(schema.scheduledCommands)
        .values({
          ...data,
          nextExecution,
          enabled: true
        })
        .returning()

      return command
    },
    {
      action: 'scheduled_command_created',
      details: { commandType: data.commandType, targetCount: data.targets.length },
      userId: data.createdBy
    },
    { name: 'create-scheduled-command' }
  )
}
```

## Best Practices

### ✅ DO

1. **Use transactions for multi-step operations**
   ```typescript
   await withTransaction(async (tx) => {
     await tx.insert(...)
     await tx.update(...)
     await tx.delete(...)
   })
   ```

2. **Keep transactions short and fast**
   ```typescript
   // Good: Fast, focused transaction
   await withTransaction(async (tx) => {
     await tx.insert(config).values(data)
     await tx.insert(auditLog).values(log)
   })
   ```

3. **Use descriptive transaction names**
   ```typescript
   withTransaction(operation, {
     name: 'update-matrix-config-with-validation'
   })
   ```

4. **Handle errors explicitly**
   ```typescript
   try {
     await withTransaction(async (tx) => {
       // operations
     })
   } catch (error) {
     logger.error('Transaction failed:', error)
     return NextResponse.json({
       success: false,
       error: 'Operation failed and was rolled back'
     }, { status: 500 })
   }
   ```

5. **Use appropriate retry counts**
   ```typescript
   // Hardware commands: fewer retries
   withTransaction(operation, { maxRetries: 2 })

   // Data operations: more retries
   withTransaction(operation, { maxRetries: 5 })
   ```

### ❌ DON'T

1. **Don't perform long operations in transactions**
   ```typescript
   // BAD: External API call inside transaction
   await withTransaction(async (tx) => {
     await tx.insert(...)
     await fetch('https://external-api.com/...') // ❌ SLOW!
   })

   // GOOD: External call outside transaction
   const apiResult = await fetch('https://external-api.com/...')
   await withTransaction(async (tx) => {
     await tx.insert(..., apiResult)
   })
   ```

2. **Don't nest withTransaction calls**
   ```typescript
   // BAD: Nested transactions
   await withTransaction(async (tx1) => {
     await withTransaction(async (tx2) => { // ❌ DON'T DO THIS
       ...
     })
   })

   // GOOD: Single transaction
   await withTransaction(async (tx) => {
     // All operations here
   })
   ```

3. **Don't ignore transaction errors**
   ```typescript
   // BAD: Silent failure
   await withTransaction(...).catch(() => {}) // ❌

   // GOOD: Proper error handling
   try {
     await withTransaction(...)
   } catch (error) {
     logger.error('Transaction failed:', error)
     throw error
   }
   ```

4. **Don't hold locks for too long**
   ```typescript
   // BAD: Long sleep in transaction
   await withTransaction(async (tx) => {
     await tx.insert(...)
     await sleep(10000) // ❌ Holds lock for 10 seconds!
   })
   ```

5. **Don't use transactions for single operations**
   ```typescript
   // BAD: Unnecessary transaction overhead
   await withTransaction(async (tx) => {
     return await tx.select().from(table).all() // ❌ Read-only, single op
   })

   // GOOD: Direct query
   await db.select().from(table).all()
   ```

## Common Patterns

### Pattern 1: Create-Update-Log

```typescript
await withTransaction(async (tx) => {
  const created = await tx.insert(table).values(data).returning().get()
  await tx.update(relatedTable).set({ relatedId: created.id })
  await tx.insert(auditLog).values({ action: 'created', id: created.id })
  return created
})
```

### Pattern 2: Conditional Update

```typescript
await withTransaction(async (tx) => {
  const current = await tx.select().from(table).where(condition).get()

  if (current.status === 'active') {
    await tx.update(table).set({ status: 'inactive' }).where(condition)
  }
})
```

### Pattern 3: Bulk Delete with Cascade

```typescript
await withTransaction(async (tx) => {
  const items = await tx.select().from(parent).where(condition).all()

  for (const item of items) {
    await tx.delete(children).where(eq(children.parentId, item.id))
  }

  await tx.delete(parent).where(condition)
})
```

### Pattern 4: Optimistic Locking

```typescript
await withTransaction(async (tx) => {
  const current = await tx.select()
    .from(table)
    .where(eq(table.id, id))
    .get()

  if (current.version !== expectedVersion) {
    throw new Error('Concurrent modification detected')
  }

  await tx.update(table)
    .set({ ...updates, version: current.version + 1 })
    .where(and(eq(table.id, id), eq(table.version, expectedVersion)))
})
```

## Error Handling

### Transaction Errors

```typescript
try {
  await withTransaction(async (tx) => {
    // operations
  })
} catch (error) {
  if (error.message.includes('timeout')) {
    // Transaction took too long
    return { error: 'Operation timed out', retryable: true }
  } else if (error.message.includes('locked')) {
    // Database was locked
    return { error: 'Database busy, please retry', retryable: true }
  } else {
    // Other error
    return { error: 'Transaction failed', retryable: false }
  }
}
```

### API Route Error Handling

```typescript
export async function POST(request: Request) {
  try {
    const data = await request.json()

    const result = await withTransaction(async (tx) => {
      // operations
    }, { name: 'api-operation' })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.error('API operation failed:', error)

    return NextResponse.json({
      success: false,
      error: 'Operation failed and was rolled back',
      details: error instanceof Error ? error.message : 'Unknown error',
      retryable: true
    }, { status: 500 })
  }
}
```

## Performance Considerations

### Transaction Overhead

Transactions add minimal overhead (~1-5ms) but provide critical safety:

```typescript
// Without transaction: ~10ms, RISKY
await db.insert(...)
await db.update(...)

// With transaction: ~12ms, SAFE
await withTransaction(async (tx) => {
  await tx.insert(...)
  await tx.update(...)
})
```

The 2ms overhead is worth the data consistency guarantee.

### Optimization Tips

1. **Batch similar operations**
   ```typescript
   // Instead of multiple transactions
   for (const item of items) {
     await withTransaction(async (tx) => {
       await tx.insert(...).values(item)
     })
   }

   // Use single transaction
   await withTransaction(async (tx) => {
     for (const item of items) {
       await tx.insert(...).values(item)
     }
   })
   ```

2. **Prepare data before transaction**
   ```typescript
   // Calculate and validate outside transaction
   const processedData = processData(rawData)
   validateData(processedData)

   // Then use in transaction
   await withTransaction(async (tx) => {
     await tx.insert(...).values(processedData)
   })
   ```

3. **Use batch operations when possible**
   ```typescript
   // Instead of loop
   for (const item of items) {
     await tx.insert(...).values(item)
   }

   // Use batch insert
   await tx.insert(...).values(items)
   ```

### SQLite-Specific Considerations

SQLite uses file-level locking:

- **WAL Mode**: Enabled in this system - allows concurrent reads during writes
- **Write Locks**: Only one write transaction at a time
- **Timeout**: Default 5 seconds for busy database
- **Retry Logic**: Automatically retries on `SQLITE_BUSY`

## Troubleshooting

### Problem: "Database is locked"

**Cause**: Another transaction is holding a write lock.

**Solution**:
```typescript
// Use automatic retry
await withTransaction(operation, {
  maxRetries: 5,
  retryDelay: 100
})
```

### Problem: "Transaction timeout"

**Cause**: Transaction took longer than configured timeout.

**Solution**:
```typescript
// Increase timeout for long operations
await withTransaction(operation, {
  timeout: 60000 // 60 seconds
})

// Or optimize the operation to be faster
```

### Problem: "Cannot start transaction within a transaction"

**Cause**: Attempted nested transaction.

**Solution**:
```typescript
// Flatten the operations into single transaction
await withTransaction(async (tx) => {
  // All operations here, no nested withTransaction calls
})
```

### Problem: Partial data after error

**Cause**: Operations performed outside transaction.

**Solution**:
```typescript
// Move all related operations inside transaction
await withTransaction(async (tx) => {
  await tx.insert(...)  // This is protected
  await tx.update(...)  // This is protected
})

// Not this:
await db.insert(...)  // ❌ Not protected
await withTransaction(async (tx) => {
  await tx.update(...)
})
```

### Problem: Slow transaction performance

**Cause**: Long operations or external calls in transaction.

**Solution**:
```typescript
// Move slow operations outside
const externalData = await fetchExternalData()
const processed = processData(externalData)

// Fast transaction
await withTransaction(async (tx) => {
  await tx.insert(...).values(processed)
})
```

## Migration Guide

### Converting Existing Code

**Before** (No transaction):
```typescript
export async function POST(request: Request) {
  const data = await request.json()

  const config = await db.insert(configs).values(data).returning().get()
  await db.insert(logs).values({ configId: config.id, action: 'created' })

  return NextResponse.json({ success: true, config })
}
```

**After** (With transaction):
```typescript
import { withTransaction } from '@/lib/db/transaction-wrapper'

export async function POST(request: Request) {
  try {
    const data = await request.json()

    const config = await withTransaction(async (tx) => {
      const cfg = await tx.insert(configs).values(data).returning().get()
      await tx.insert(logs).values({ configId: cfg.id, action: 'created' })
      return cfg
    }, { name: 'create-config' })

    return NextResponse.json({ success: true, config })
  } catch (error) {
    logger.error('Failed to create config:', error)
    return NextResponse.json({
      success: false,
      error: 'Operation failed and was rolled back'
    }, { status: 500 })
  }
}
```

## Testing Transactions

See `/home/ubuntu/Sports-Bar-TV-Controller/tests/integration/transactions.test.ts` for comprehensive test examples.

Key testing scenarios:
- Successful commits
- Automatic rollbacks on error
- Retry logic for transient failures
- Batch operations
- Performance metrics

## Additional Resources

- **Source Code**: `/home/ubuntu/Sports-Bar-TV-Controller/src/lib/db/transaction-wrapper.ts`
- **Tests**: `/home/ubuntu/Sports-Bar-TV-Controller/tests/integration/transactions.test.ts`
- **Drizzle ORM Docs**: https://orm.drizzle.team/docs/transactions
- **SQLite Transaction Docs**: https://www.sqlite.org/lang_transaction.html

## Support

For questions or issues:
1. Check this documentation
2. Review test examples
3. Check system logs for transaction errors
4. Review TransactionMonitor stats for performance issues
