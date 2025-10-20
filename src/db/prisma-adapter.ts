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
      const data = { ...args.data }
      // Handle updatedAt if not provided - convert Date to ISO string for SQLite
      if (!data.updatedAt && table.updatedAt) {
        data.updatedAt = new Date().toISOString()
      }
      // Convert any Date objects to ISO strings for SQLite compatibility
      Object.keys(data).forEach(key => {
        if (data[key] instanceof Date) {
          data[key] = data[key].toISOString()
        }
      })
      return db.insert(table).values(data).returning().get()
    },
    
    createMany: async (args: any) => {
      const data = args.data
      // Handle updatedAt for each record - convert Date to ISO string for SQLite
      const records = data.map((record: any) => {
        const rec = { ...record }
        if (!rec.updatedAt && table.updatedAt) {
          rec.updatedAt = new Date().toISOString()
        }
        // Convert any Date objects to ISO strings for SQLite compatibility
        Object.keys(rec).forEach(key => {
          if (rec[key] instanceof Date) {
            rec[key] = rec[key].toISOString()
          }
        })
        return rec
      })
      return db.insert(table).values(records).returning().all()
    },
    
    update: async (args: any) => {
      const whereClause = convertWhere(table, args.where)
      const data = { ...args.data }
      // Handle updatedAt - convert Date to ISO string for SQLite
      if (table.updatedAt) {
        data.updatedAt = new Date().toISOString()
      }
      // Convert any Date objects to ISO strings for SQLite compatibility
      Object.keys(data).forEach(key => {
        if (data[key] instanceof Date) {
          data[key] = data[key].toISOString()
        }
      })
      return db.update(table).set(data).where(whereClause).returning().get()
    },
    
    updateMany: async (args: any) => {
      const whereClause = convertWhere(table, args.where)
      const data = { ...args.data }
      // Handle updatedAt - convert Date to ISO string for SQLite
      if (table.updatedAt) {
        data.updatedAt = new Date().toISOString()
      }
      // Convert any Date objects to ISO strings for SQLite compatibility
      Object.keys(data).forEach(key => {
        if (data[key] instanceof Date) {
          data[key] = data[key].toISOString()
        }
      })
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
        const updateData = { ...args.update }
        if (table.updatedAt) {
          updateData.updatedAt = new Date().toISOString()
        }
        // Convert any Date objects to ISO strings for SQLite compatibility
        Object.keys(updateData).forEach(key => {
          if (updateData[key] instanceof Date) {
            updateData[key] = updateData[key].toISOString()
          }
        })
        return db.update(table).set(updateData).where(whereClause).returning().get()
      } else {
        const createData = { ...args.create }
        if (!createData.updatedAt && table.updatedAt) {
          createData.updatedAt = new Date().toISOString()
        }
        // Convert any Date objects to ISO strings for SQLite compatibility
        Object.keys(createData).forEach(key => {
          if (createData[key] instanceof Date) {
            createData[key] = createData[key].toISOString()
          }
        })
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
