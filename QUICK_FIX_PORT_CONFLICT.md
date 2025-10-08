# Quick Fix: Port Conflict After Reinstall

## Your Situation
You have TWO PM2 processes running:
- **OLD**: `sports-bar-tv-con…` (using port 3000)
- **NEW**: `sportsbar-assistant` (errored, can't use port 3000)

## Fix It Now (Copy-Paste These Commands)

```bash
# Stop and remove the old process
pm2 delete sports-bar-tv-con

# Restart the new process
pm2 restart sportsbar-assistant

# Verify it's running
pm2 status

# Save the configuration
pm2 save
```

## Verify It Worked

After running the commands above, you should see:
```bash
$ pm2 list
┌─────┬─────────────────────┬─────────┬─────────┐
│ id  │ name                │ status  │ restart │
├─────┼─────────────────────┼─────────┼─────────┤
│ 2   │ sportsbar-assistant │ online  │ 0       │  ← Should be "online"
└─────┴─────────────────────┴─────────┴─────────┘
```

## Access Your App

Once it's running, visit:
- **Web Interface**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin

## What Happened?

When you removed the installation directory and reinstalled, the old PM2 process kept running (PM2 processes persist independently of files). The new installer tried to start on port 3000, but the old process was still using it.

## Future Reinstalls

The installer has been updated to automatically handle this! The next time you reinstall, it will:
1. Detect old PM2 processes
2. Clean them up automatically
3. Start fresh without conflicts

## Need More Help?

See the full troubleshooting guide:
- **docs/troubleshooting-port-conflicts.md**

Or check PM2 logs:
```bash
pm2 logs sportsbar-assistant
```
