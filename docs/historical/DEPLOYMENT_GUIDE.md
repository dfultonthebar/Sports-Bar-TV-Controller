# Drizzle ORM Migration - Deployment Guide

## ✅ GitHub Status: COMPLETE
All Drizzle ORM migration changes have been successfully pushed to GitHub.

**Repository:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller
**Branch:** main
**Latest Commits:**
- e9298d9: feat: Complete Prisma to Drizzle ORM migration
- 1de8c59: docs: Add comprehensive Drizzle ORM migration summary
- c2989c9: feat: Migrate from Prisma ORM to Drizzle ORM

## 🔧 Migration Changes Summary

### Dependencies Updated
**Removed:**
- `prisma`
- `@prisma/client`

**Added:**
- `drizzle-orm` - Core ORM library
- `drizzle-kit` - Migration and schema management tools
- `postgres` or `pg` - PostgreSQL driver (check package.json for exact driver)

### New Scripts in package.json
```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
}
```

### Key Files
- `drizzle.config.ts` - Drizzle configuration
- `src/db/schema.ts` - Database schema definitions
- `src/db/index.ts` - Database connection and exports

## 🚀 Remote Server Deployment Instructions

### Prerequisites
- Remote server IP: 24.123.187.42
- Access credentials provided
- Git installed on remote server
- Node.js and npm installed on remote server

### Deployment Steps

#### Option 1: Manual Deployment (If you have direct access)

1. **Connect to the remote server**
   - Use RDP (port 3389) or SSH (port 22)
   - Credentials: Administrator / 6809233DjD$$$

2. **Navigate to project directory**
   ```bash
   cd C:\path\to\Sports-Bar-TV-Controller
   # or on Linux:
   cd /path/to/Sports-Bar-TV-Controller
   ```

3. **Pull latest changes**
   ```bash
   git pull origin main
   ```

4. **Remove old Prisma dependencies**
   ```bash
   npm uninstall prisma @prisma/client
   ```

5. **Install new dependencies**
   ```bash
   npm install
   ```

6. **Set up database with Drizzle**
   ```bash
   # Push schema to database
   npm run db:push
   
   # Or run migrations if you have migration files
   npm run db:migrate
   ```

7. **Restart the application**
   ```bash
   # If using PM2
   pm2 restart tv-controller
   
   # If using npm
   npm run build
   npm start
   
   # Or if running in development
   npm run dev
   ```

#### Option 2: Automated Deployment Script

Create a file `deploy.sh` on the remote server:

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Navigate to project directory
cd /path/to/Sports-Bar-TV-Controller

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Remove old dependencies
echo "🗑️  Removing Prisma dependencies..."
npm uninstall prisma @prisma/client --save

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run database migrations
echo "🗄️  Setting up database..."
npm run db:push

# Build the application
echo "🔨 Building application..."
npm run build

# Restart the application
echo "♻️  Restarting application..."
pm2 restart tv-controller || npm start

echo "✅ Deployment complete!"
```

Make it executable and run:
```bash
chmod +x deploy.sh
./deploy.sh
```

#### Option 3: Windows PowerShell Script

Create `deploy.ps1` on the remote Windows server:

```powershell
Write-Host "🚀 Starting deployment..." -ForegroundColor Green

# Navigate to project directory
Set-Location "C:\path\to\Sports-Bar-TV-Controller"

# Pull latest changes
Write-Host "📥 Pulling latest changes from GitHub..." -ForegroundColor Cyan
git pull origin main

# Remove old dependencies
Write-Host "🗑️  Removing Prisma dependencies..." -ForegroundColor Yellow
npm uninstall prisma @prisma/client --save

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
npm install

# Run database migrations
Write-Host "🗄️  Setting up database..." -ForegroundColor Cyan
npm run db:push

# Build the application
Write-Host "🔨 Building application..." -ForegroundColor Cyan
npm run build

# Restart the application
Write-Host "♻️  Restarting application..." -ForegroundColor Cyan
# Adjust this command based on how your app is managed
pm2 restart tv-controller
# Or: Stop-Process -Name "node" -Force; Start-Process npm -ArgumentList "start"

Write-Host "✅ Deployment complete!" -ForegroundColor Green
```

Run with:
```powershell
.\deploy.ps1
```

## 🔍 Verification Steps

After deployment, verify the application is working:

1. **Check application is running**
   ```bash
   # Check process
   pm2 list
   # or
   ps aux | grep node
   ```

2. **Check logs for errors**
   ```bash
   pm2 logs tv-controller
   # or check application logs
   tail -f logs/app.log
   ```

3. **Test database connection**
   - Access the application
   - Perform a database operation (read/write)
   - Check for any errors

4. **Verify Atlas processor connection**
   - Test the connection to the Atlas Atmosphere DSP
   - Ensure audio control features work

## ⚠️ Troubleshooting

### Connection Issues
**Problem:** Cannot connect to remote server (SSH/RDP timeout)

**Possible Solutions:**
- Check if server is running
- Verify firewall rules allow connections
- Confirm you're on the correct network (may need VPN)
- Check if ports 22 (SSH) and 3389 (RDP) are open

### Database Issues
**Problem:** Database connection errors after migration

**Solutions:**
1. Verify DATABASE_URL in `.env` file
2. Ensure PostgreSQL is running
3. Check database credentials
4. Run `npm run db:push` to sync schema

### Dependency Issues
**Problem:** Module not found errors

**Solutions:**
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Clear npm cache: `npm cache clean --force`

## 📝 Environment Variables

Ensure these environment variables are set on the remote server:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
NODE_ENV=production
# Add other required environment variables
```

## 🔗 Useful Links

- GitHub Repository: https://github.com/dfultonthebar/Sports-Bar-TV-Controller
- Drizzle ORM Documentation: https://orm.drizzle.team/
- Next.js Documentation: https://nextjs.org/docs

## 📞 Next Steps

1. Access the remote server using RDP or SSH
2. Follow the deployment steps above
3. Verify the application is running correctly
4. Test all features, especially database operations
5. Monitor logs for any issues

---

**Note:** The automated deployment from this system was blocked due to network connectivity issues with the remote server. Please follow the manual deployment steps above or use the provided scripts directly on the remote server.
