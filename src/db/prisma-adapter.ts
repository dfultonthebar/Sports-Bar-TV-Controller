/**
 * Prisma Compatibility Adapter for Drizzle ORM
 * Provides a Prisma-like API interface to minimize code changes during migration
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

// Helper to handle includes (relations)
async function handleIncludes(result: any, includes: any, tableName: string) {
  if (!result || !includes) return result
  
  const isArray = Array.isArray(result)
  const records = isArray ? result : [result]
  
  // Process each include
  for (const [relationName, includeValue] of Object.entries(includes)) {
    if (!includeValue) continue
    
    // Handle different relation types based on table and relation name
    for (const record of records) {
      if (!record) continue
      
      // Handle matrixConfiguration relations
      if (tableName === 'matrixConfiguration') {
        if (relationName === 'inputs') {
          let inputsQuery = db.select().from(schema.matrixInputs)
            .where(eq(schema.matrixInputs.configId, record.id))
          
          // Handle where clause for inputs
          if (typeof includeValue === 'object' && includeValue.where) {
            const inputWhere = convertWhere(schema.matrixInputs, includeValue.where)
            if (inputWhere) {
              inputsQuery = inputsQuery.where(and(eq(schema.matrixInputs.configId, record.id), inputWhere)) as any
            }
          }
          
          record.inputs = inputsQuery.all()
        } else if (relationName === 'outputs') {
          let outputsQuery = db.select().from(schema.matrixOutputs)
            .where(eq(schema.matrixOutputs.configId, record.id))
          
          // Handle where clause for outputs
          if (typeof includeValue === 'object' && includeValue.where) {
            const outputWhere = convertWhere(schema.matrixOutputs, includeValue.where)
            if (outputWhere) {
              outputsQuery = outputsQuery.where(and(eq(schema.matrixOutputs.configId, record.id), outputWhere)) as any
            }
          }
          
          // Handle orderBy for outputs
          if (typeof includeValue === 'object' && includeValue.orderBy) {
            const orders = convertOrderBy(schema.matrixOutputs, includeValue.orderBy)
            if (orders.length > 0) {
              outputsQuery = outputsQuery.orderBy(...orders) as any
            }
          }
          
          record.outputs = outputsQuery.all()
        }
      }
      
      // Handle globalCacheDevice relations
      if (tableName === 'globalCacheDevice') {
        if (relationName === 'ports') {
          const ports = await db.select().from(schema.globalCachePorts)
            .where(eq(schema.globalCachePorts.deviceId, record.id))
            .all()
          record.ports = ports
        }
      }
      
      // Handle todo relations
      if (tableName === 'todo') {
        if (relationName === 'documents') {
          const documents = await db.select().from(schema.todoDocuments)
            .where(eq(schema.todoDocuments.todoId, record.id))
            .all()
          record.documents = documents
        }
      }
      
      // Handle audioProcessor relations
      if (tableName === 'audioProcessor') {
        if (relationName === 'audioZones') {
          const zones = await db.select().from(schema.audioZones)
            .where(eq(schema.audioZones.processorId, record.id))
            .all()
          record.audioZones = zones
        }
      }
      
      // Handle sportsGuideConfiguration relations
      if (tableName === 'sportsGuideConfiguration') {
        if (relationName === 'providers') {
          const providers = await db.select().from(schema.tvProviders)
            .where(eq(schema.tvProviders.configId, record.id))
            .all()
          
          // Handle nested includes for providers
          if (typeof includeValue === 'object' && includeValue.include?.inputs) {
            for (const provider of providers) {
              const inputs = await db.select().from(schema.providerInputs)
                .where(eq(schema.providerInputs.providerId, provider.id))
                .all()
              provider.inputs = inputs
            }
          }
          
          record.providers = providers
        }
      }
    }
  }
  
  return isArray ? records : records[0]
}

// Create model adapters for each table
function createModelAdapter(tableName: string, table: any) {
  // Handle null tables (missing models)
  if (!table) {
    return {
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => { throw new Error(`Model ${tableName} not implemented in Drizzle schema`) },
      createMany: async () => { throw new Error(`Model ${tableName} not implemented in Drizzle schema`) },
      update: async () => { throw new Error(`Model ${tableName} not implemented in Drizzle schema`) },
      updateMany: async () => { throw new Error(`Model ${tableName} not implemented in Drizzle schema`) },
      delete: async () => { throw new Error(`Model ${tableName} not implemented in Drizzle schema`) },
      deleteMany: async () => { throw new Error(`Model ${tableName} not implemented in Drizzle schema`) },
      count: async () => 0,
      upsert: async () => { throw new Error(`Model ${tableName} not implemented in Drizzle schema`) }
    }
  }
  
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
      
      let results = query.all()
      
      // Handle includes
      if (args?.include) {
        results = await handleIncludes(results, args.include, tableName)
      }
      
      return results
    },
    
    findUnique: async (args: any) => {
      const whereClause = convertWhere(table, args.where)
      let result = db.select().from(table).where(whereClause).limit(1).get()
      
      // Handle includes
      if (args?.include) {
        result = await handleIncludes(result, args.include, tableName)
      }
      
      return result
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
      
      let result = query.limit(1).get()
      
      // Handle includes
      if (args?.include) {
        result = await handleIncludes(result, args.include, tableName)
      }
      
      return result
    },
    
    create: async (args: any) => {
      const data = args.data
      // Handle updatedAt if not provided
      if (!data.updatedAt && table.updatedAt) {
        data.updatedAt = new Date()
      }
      return db.insert(table).values(data).returning().get()
    },
    
    createMany: async (args: any) => {
      const data = args.data
      // Handle updatedAt for each record
      const records = data.map((record: any) => {
        if (!record.updatedAt && table.updatedAt) {
          record.updatedAt = new Date()
        }
        return record
      })
      return db.insert(table).values(records).returning().all()
    },
    
    update: async (args: any) => {
      const whereClause = convertWhere(table, args.where)
      const data = args.data
      // Handle updatedAt
      if (table.updatedAt) {
        data.updatedAt = new Date()
      }
      return db.update(table).set(data).where(whereClause).returning().get()
    },
    
    updateMany: async (args: any) => {
      const whereClause = convertWhere(table, args.where)
      const data = args.data
      // Handle updatedAt
      if (table.updatedAt) {
        data.updatedAt = new Date()
      }
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
    
    upsert: async (args: any) => {
      const whereClause = convertWhere(table, args.where)
      const existing = await db.select().from(table).where(whereClause).limit(1).get()
      
      if (existing) {
        const updateData = args.update
        if (table.updatedAt) {
          updateData.updatedAt = new Date()
        }
        return db.update(table).set(updateData).where(whereClause).returning().get()
      } else {
        const createData = args.create
        if (!createData.updatedAt && table.updatedAt) {
          createData.updatedAt = new Date()
        }
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
  
  // Missing models - return empty adapters to prevent crashes
  channelPreset: createModelAdapter('channelPreset', null as any),
  selectedLeague: createModelAdapter('selectedLeague', null as any),
  soundtrackConfig: createModelAdapter('soundtrackConfig', null as any),
  soundtrackPlayer: createModelAdapter('soundtrackPlayer', null as any),
  chatSession: createModelAdapter('chatSession', null as any),
  matrixRoute: createModelAdapter('matrixRoute', null as any),
  aIGainAdjustmentLog: createModelAdapter('aIGainAdjustmentLog', null as any),
  aIGainConfiguration: createModelAdapter('aIGainConfiguration', null as any),
  directTVDevice: createModelAdapter('directTVDevice', null as any),
  document: createModelAdapter('document', null as any),
  
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
  irDevice: createModelAdapter('irDevice', schema.irDevices),
  irCommand: createModelAdapter('irCommand', schema.irCommands),
  irDatabaseCredentials: createModelAdapter('irDatabaseCredentials', schema.irDatabaseCredentials),
  
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
  }
}

export default prisma
