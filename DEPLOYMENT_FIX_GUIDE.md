# Sports Bar TV Controller - Deployment Fix Guide

## Error Analysis

Based on the error logs, the following critical issues were identified:

### 1. **Database Type Binding Error** (CRITICAL)
```
TypeError: SQLite3 can only bind numbers, strings, bigints, buffers, and null
```

**Root Cause**: After migrating from Prisma to Drizzle ORM, the database queries are passing incorrect data types (likely objects or undefined values) where SQLite expects primitive types.

**Location**: `/home/ubuntu/Sports-Bar-TV-Controller/.next/server/chunks/4943.js:14:25066`

**Affected Code**: The `test-connection` API route and database update operations.

### 2. **Variable Scoping Error** (CRITICAL)
```
ReferenceError: port is not defined
```

**Root Cause**: A variable `port` is being referenced but not properly defined in the scope, likely in the Atlas connection handling code.

**Location**: `/home/ubuntu/Sports-Bar-TV-Controller/.next/server/chunks/2357.js:1:8819`

### 3. **Atlas Connection Timeouts** (EXPECTED)
Multiple timeout errors connecting to Atlas processor at `192.168.5.101:80`. This is expected if the hardware is not on the same network as the server.

---

## Quick Fix Instructions

### Option 1: Run the Automated Fix Script

1. **SSH into your remote server**:
   ```bash
   ssh -p 224 ubuntu@24.123.187.42
   ```

2. **Download and run the fix script**:
   ```bash
   cd ~
   chmod +x fix_deployment.sh
   ./fix_deployment.sh
   ```

3. **Verify the application is running**:
   ```bash
   curl http://localhost:3000
   pm2 status
   ```

---

### Option 2: Manual Fix Steps

If the automated script doesn't work, follow these manual steps:

#### Step 1: Navigate to Project Directory
```bash
cd ~/Sports-Bar-TV-Controller
# OR
cd /var/www/Sports-Bar-TV-Controller
```

#### Step 2: Stop Running Instances
```bash
pm2 stop all
# OR
pkill -f next
```

#### Step 3: Pull Latest Code
```bash
git fetch origin
git pull origin main
```

#### Step 4: Fix Environment Variables
```bash
# Create or update .env file
cat > .env << 'EOF'
DATABASE_URL=file:./data/sports-bar-tv.db
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://localhost:3000
ATLAS_IP=192.168.5.101
ATLAS_PORT=80
EOF
```

#### Step 5: Create Database Directory
```bash
mkdir -p data
chmod 755 data
```

#### Step 6: Clean Install Dependencies
```bash
rm -rf node_modules .next
npm ci --legacy-peer-deps
```

#### Step 7: Fix the Code Issues

**A. Fix Database Type Binding Issue**

The issue is in how Drizzle is handling the audio processor updates. Edit the file that handles database operations:

```bash
# Find the problematic file
find . -name "*.ts" -o -name "*.tsx" | xargs grep -l "audioProcessor.*update" | grep -v node_modules
```

Look for code that updates the audio processor and ensure all values are properly typed:

```typescript
// WRONG - passing undefined or objects
await db.update(audioProcessors).set({
  lastSeen: new Date(),  // This might be the issue
  status: statusObject   // Objects not allowed
})

// CORRECT - ensure primitive types
await db.update(audioProcessors).set({
  lastSeen: new Date().toISOString(),  // Convert to string
  status: statusObject?.value || 'unknown'  // Extract primitive value
})
```

**B. Fix Port Variable Scoping Issue**

The `port` variable needs to be properly defined. Look for the Atlas connection code:

```bash
# Find files with Atlas connection logic
find ./src -name "*.ts" | xargs grep -l "Atlas.*connect" | grep -v node_modules
```

Ensure the port variable is defined before use:

```typescript
// WRONG
async function connectToAtlas(ip: string) {
  const connection = await connect(ip, port);  // port not defined
}

// CORRECT
async function connectToAtlas(ip: string, port: number = 80) {
  const connection = await connect(ip, port);
}
```

#### Step 8: Run Database Migrations
```bash
npx drizzle-kit push:sqlite --config=drizzle.config.ts
```

#### Step 9: Build the Application
```bash
npm run build
```

#### Step 10: Start the Application
```bash
# With PM2 (recommended)
pm2 start npm --name "sports-bar-tv" -- start
pm2 save

# OR without PM2
nohup npm start > app.log 2>&1 &
```

#### Step 11: Verify
```bash
# Check if app is running
curl http://localhost:3000

# Check PM2 status
pm2 status

# View logs
pm2 logs sports-bar-tv
# OR
tail -f app.log
```

---

## Specific Code Fixes Needed

### Fix 1: Update `src/app/api/audio-processor/test-connection/route.ts`

The test-connection route is failing because it's trying to update the database with incorrect types. Here's the likely fix:

```typescript
// Find this section and update it:
await db.update(audioProcessors)
  .set({
    lastSeen: new Date().toISOString(),  // Convert Date to string
    isOnline: true,
    model: detectedModel || null,  // Ensure null instead of undefined
    firmwareVersion: firmwareVersion || null,
    // Remove any fields that aren't in the schema
  })
  .where(eq(audioProcessors.id, processorId));
```

### Fix 2: Update Atlas Connection Handler

Look for the file handling Atlas connections (likely in `src/lib/atlas/` or similar):

```typescript
// Ensure port is always defined
export async function connectToAtlas(
  ipAddress: string, 
  port: number = 80  // Default value
): Promise<AtlasConnection> {
  // Connection logic here
}

// Or if using from config:
const port = config.port ?? 80;  // Fallback to 80
```

### Fix 3: Update Drizzle Schema

Ensure your Drizzle schema matches the data types being used:

```typescript
// In your schema file (likely src/db/schema.ts)
export const audioProcessors = sqliteTable('audio_processors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ipAddress: text('ip_address').notNull(),
  port: integer('port').notNull().default(80),
  model: text('model'),
  firmwareVersion: text('firmware_version'),
  lastSeen: text('last_seen'),  // Store as ISO string, not Date object
  isOnline: integer('is_online', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

---

## Verification Steps

After deployment, verify everything works:

1. **Check Application Status**:
   ```bash
   pm2 status
   curl http://localhost:3000
   ```

2. **Check Database**:
   ```bash
   sqlite3 data/sports-bar-tv.db ".tables"
   sqlite3 data/sports-bar-tv.db "SELECT * FROM audio_processors;"
   ```

3. **Check Logs for Errors**:
   ```bash
   pm2 logs sports-bar-tv --lines 50
   ```

4. **Test API Endpoints**:
   ```bash
   # Test health check
   curl http://localhost:3000/api/health
   
   # Test audio processor list
   curl http://localhost:3000/api/audio-processor
   ```

---

## Troubleshooting

### If the build fails:
```bash
# Clear all caches
rm -rf .next node_modules package-lock.json
npm install --legacy-peer-deps
npm run build
```

### If database errors persist:
```bash
# Reset database
rm -rf data/sports-bar-tv.db
npx drizzle-kit push:sqlite
```

### If port 3000 is already in use:
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9
# Or change the port in package.json
```

---

## Expected Outcome

After following these steps:

1. ✅ Application builds successfully without errors
2. ✅ Database operations work correctly with proper type binding
3. ✅ Application starts and runs on port 3000
4. ✅ API endpoints respond correctly
5. ⚠️ Atlas connection errors are expected if the hardware isn't on the same network (this is normal and will be configured later via the UI)

---

## Next Steps

Once the application is running:

1. Access the web interface at `http://your-server-ip:3000`
2. Configure the Atlas processor connection through the UI
3. Ensure the server and Atlas processor are on the same network
4. Test the TV controller functionality

---

## Support

If issues persist after following this guide:

1. Check the full error logs: `pm2 logs sports-bar-tv --lines 100`
2. Verify Node.js version: `node -v` (should be 18.x or higher)
3. Check database file permissions: `ls -la data/`
4. Review the GitHub repository for recent changes: https://github.com/dfultonthebar/Sports-Bar-TV-Controller

