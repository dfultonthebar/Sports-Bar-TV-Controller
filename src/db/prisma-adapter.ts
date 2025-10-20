/**
 * @deprecated This Prisma Compatibility Adapter is DEPRECATED
 * 
 * Please migrate to direct Drizzle ORM usage with the db-helpers from @/lib/db-helpers
 * 
 * Migration Pattern:
 * OLD: import { prisma } from '@/lib/db'
 *      await prisma.schedule.findMany({ where: { enabled: true } })
 * 
 * NEW: import { findMany, eq } from '@/lib/db-helpers'
 *      import { schema } from '@/db'
 *      import { logger } from '@/lib/logger'
 *      await findMany('schedules', { where: eq(schema.schedules.enabled, true) })
 * 
 * See: src/app/api/schedules/route.ts and src/app/api/home-teams/route.ts for examples
 * 
 * This adapter is kept temporarily for backward compatibility but will be removed soon.
 * All new code should use direct Drizzle ORM with logging via db-helpers.
 */

import { eq, and, or, desc, asc, inArray, like, gte, lte, gt, lt, ne } from 'drizzle-orm'
import { db } from './index'
import * as schema from './schema'

// Helper to convert Prisma orderBy to Drizzle orderBy
function convertOrderBy(table: any, orderBy: any) {
if (!orderBy) return []

const orders: any[] = []

if (Array.isArray(orderBy)) {
orderBy.forEach(order => {
Object.entries(order).forEach(([field, direction]) => {
const column = table[field]
orders.push(direction === 'desc' ? desc(column) : asc(column))
})
})
} else {
Object.entries(orderBy).forEach(([field, direction]) => {
const column = table[field]
orders.push(direction === 'desc' ? desc(column) : asc(column))
})
}

return orders
}

// Helper to sanitize data for SQLite
function sanitizeData(data: any): any {
const sanitized: any = {}
for (const [key, value] of Object.entries(data)) {
if (value instanceof Date) {
// Convert Date objects to ISO string for SQLite
sanitized[key] = value.toISOString()
} else if (typeof value === 'boolean') {
// Convert boolean to number (0 or 1) for SQLite
sanitized[key] = value ? 1 : 0
} else if (value === undefined) {
// Skip undefined values
continue
} else {
sanitized[key] = value
}
}
return sanitized
}

// Helper to convert Prisma where to Drizzle where
function convertWhere(table: any, where: any): any {
if (!where) return undefined

const conditions: any[] = []

Object.entries(where).forEach(([field, value]) => {
const column = table[field]

if (value === null) {
conditions.push(eq(column, null))
} else if (typeof value === 'object' && value !== null) {
// Handle operators like gt, gte, lt, lte, contains, etc.
Object.entries(value).forEach(([op, val]) => {
switch (op) {
case 'gt':
conditions.push(gt(column, val))
break
case 'gte':
conditions.push(gte(column, val))
break
case 'lt':
conditions.push(lt(column, val))
break
case 'lte':
conditions.push(lte(column, val))
break
case 'not':
conditions.push(ne(column, val))
break
case 'in':
conditions.push(inArray(column, val as any[]))
break
case 'contains':
conditions.push(like(column, `%${val}%`))
break
case 'startsWith':
conditions.push(like(column, `${val}%`))
break
case 'endsWith':
conditions.push(like(column, `%${val}`))
break
default:
conditions.push(eq(column, val))
}
})
} else {
conditions.push(eq(column, value))
}
})

return conditions.length === 1 ? conditions[0] : and(...conditions)
}

// Create model adapters for each table
function createModelAdapter(tableName: string, table: any) {
return {
findMany: async (args?: any) => {
let query = db.select().from(table)

if (args?.where) {
const whereClause = convertWhere(table, args.where)
if (whereClause) query = query.where(whereClause) as any
}

if (args?.orderBy) {
const orders = convertOrderBy(table, args.orderBy)
if (orders.length > 0) query = query.orderBy(...orders) as any
}

if (args?.take) {
query = query.limit(args.take) as any
}

if (args?.skip) {
query = query.offset(args.skip) as any
}

return query.all()
},

findUnique: async (args: any) => {
const whereClause = convertWhere(table, args.where)
return db.select().from(table).where(whereClause).limit(1).get()
},

findFirst: async (args?: any) => {
let query = db.select().from(table)

if (args?.where) {
const whereClause = convertWhere(table, args.where)
if (whereClause) query = query.where(whereClause) as any
}

if (args?.orderBy) {
const orders = convertOrderBy(table, args.orderBy)
if (orders.length > 0) query = query.orderBy(...orders) as any
}

return query.limit(1).get()
},

create: async (args: any) => {
let data = args.data
// Handle updatedAt if not provided
if (!data.updatedAt && table.updatedAt) {
data.updatedAt = new Date()
}
// Sanitize data for SQLite
data = sanitizeData(data)
return db.insert(table).values(data).returning().get()
},

createMany: async (args: any) => {
const data = args.data
// Handle updatedAt for each record and sanitize
const records = data.map((record: any) => {
if (!record.updatedAt && table.updatedAt) {
record.updatedAt = new Date()
}
return sanitizeData(record)
})
return db.insert(table).values(records).returning().all()
},

update: async (args: any) => {
const whereClause = convertWhere(table, args.where)
let data = args.data
// Handle updatedAt
if (table.updatedAt) {
data.updatedAt = new Date()
}
// Sanitize data for SQLite
data = sanitizeData(data)
return db.update(table).set(data).where(whereClause).returning().get()
},

updateMany: async (args: any) => {
const whereClause = convertWhere(table, args.where)
let data = args.data
// Handle updatedAt
if (table.updatedAt) {
data.updatedAt = new Date()
}
// Sanitize data for SQLite
data = sanitizeData(data)
return db.update(table).set(data).where(whereClause).returning().all()
},

delete: async (args: any) => {
const whereClause = convertWhere(table, args.where)
return db.delete(table).where(whereClause).returning().get()
},

deleteMany: async (args: any) => {
const whereClause = convertWhere(table, args.where)
return db.delete(table).where(whereClause).returning().all()
},

count: async (args?: any) => {
let query = db.select().from(table)

if (args?.where) {
const whereClause = convertWhere(table, args.where)
if (whereClause) query = query.where(whereClause) as any
}

const results = query.all()
return results.length
},

aggregate: async (args?: any) => {
let query = db.select().from(table)

if (args?.where) {
const whereClause = convertWhere(table, args.where)
if (whereClause) query = query.where(whereClause) as any
}

const results = query.all()

// Calculate aggregates
const aggregates: any = {}

if (args?._count) {
aggregates._count = {}
if (args._count === true || args._count._all) {
aggregates._count._all = results.length
}
Object.keys(args._count).forEach(field => {
if (field !== '_all' && args._count[field]) {
aggregates._count[field] = results.filter(r => r[field] != null).length
}
})
}

if (args?._sum) {
aggregates._sum = {}
Object.keys(args._sum).forEach(field => {
if (args._sum[field]) {
aggregates._sum[field] = results.reduce((sum, r) => sum + (Number(r[field]) || 0), 0)
}
})
}

if (args?._avg) {
aggregates._avg = {}
Object.keys(args._avg).forEach(field => {
if (args._avg[field]) {
const validValues = results.filter(r => r[field] != null).map(r => Number(r[field]))
aggregates._avg[field] = validValues.length > 0 
? validValues.reduce((sum, v) => sum + v, 0) / validValues.length 
: null
}
})
}

if (args?._min) {
aggregates._min = {}
Object.keys(args._min).forEach(field => {
if (args._min[field]) {
const validValues = results.filter(r => r[field] != null).map(r => r[field])
aggregates._min[field] = validValues.length > 0 ? Math.min(...validValues.map(Number)) : null
}
})
}

if (args?._max) {
aggregates._max = {}
Object.keys(args._max).forEach(field => {
if (args._max[field]) {
const validValues = results.filter(r => r[field] != null).map(r => r[field])
aggregates._max[field] = validValues.length > 0 ? Math.max(...validValues.map(Number)) : null
}
})
}

return aggregates
},

groupBy: async (args: any) => {
let query = db.select().from(table)

if (args?.where) {
const whereClause = convertWhere(table, args.where)
if (whereClause) query = query.where(whereClause) as any
}

const results = query.all()

// Group by specified fields
const groups = new Map()
const groupByFields = Array.isArray(args.by) ? args.by : [args.by]

results.forEach(row => {
const key = groupByFields.map(field => row[field]).join('|')
if (!groups.has(key)) {
const groupData: any = {}
groupByFields.forEach(field => {
groupData[field] = row[field]
})
groups.set(key, { data: groupData, rows: [] })
}
groups.get(key).rows.push(row)
})

// Calculate aggregates for each group
const groupResults = []
for (const [key, group] of groups) {
const result: any = { ...group.data }

if (args._count) {
result._count = {}
if (args._count === true || args._count._all) {
result._count._all = group.rows.length
}
Object.keys(args._count).forEach(field => {
if (field !== '_all' && args._count[field]) {
result._count[field] = group.rows.filter(r => r[field] != null).length
}
})
}

if (args._sum) {
result._sum = {}
Object.keys(args._sum).forEach(field => {
if (args._sum[field]) {
result._sum[field] = group.rows.reduce((sum, r) => sum + (Number(r[field]) || 0), 0)
}
})
}

if (args._avg) {
result._avg = {}
Object.keys(args._avg).forEach(field => {
if (args._avg[field]) {
const validValues = group.rows.filter(r => r[field] != null).map(r => Number(r[field]))
result._avg[field] = validValues.length > 0 
? validValues.reduce((sum, v) => sum + v, 0) / validValues.length 
: null
}
})
}

groupResults.push(result)
}

return groupResults
},

upsert: async (args: any) => {
const whereClause = convertWhere(table, args.where)
const existing = await db.select().from(table).where(whereClause).limit(1).get()

if (existing) {
let updateData = args.update
if (table.updatedAt) {
updateData.updatedAt = new Date()
}
updateData = sanitizeData(updateData)
return db.update(table).set(updateData).where(whereClause).returning().get()
} else {
let createData = args.create
if (!createData.updatedAt && table.updatedAt) {
createData.updatedAt = new Date()
}
createData = sanitizeData(createData)
return db.insert(table).values(createData).returning().get()
}
}
}
}

// Create the Prisma-like client interface
export const prisma = {
// Audio models
audioProcessor: createModelAdapter('audioProcessor', schema.audioProcessors),
audioZone: createModelAdapter('audioZone', schema.audioZones),
audioScene: createModelAdapter('audioScene', schema.audioScenes),
audioMessage: createModelAdapter('audioMessage', schema.audioMessages),
audioInputMeter: createModelAdapter('audioInputMeter', schema.audioInputMeters),

// FireTV and scheduling models
fireTVDevice: createModelAdapter('fireTVDevice', schema.fireTVDevices),
schedule: createModelAdapter('schedule', schema.schedules),
scheduleLog: createModelAdapter('scheduleLog', schema.scheduleLogs),

// Home team models
homeTeam: createModelAdapter('homeTeam', schema.homeTeams),

// Matrix models
tvLayout: createModelAdapter('tvLayout', schema.tvLayouts),
matrixConfig: createModelAdapter('matrixConfig', schema.matrixConfigs),
matrixConfiguration: createModelAdapter('matrixConfiguration', schema.matrixConfigurations),
matrixInput: createModelAdapter('matrixInput', schema.matrixInputs),
matrixOutput: createModelAdapter('matrixOutput', schema.matrixOutputs),

// Device models
bartenderRemote: createModelAdapter('bartenderRemote', schema.bartenderRemotes),
deviceMapping: createModelAdapter('deviceMapping', schema.deviceMappings),
systemSettings: createModelAdapter('systemSettings', schema.systemSettings),

// Test and wolfpack models
testLog: createModelAdapter('testLog', schema.testLogs),
wolfpackMatrixRouting: createModelAdapter('wolfpackMatrixRouting', schema.wolfpackMatrixRoutings),
wolfpackMatrixState: createModelAdapter('wolfpackMatrixState', schema.wolfpackMatrixStates),

// Sports guide models
sportsGuideConfiguration: createModelAdapter('sportsGuideConfiguration', schema.sportsGuideConfigurations),
tvProvider: createModelAdapter('tvProvider', schema.tvProviders),
providerInput: createModelAdapter('providerInput', schema.providerInputs),

// TODO models
todo: createModelAdapter('todo', schema.todos),
todoDocument: createModelAdapter('todoDocument', schema.todoDocuments),

// AI Hub models
indexedFile: createModelAdapter('indexedFile', schema.indexedFiles),
qaEntry: createModelAdapter('qaEntry', schema.qaEntries),
trainingDocument: createModelAdapter('trainingDocument', schema.trainingDocuments),
apiKey: createModelAdapter('apiKey', schema.apiKeys),
qaGenerationJob: createModelAdapter('qaGenerationJob', schema.qaGenerationJobs),
processedFile: createModelAdapter('processedFile', schema.processedFiles),

// CEC models
cecConfiguration: createModelAdapter('cecConfiguration', schema.cecConfigurations),

// IR models
globalCacheDevice: createModelAdapter('globalCacheDevice', schema.globalCacheDevices),
globalCachePort: createModelAdapter('globalCachePort', schema.globalCachePorts),
iRDevice: createModelAdapter('irDevice', schema.irDevices),
irDevice: createModelAdapter('irDevice', schema.irDevices), // Alias for compatibility
iRCommand: createModelAdapter('irCommand', schema.irCommands),
irCommand: createModelAdapter('irCommand', schema.irCommands), // Alias for compatibility
iRDatabaseCredentials: createModelAdapter('irDatabaseCredentials', schema.irDatabaseCredentials),
irDatabaseCredentials: createModelAdapter('irDatabaseCredentials', schema.irDatabaseCredentials), // Alias for compatibility

// Chat and document models
chatSession: createModelAdapter('chatSession', schema.chatSessions),
document: createModelAdapter('document', schema.documents),

// Channel preset model
channelPreset: createModelAdapter('channelPreset', schema.channelPresets),

// Matrix route model
matrixRoute: createModelAdapter('matrixRoute', schema.matrixRoutes),

// AI Gain models
aIGainConfiguration: createModelAdapter('aiGainConfiguration', schema.aiGainConfigurations),
aiGainConfiguration: createModelAdapter('aiGainConfiguration', schema.aiGainConfigurations), // Alias for compatibility
aIGainAdjustmentLog: createModelAdapter('aiGainAdjustmentLog', schema.aiGainAdjustmentLogs),
aiGainAdjustmentLog: createModelAdapter('aiGainAdjustmentLog', schema.aiGainAdjustmentLogs), // Alias for compatibility

// Soundtrack models
soundtrackConfig: createModelAdapter('soundtrackConfig', schema.soundtrackConfigs),
soundtrackPlayer: createModelAdapter('soundtrackPlayer', schema.soundtrackPlayers),

// Sports guide models
selectedLeague: createModelAdapter('selectedLeague', schema.selectedLeagues),

// CEC models (alias for compatibility)
cECConfiguration: createModelAdapter('cecConfiguration', schema.cecConfigurations),
cecConfiguration: createModelAdapter('cecConfiguration', schema.cecConfigurations), // Alias for compatibility

// Provider models (alias for compatibility)
tVProvider: createModelAdapter('tvProvider', schema.tvProviders),
tvProvider: createModelAdapter('tvProvider', schema.tvProviders), // Alias for compatibility

// Q&A models (alias for compatibility)
qAEntry: createModelAdapter('qaEntry', schema.qaEntries),
qaEntry: createModelAdapter('qaEntry', schema.qaEntries), // Alias for compatibility
qAGenerationJob: createModelAdapter('qaGenerationJob', schema.qaGenerationJobs),
qaGenerationJob: createModelAdapter('qaGenerationJob', schema.qaGenerationJobs), // Alias for compatibility

// Utility methods
$connect: async () => {
console.log('[Prisma Adapter] Database connection maintained by Drizzle')
return Promise.resolve()
},

$disconnect: async () => {
console.log('[Prisma Adapter] Database connection will be closed on process exit')
return Promise.resolve()
},

$transaction: async (callback: any) => {
// Drizzle transactions would need to be implemented here
// For now, we'll execute the callback directly
return callback(prisma)
},

$queryRaw: async (query: any, ...values: any[]) => {
// For simple queries like SELECT 1, just return a mock result
console.log('[Prisma Adapter] $queryRaw called with query:', query)
return [{ result: 1 }]
}
}

export default prisma
