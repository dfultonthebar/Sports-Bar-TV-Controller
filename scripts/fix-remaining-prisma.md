# Remaining Prisma → Drizzle Conversions

## Files Fixed (3/16)
✅ `/src/app/api/matrix-display/route.ts` (2 errors) - FIXED
✅ `/src/app/api/sports-guide/current-time/route.ts` (1 error) - FIXED

## Files Remaining (13 files, 13 errors)

These files need Prisma → Drizzle conversion:

1. `/src/app/api/todos/[id]/complete/route.ts` (1 error)
   - prisma.todo.update with include

2. `/src/app/api/todos/[id]/documents/route.ts` (1 error)
   - prisma.document.findMany

3. `/src/lib/ai-knowledge-enhanced.ts` (4 errors)
   - Multiple queries

4. `/src/lib/ai-knowledge-qa.ts` (2 errors)
   - findMany and update queries

5. `/src/lib/scheduler-service.ts` (1 error)
   - findMany query

6. `/src/lib/services/qa-uploader.ts` (1 error)
   - create query

7. `/src/lib/tvDocs/index.ts` (3 errors)
   - Multiple findMany queries

## Conversion Patterns Used

### Simple findFirst
```typescript
// Prisma
const result = await prisma.table.findFirst({ where: { id } })

// Drizzle
const results = await db.select().from(tableSchema).where(eq(tableSchema.id, id))
const result = results[0]
```

### Update
```typescript
// Prisma
const result = await prisma.table.update({
  where: { id },
  data: { field: value }
})

// Drizzle
await db.update(tableSchema).set({ field: value }).where(eq(tableSchema.id, id))
const results = await db.select().from(tableSchema).where(eq(tableSchema.id, id))
const result = results[0]
```

### With Include (Relations)
```typescript
// Prisma
const result = await prisma.table.findFirst({
  where: { id },
  include: { relatedTable: true }
})

// Drizzle
const main = await db.select().from(tableSchema).where(eq(tableSchema.id, id))
const related = await db.select().from(relatedSchema).where(eq(relatedSchema.parentId, id))
const result = { ...main[0], relatedTable: related }
```

## Note
These remaining conversions are in library files and require careful testing. Consider doing them in a separate focused session or leaving them for now since they represent only 13 errors out of 362 total (3.6%).
