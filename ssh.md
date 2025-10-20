# SSH Connection & Server Information

This document contains all necessary connection details and credentials for the Sports Bar TV Controller application infrastructure.

## 🔐 Security Notice

**⚠️ WARNING: This file contains sensitive credentials. Do NOT commit to public repositories.**

Consider using environment variables or a secure vault service in production environments.

---

## 🖥️ Server Details

### SSH Connection
- **IP Address**: 24.123.87.42
- **SSH Port**: 224
- **Username**: ubuntu
- **Password**: 6809233DjD$$$

### Connection Command
```bash
ssh -p 224 ubuntu@24.123.87.42
```

### Connection Best Practices
1. **Timeout Settings**: Use `-o ServerAliveInterval=60` to prevent connection timeouts
   ```bash
   ssh -p 224 -o ServerAliveInterval=60 ubuntu@24.123.87.42
   ```

2. **Connection Tips**:
   - If connection is slow, check your local network first
   - The server may take a few seconds to respond on first connection
   - Keep-alive packets help maintain stable connections

3. **SSH Key Authentication** (Recommended):
   - For better security, consider setting up SSH key authentication instead of password
   - Generate a key pair: `ssh-keygen -t ed25519 -C "your_email@example.com"`
   - Copy to server: `ssh-copy-id -p 224 ubuntu@24.123.87.42`

---

## 🌐 Application Access

### Web Interface
- **URL**: http://24.123.87.42:3001
- **Port**: 3001 (Next.js application)

### Application Status Check
```bash
# Check if application is running
ssh -p 224 ubuntu@24.123.87.42 "pm2 status"

# View application logs
ssh -p 224 ubuntu@24.123.87.42 "pm2 logs sports-bar-tv"
```

---

## 📁 Project Structure

### Project Directory
```
/home/ubuntu/Sports-Bar-TV-Controller/
```

### Key Files & Directories
- **Application**: `/home/ubuntu/Sports-Bar-TV-Controller/`
- **Database**: `/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/production.db`
- **Environment**: `/home/ubuntu/Sports-Bar-TV-Controller/.env`
- **Logs**: Check with `pm2 logs`

### Useful Commands
```bash
# Navigate to project directory
cd ~/Sports-Bar-TV-Controller

# Check git status
git status

# Pull latest changes
git pull origin main

# Install dependencies (if needed)
npm install

# Build application
npm run build

# Database operations
npm run db:push          # Push schema changes
npm run db:migrate       # Run migrations
npm run db:studio        # Open database studio
```

---

## 🎛️ AtlasIED Audio Processor

### Processor Details
- **Model**: AZM8 (Atlas Audio Processor)
- **IP Address**: 192.168.5.101
- **TCP Control Port**: 5321 (Used for API commands)
- **HTTP Port**: 80 (Web interface)
- **Username**: admin
- **Password**: 6809233DjD$$$

### Processor Configuration in Application
When adding the processor through the UI:
1. **Processor Name**: Graystone Main (or any descriptive name)
2. **IP Address**: 192.168.5.101
3. **Port**: 5321
4. **Username**: admin
5. **Password**: 6809233DjD$$$

### Web Interface Access
- **URL**: http://192.168.5.101
- **Login**: admin / 6809233DjD$$$

### Testing Connection
```bash
# Test TCP connection
nc -zv 192.168.5.101 5321

# From server (if netcat available)
ssh -p 224 ubuntu@24.123.87.42 "nc -zv 192.168.5.101 5321"
```

### Atlas Protocol Reference
The processor uses Atlas's proprietary TCP protocol. Key points:
- Commands are sent via TCP socket to port 5321
- Requires authentication with username/password
- Configuration stored in database's `atlasParameters` table
- Commands for fetching: inputs, outputs, zones, routing, and audio settings

---

## 📚 GitHub Repository

### Repository Information
- **URL**: https://github.com/dfultonthebar/Sports-Bar-TV-Controller
- **Main Branch**: main
- **Clone Command**: 
  ```bash
  git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
  ```

### Development Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes, then commit
git add .
git commit -m "Description of changes"

# Push to GitHub
git push origin feature/your-feature-name

# Create Pull Request on GitHub
```

---

## 🔄 Application Management

### PM2 Process Manager
The application runs under PM2 process manager.

```bash
# View all processes
pm2 status

# Start application
pm2 start ecosystem.config.js

# Stop application
pm2 stop sports-bar-tv

# Restart application
pm2 restart sports-bar-tv

# View logs
pm2 logs sports-bar-tv

# View error logs only
pm2 logs sports-bar-tv --err

# Clear logs
pm2 flush
```

### Deployment Process
1. SSH into server
2. Navigate to project directory: `cd ~/Sports-Bar-TV-Controller`
3. Pull latest changes: `git pull origin main`
4. Install dependencies (if needed): `npm install`
5. Build application: `npm run build`
6. Restart PM2: `pm2 restart sports-bar-tv`
7. Verify: `pm2 logs sports-bar-tv`

---

## 🗄️ Database Management

### Current Setup
- **ORM**: Drizzle ORM (migrated from Prisma)
- **Database**: SQLite
- **Location**: `~/Sports-Bar-TV-Controller/prisma/data/production.db`

### Database Commands
```bash
# Generate migration
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema changes
npm run db:push

# Open Drizzle Studio
npm run db:studio
```

### Backup Database
```bash
# Create backup
ssh -p 224 ubuntu@24.123.87.42 "cp ~/Sports-Bar-TV-Controller/prisma/data/production.db ~/Sports-Bar-TV-Controller/prisma/data/backup_$(date +%Y%m%d_%H%M%S).db"

# Download backup to local machine
scp -P 224 ubuntu@24.123.87.42:~/Sports-Bar-TV-Controller/prisma/data/production.db ./local_backup.db
```

---

## 🛠️ Troubleshooting

### Application Won't Start
1. Check PM2 status: `pm2 status`
2. View error logs: `pm2 logs sports-bar-tv --err`
3. Check port availability: `netstat -tulpn | grep 3001`
4. Restart PM2: `pm2 restart sports-bar-tv`

### Database Issues
1. Check database file exists: `ls -lh ~/Sports-Bar-TV-Controller/prisma/data/production.db`
2. Verify database permissions: Should be readable/writable by ubuntu user
3. Run migrations: `npm run db:migrate`
4. Check for schema issues in logs

### Atlas Processor Connection Issues
1. Verify processor is powered on
2. Check network connectivity: `ping 192.168.5.101`
3. Test TCP port: `nc -zv 192.168.5.101 5321`
4. Verify credentials in web interface: http://192.168.5.101
5. Check application logs for authentication errors

### Port Already in Use
```bash
# Find process using port 3001
lsof -i :3001

# Kill process if needed
kill -9 <PID>

# Or use PM2
pm2 stop sports-bar-tv
pm2 delete sports-bar-tv
pm2 start ecosystem.config.js
```

---

## 📞 Quick Reference Card

| **Item**               | **Value**                           |
|------------------------|-------------------------------------|
| Server IP              | 24.123.87.42                       |
| SSH Port               | 224                                 |
| SSH User               | ubuntu                              |
| SSH Password           | 6809233DjD$$$                       |
| Web App URL            | http://24.123.87.42:3001           |
| Atlas IP               | 192.168.5.101                       |
| Atlas TCP Port         | 5321                                |
| Atlas HTTP Port        | 80                                  |
| Atlas Username         | admin                               |
| Atlas Password         | 6809233DjD$$$                       |
| Project Dir            | ~/Sports-Bar-TV-Controller          |
| Database File          | ~/Sports-Bar-TV-Controller/prisma/data/production.db |
| GitHub                 | https://github.com/dfultonthebar/Sports-Bar-TV-Controller |

---

## 📝 Notes

### Important Reminders
1. Always backup database before making schema changes
2. Test in development environment when possible
3. Keep this document updated with any infrastructure changes
4. Never commit passwords to version control (use .env files)
5. The AtlasIED processor configuration must be re-added through UI after database resets

### Recent Changes
- **2025-10-20**: Migrated from Prisma to Drizzle ORM
- **2025-10-20**: Database cleanup completed (fresh start with production.db)
- **2025-10-20**: Added comprehensive Atlas configuration and control service

---

**Last Updated**: October 20, 2025  
**Maintained By**: Development Team
