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
     4	 */
     5	
     6	import { eq, and, or, desc, asc, inArray, like, gte, lte, gt, lt, ne } from 'drizzle-orm'
     7	import { db } from './index'
     8	import * as schema from './schema'
     9	
    10	// Helper to convert Prisma orderBy to Drizzle orderBy
    11	function convertOrderBy(table: any, orderBy: any) {
    12	  if (!orderBy) return []
    13	  
    14	  const orders: any[] = []
    15	  
    16	  if (Array.isArray(orderBy)) {
    17	    orderBy.forEach(order => {
    18	      Object.entries(order).forEach(([field, direction]) => {
    19	        const column = table[field]
    20	        orders.push(direction === 'desc' ? desc(column) : asc(column))
    21	      })
    22	    })
    23	  } else {
    24	    Object.entries(orderBy).forEach(([field, direction]) => {
    25	      const column = table[field]
    26	      orders.push(direction === 'desc' ? desc(column) : asc(column))
    27	    })
    28	  }
    29	  
    30	  return orders
    31	}
    32	
    33	// Helper to sanitize data for SQLite
    34	function sanitizeData(data: any): any {
    35	  const sanitized: any = {}
    36	  for (const [key, value] of Object.entries(data)) {
    37	    if (value instanceof Date) {
    38	      // Convert Date objects to ISO string for SQLite
    39	      sanitized[key] = value.toISOString()
    40	    } else if (typeof value === 'boolean') {
    41	      // Convert boolean to number (0 or 1) for SQLite
    42	      sanitized[key] = value ? 1 : 0
    43	    } else if (value === undefined) {
    44	      // Skip undefined values
    45	      continue
    46	    } else {
    47	      sanitized[key] = value
    48	    }
    49	  }
    50	  return sanitized
    51	}
    52	
    53	// Helper to convert Prisma where to Drizzle where
    54	function convertWhere(table: any, where: any): any {
    55	  if (!where) return undefined
    56	  
    57	  const conditions: any[] = []
    58	  
    59	  Object.entries(where).forEach(([field, value]) => {
    60	    const column = table[field]
    61	    
    62	    if (value === null) {
    63	      conditions.push(eq(column, null))
    64	    } else if (typeof value === 'object' && value !== null) {
    65	      // Handle operators like gt, gte, lt, lte, contains, etc.
    66	      Object.entries(value).forEach(([op, val]) => {
    67	        switch (op) {
    68	          case 'gt':
    69	            conditions.push(gt(column, val))
    70	            break
    71	          case 'gte':
    72	            conditions.push(gte(column, val))
    73	            break
    74	          case 'lt':
    75	            conditions.push(lt(column, val))
    76	            break
    77	          case 'lte':
    78	            conditions.push(lte(column, val))
    79	            break
    80	          case 'not':
    81	            conditions.push(ne(column, val))
    82	            break
    83	          case 'in':
    84	            conditions.push(inArray(column, val as any[]))
    85	            break
    86	          case 'contains':
    87	            conditions.push(like(column, `%${val}%`))
    88	            break
    89	          case 'startsWith':
    90	            conditions.push(like(column, `${val}%`))
    91	            break
    92	          case 'endsWith':
    93	            conditions.push(like(column, `%${val}`))
    94	            break
    95	          default:
    96	            conditions.push(eq(column, val))
    97	        }
    98	      })
    99	    } else {
   100	      conditions.push(eq(column, value))
   101	    }
   102	  })
   103	  
   104	  return conditions.length === 1 ? conditions[0] : and(...conditions)
   105	}
   106	
   107	// Create model adapters for each table
   108	function createModelAdapter(tableName: string, table: any) {
   109	  return {
   110	    findMany: async (args?: any) => {
   111	      let query = db.select().from(table)
   112	      
   113	      if (args?.where) {
   114	        const whereClause = convertWhere(table, args.where)
   115	        if (whereClause) query = query.where(whereClause) as any
   116	      }
   117	      
   118	      if (args?.orderBy) {
   119	        const orders = convertOrderBy(table, args.orderBy)
   120	        if (orders.length > 0) query = query.orderBy(...orders) as any
   121	      }
   122	      
   123	      if (args?.take) {
   124	        query = query.limit(args.take) as any
   125	      }
   126	      
   127	      if (args?.skip) {
   128	        query = query.offset(args.skip) as any
   129	      }
   130	      
   131	      return query.all()
   132	    },
   133	    
   134	    findUnique: async (args: any) => {
   135	      const whereClause = convertWhere(table, args.where)
   136	      return db.select().from(table).where(whereClause).limit(1).get()
   137	    },
   138	    
   139	    findFirst: async (args?: any) => {
   140	      let query = db.select().from(table)
   141	      
   142	      if (args?.where) {
   143	        const whereClause = convertWhere(table, args.where)
   144	        if (whereClause) query = query.where(whereClause) as any
   145	      }
   146	      
   147	      if (args?.orderBy) {
   148	        const orders = convertOrderBy(table, args.orderBy)
   149	        if (orders.length > 0) query = query.orderBy(...orders) as any
   150	      }
   151	      
   152	      return query.limit(1).get()
   153	    },
   154	    
   155	    create: async (args: any) => {
   156	      let data = args.data
   157	      // Handle updatedAt if not provided
   158	      if (!data.updatedAt && table.updatedAt) {
   159	        data.updatedAt = new Date()
   160	      }
   161	      // Sanitize data for SQLite
   162	      data = sanitizeData(data)
   163	      return db.insert(table).values(data).returning().get()
   164	    },
   165	    
   166	    createMany: async (args: any) => {
   167	      const data = args.data
   168	      // Handle updatedAt for each record and sanitize
   169	      const records = data.map((record: any) => {
   170	        if (!record.updatedAt && table.updatedAt) {
   171	          record.updatedAt = new Date()
   172	        }
   173	        return sanitizeData(record)
   174	      })
   175	      return db.insert(table).values(records).returning().all()
   176	    },
   177	    
   178	    update: async (args: any) => {
   179	      const whereClause = convertWhere(table, args.where)
   180	      let data = args.data
   181	      // Handle updatedAt
   182	      if (table.updatedAt) {
   183	        data.updatedAt = new Date()
   184	      }
   185	      // Sanitize data for SQLite
   186	      data = sanitizeData(data)
   187	      return db.update(table).set(data).where(whereClause).returning().get()
   188	    },
   189	    
   190	    updateMany: async (args: any) => {
   191	      const whereClause = convertWhere(table, args.where)
   192	      let data = args.data
   193	      // Handle updatedAt
   194	      if (table.updatedAt) {
   195	        data.updatedAt = new Date()
   196	      }
   197	      // Sanitize data for SQLite
   198	      data = sanitizeData(data)
   199	      return db.update(table).set(data).where(whereClause).returning().all()
   200	    },
   201	    
   202	    delete: async (args: any) => {
   203	      const whereClause = convertWhere(table, args.where)
   204	      return db.delete(table).where(whereClause).returning().get()
   205	    },
   206	    
   207	    deleteMany: async (args: any) => {
   208	      const whereClause = convertWhere(table, args.where)
   209	      return db.delete(table).where(whereClause).returning().all()
   210	    },
   211	    
   212	    count: async (args?: any) => {
   213	      let query = db.select().from(table)
   214	      
   215	      if (args?.where) {
   216	        const whereClause = convertWhere(table, args.where)
   217	        if (whereClause) query = query.where(whereClause) as any
   218	      }
   219	      
   220	      const results = query.all()
   221	      return results.length
   222	    },
   223	    
   224	    aggregate: async (args?: any) => {
   225	      let query = db.select().from(table)
   226	      
   227	      if (args?.where) {
   228	        const whereClause = convertWhere(table, args.where)
   229	        if (whereClause) query = query.where(whereClause) as any
   230	      }
   231	      
   232	      const results = query.all()
   233	      
   234	      // Calculate aggregates
   235	      const aggregates: any = {}
   236	      
   237	      if (args?._count) {
   238	        aggregates._count = {}
   239	        if (args._count === true || args._count._all) {
   240	          aggregates._count._all = results.length
   241	        }
   242	        Object.keys(args._count).forEach(field => {
   243	          if (field !== '_all' && args._count[field]) {
   244	            aggregates._count[field] = results.filter(r => r[field] != null).length
   245	          }
   246	        })
   247	      }
   248	      
   249	      if (args?._sum) {
   250	        aggregates._sum = {}
   251	        Object.keys(args._sum).forEach(field => {
   252	          if (args._sum[field]) {
   253	            aggregates._sum[field] = results.reduce((sum, r) => sum + (Number(r[field]) || 0), 0)
   254	          }
   255	        })
   256	      }
   257	      
   258	      if (args?._avg) {
   259	        aggregates._avg = {}
   260	        Object.keys(args._avg).forEach(field => {
   261	          if (args._avg[field]) {
   262	            const validValues = results.filter(r => r[field] != null).map(r => Number(r[field]))
   263	            aggregates._avg[field] = validValues.length > 0 
   264	              ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length 
   265	              : null
   266	          }
   267	        })
   268	      }
   269	      
   270	      if (args?._min) {
   271	        aggregates._min = {}
   272	        Object.keys(args._min).forEach(field => {
   273	          if (args._min[field]) {
   274	            const validValues = results.filter(r => r[field] != null).map(r => r[field])
   275	            aggregates._min[field] = validValues.length > 0 ? Math.min(...validValues.map(Number)) : null
   276	          }
   277	        })
   278	      }
   279	      
   280	      if (args?._max) {
   281	        aggregates._max = {}
   282	        Object.keys(args._max).forEach(field => {
   283	          if (args._max[field]) {
   284	            const validValues = results.filter(r => r[field] != null).map(r => r[field])
   285	            aggregates._max[field] = validValues.length > 0 ? Math.max(...validValues.map(Number)) : null
   286	          }
   287	        })
   288	      }
   289	      
   290	      return aggregates
   291	    },
   292	    
   293	    groupBy: async (args: any) => {
   294	      let query = db.select().from(table)
   295	      
   296	      if (args?.where) {
   297	        const whereClause = convertWhere(table, args.where)
   298	        if (whereClause) query = query.where(whereClause) as any
   299	      }
   300	      
   301	      const results = query.all()
   302	      
   303	      // Group by specified fields
   304	      const groups = new Map()
   305	      const groupByFields = Array.isArray(args.by) ? args.by : [args.by]
   306	      
   307	      results.forEach(row => {
   308	        const key = groupByFields.map(field => row[field]).join('|')
   309	        if (!groups.has(key)) {
   310	          const groupData: any = {}
   311	          groupByFields.forEach(field => {
   312	            groupData[field] = row[field]
   313	          })
   314	          groups.set(key, { data: groupData, rows: [] })
   315	        }
   316	        groups.get(key).rows.push(row)
   317	      })
   318	      
   319	      // Calculate aggregates for each group
   320	      const groupResults = []
   321	      for (const [key, group] of groups) {
   322	        const result: any = { ...group.data }
   323	        
   324	        if (args._count) {
   325	          result._count = {}
   326	          if (args._count === true || args._count._all) {
   327	            result._count._all = group.rows.length
   328	          }
   329	          Object.keys(args._count).forEach(field => {
   330	            if (field !== '_all' && args._count[field]) {
   331	              result._count[field] = group.rows.filter(r => r[field] != null).length
   332	            }
   333	          })
   334	        }
   335	        
   336	        if (args._sum) {
   337	          result._sum = {}
   338	          Object.keys(args._sum).forEach(field => {
   339	            if (args._sum[field]) {
   340	              result._sum[field] = group.rows.reduce((sum, r) => sum + (Number(r[field]) || 0), 0)
   341	            }
   342	          })
   343	        }
   344	        
   345	        if (args._avg) {
   346	          result._avg = {}
   347	          Object.keys(args._avg).forEach(field => {
   348	            if (args._avg[field]) {
   349	              const validValues = group.rows.filter(r => r[field] != null).map(r => Number(r[field]))
   350	              result._avg[field] = validValues.length > 0 
   351	                ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length 
   352	                : null
   353	            }
   354	          })
   355	        }
   356	        
   357	        groupResults.push(result)
   358	      }
   359	      
   360	      return groupResults
   361	    },
   362	    
   363	    upsert: async (args: any) => {
   364	      const whereClause = convertWhere(table, args.where)
   365	      const existing = await db.select().from(table).where(whereClause).limit(1).get()
   366	      
   367	      if (existing) {
   368	        let updateData = args.update
   369	        if (table.updatedAt) {
   370	          updateData.updatedAt = new Date()
   371	        }
   372	        updateData = sanitizeData(updateData)
   373	        return db.update(table).set(updateData).where(whereClause).returning().get()
   374	      } else {
   375	        let createData = args.create
   376	        if (!createData.updatedAt && table.updatedAt) {
   377	          createData.updatedAt = new Date()
   378	        }
   379	        createData = sanitizeData(createData)
   380	        return db.insert(table).values(createData).returning().get()
   381	      }
   382	    }
   383	  }
   384	}
   385	
   386	// Create the Prisma-like client interface
   387	export const prisma = {
   388	  // Audio models
   389	  audioProcessor: createModelAdapter('audioProcessor', schema.audioProcessors),
   390	  audioZone: createModelAdapter('audioZone', schema.audioZones),
   391	  audioScene: createModelAdapter('audioScene', schema.audioScenes),
   392	  audioMessage: createModelAdapter('audioMessage', schema.audioMessages),
   393	  audioInputMeter: createModelAdapter('audioInputMeter', schema.audioInputMeters),
   394	  
   395	  // FireTV and scheduling models
   396	  fireTVDevice: createModelAdapter('fireTVDevice', schema.fireTVDevices),
   397	  schedule: createModelAdapter('schedule', schema.schedules),
   398	  scheduleLog: createModelAdapter('scheduleLog', schema.scheduleLogs),
   399	  
   400	  // Home team models
   401	  homeTeam: createModelAdapter('homeTeam', schema.homeTeams),
   402	  
   403	  // Matrix models
   404	  tvLayout: createModelAdapter('tvLayout', schema.tvLayouts),
   405	  matrixConfig: createModelAdapter('matrixConfig', schema.matrixConfigs),
   406	  matrixConfiguration: createModelAdapter('matrixConfiguration', schema.matrixConfigurations),
   407	  matrixInput: createModelAdapter('matrixInput', schema.matrixInputs),
   408	  matrixOutput: createModelAdapter('matrixOutput', schema.matrixOutputs),
   409	  
   410	  // Device models
   411	  bartenderRemote: createModelAdapter('bartenderRemote', schema.bartenderRemotes),
   412	  deviceMapping: createModelAdapter('deviceMapping', schema.deviceMappings),
   413	  systemSettings: createModelAdapter('systemSettings', schema.systemSettings),
   414	  
   415	  // Test and wolfpack models
   416	  testLog: createModelAdapter('testLog', schema.testLogs),
   417	  wolfpackMatrixRouting: createModelAdapter('wolfpackMatrixRouting', schema.wolfpackMatrixRoutings),
   418	  wolfpackMatrixState: createModelAdapter('wolfpackMatrixState', schema.wolfpackMatrixStates),
   419	  
   420	  // Sports guide models
   421	  sportsGuideConfiguration: createModelAdapter('sportsGuideConfiguration', schema.sportsGuideConfigurations),
   422	  tvProvider: createModelAdapter('tvProvider', schema.tvProviders),
   423	  providerInput: createModelAdapter('providerInput', schema.providerInputs),
   424	  
   425	  // TODO models
   426	  todo: createModelAdapter('todo', schema.todos),
   427	  todoDocument: createModelAdapter('todoDocument', schema.todoDocuments),
   428	  
   429	  // AI Hub models
   430	  indexedFile: createModelAdapter('indexedFile', schema.indexedFiles),
   431	  qaEntry: createModelAdapter('qaEntry', schema.qaEntries),
   432	  trainingDocument: createModelAdapter('trainingDocument', schema.trainingDocuments),
   433	  apiKey: createModelAdapter('apiKey', schema.apiKeys),
   434	  qaGenerationJob: createModelAdapter('qaGenerationJob', schema.qaGenerationJobs),
   435	  processedFile: createModelAdapter('processedFile', schema.processedFiles),
   436	  
   437	  // CEC models
   438	  cecConfiguration: createModelAdapter('cecConfiguration', schema.cecConfigurations),
   439	  
   440	  // IR models
   441	  globalCacheDevice: createModelAdapter('globalCacheDevice', schema.globalCacheDevices),
   442	  globalCachePort: createModelAdapter('globalCachePort', schema.globalCachePorts),
   443	  iRDevice: createModelAdapter('irDevice', schema.irDevices),
   444	  irDevice: createModelAdapter('irDevice', schema.irDevices), // Alias for compatibility
   445	  iRCommand: createModelAdapter('irCommand', schema.irCommands),
   446	  irCommand: createModelAdapter('irCommand', schema.irCommands), // Alias for compatibility
   447	  iRDatabaseCredentials: createModelAdapter('irDatabaseCredentials', schema.irDatabaseCredentials),
   448	  irDatabaseCredentials: createModelAdapter('irDatabaseCredentials', schema.irDatabaseCredentials), // Alias for compatibility
   449	  
   450	  // Chat and document models
   451	  chatSession: createModelAdapter('chatSession', schema.chatSessions),
   452	  document: createModelAdapter('document', schema.documents),
   453	  
   454	  // Channel preset model
   455	  channelPreset: createModelAdapter('channelPreset', schema.channelPresets),
   456	  
   457	  // Matrix route model
   458	  matrixRoute: createModelAdapter('matrixRoute', schema.matrixRoutes),
   459	  
   460	  // AI Gain models
   461	  aIGainConfiguration: createModelAdapter('aiGainConfiguration', schema.aiGainConfigurations),
   462	  aiGainConfiguration: createModelAdapter('aiGainConfiguration', schema.aiGainConfigurations), // Alias for compatibility
   463	  aIGainAdjustmentLog: createModelAdapter('aiGainAdjustmentLog', schema.aiGainAdjustmentLogs),
   464	  aiGainAdjustmentLog: createModelAdapter('aiGainAdjustmentLog', schema.aiGainAdjustmentLogs), // Alias for compatibility
   465	  
   466	  // Soundtrack models
   467	  soundtrackConfig: createModelAdapter('soundtrackConfig', schema.soundtrackConfigs),
   468	  soundtrackPlayer: createModelAdapter('soundtrackPlayer', schema.soundtrackPlayers),
   469	  
   470	  // Sports guide models
   471	  selectedLeague: createModelAdapter('selectedLeague', schema.selectedLeagues),
   472	  
   473	  // CEC models (alias for compatibility)
   474	  cECConfiguration: createModelAdapter('cecConfiguration', schema.cecConfigurations),
   475	  cecConfiguration: createModelAdapter('cecConfiguration', schema.cecConfigurations), // Alias for compatibility
   476	  
   477	  // Provider models (alias for compatibility)
   478	  tVProvider: createModelAdapter('tvProvider', schema.tvProviders),
   479	  tvProvider: createModelAdapter('tvProvider', schema.tvProviders), // Alias for compatibility
   480	  
   481	  // Q&A models (alias for compatibility)
   482	  qAEntry: createModelAdapter('qaEntry', schema.qaEntries),
   483	  qaEntry: createModelAdapter('qaEntry', schema.qaEntries), // Alias for compatibility
   484	  qAGenerationJob: createModelAdapter('qaGenerationJob', schema.qaGenerationJobs),
   485	  qaGenerationJob: createModelAdapter('qaGenerationJob', schema.qaGenerationJobs), // Alias for compatibility
   486	  
   487	  // Utility methods
   488	  $connect: async () => {
   489	    console.log('[Prisma Adapter] Database connection maintained by Drizzle')
   490	    return Promise.resolve()
   491	  },
   492	  
   493	  $disconnect: async () => {
   494	    console.log('[Prisma Adapter] Database connection will be closed on process exit')
   495	    return Promise.resolve()
   496	  },
   497	  
   498	  $transaction: async (callback: any) => {
   499	    // Drizzle transactions would need to be implemented here
   500	    // For now, we'll execute the callback directly
   501	    return callback(prisma)
   502	  },
   503	  
   504	  $queryRaw: async (query: any, ...values: any[]) => {
   505	    // For simple queries like SELECT 1, just return a mock result
   506	    console.log('[Prisma Adapter] $queryRaw called with query:', query)
   507	    return [{ result: 1 }]
   508	  }
   509	}
   510	
   511	export default prisma
   512	