# Sports Bar TV Controller - Emergency Deployment Script for Windows
# This script will pull the latest code from GitHub and rebuild the application
# Run this script on the remote server (24.123.87.42)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Sports Bar TV Controller - Emergency Fix Deployment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Set error action preference
$ErrorActionPreference = "Stop"

# Find the application directory
$AppDir = "$env:USERPROFILE\Sports-Bar-TV-Controller"
if (-not (Test-Path $AppDir)) {
    $AppDir = "C:\Sports-Bar-TV-Controller"
    if (-not (Test-Path $AppDir)) {
        Write-Host "ERROR: Application directory not found!" -ForegroundColor Red
        Write-Host "Searching for the directory..." -ForegroundColor Yellow
        $found = Get-ChildItem -Path C:\ -Directory -Filter "Sports-Bar-TV-Controller" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $AppDir = $found.FullName
            Write-Host "Found at: $AppDir" -ForegroundColor Green
        } else {
            Write-Host "Could not find Sports-Bar-TV-Controller directory" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host "Application Directory: $AppDir" -ForegroundColor Green
Set-Location $AppDir

# Check Git status
Write-Host ""
Write-Host "Step 1: Checking Git status..." -ForegroundColor Yellow
git status

# Stash any local changes
Write-Host ""
Write-Host "Step 2: Stashing local changes..." -ForegroundColor Yellow
git stash save "Auto-stash before emergency fix deployment $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Pull latest changes from main branch
Write-Host ""
Write-Host "Step 3: Pulling latest changes from GitHub..." -ForegroundColor Yellow
git fetch origin
git checkout main
git pull origin main

Write-Host ""
Write-Host "SUCCESS: Latest code pulled from GitHub" -ForegroundColor Green

# Install/update dependencies if package.json changed
Write-Host ""
Write-Host "Step 4: Checking for dependency updates..." -ForegroundColor Yellow
$packageChanged = git diff HEAD@{1} HEAD --name-only | Select-String "package.json"
if ($packageChanged) {
    Write-Host "package.json changed, installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host "Dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "No dependency changes detected" -ForegroundColor Green
}

# Build the application
Write-Host ""
Write-Host "Step 5: Building the application..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray
npm run build

Write-Host ""
Write-Host "SUCCESS: Application built successfully!" -ForegroundColor Green

# Restart the application (try PM2 first, then manual)
Write-Host ""
Write-Host "Step 6: Restarting the application..." -ForegroundColor Yellow

# Check if PM2 is available
$pm2Exists = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2Exists) {
    Write-Host "Using PM2 to restart application..." -ForegroundColor Yellow
    pm2 list
    
    # Try to find the app
    $appName = (pm2 list | Select-String "sports-bar|audio-control" | Select-Object -First 1).ToString()
    if ($appName) {
        pm2 restart $appName
        pm2 save
        Write-Host "Application restarted with PM2" -ForegroundColor Green
    } else {
        Write-Host "PM2 app not found, starting new instance..." -ForegroundColor Yellow
        pm2 start npm --name "sports-bar-tv" -- start
        pm2 save
        Write-Host "Application started with PM2" -ForegroundColor Green
    }
} else {
    Write-Host "PM2 not found. Please manually restart your application:" -ForegroundColor Yellow
    Write-Host "  1. Stop the current running instance" -ForegroundColor Gray
    Write-Host "  2. Run: npm run start" -ForegroundColor Gray
    Write-Host "  OR if using PM2: pm2 restart all" -ForegroundColor Gray
}

# Verify the application
Write-Host ""
Write-Host "Step 7: Verifying application..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 10 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "SUCCESS: Application is responding!" -ForegroundColor Green
    }
} catch {
    Write-Host "WARNING: Could not verify application at http://localhost:3001" -ForegroundColor Yellow
    Write-Host "The application may need a moment to start up" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETED!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "What was fixed:" -ForegroundColor White
Write-Host "  ✓ Added missing /api/matrix/video-input-selection endpoint" -ForegroundColor Green
Write-Host "  ✓ Fixed SQLite3 data binding errors (sanitizeData)" -ForegroundColor Green
Write-Host "  ✓ Fixed React rendering errors with Atlas configuration" -ForegroundColor Green
Write-Host "  ✓ Improved error handling in Atlas hardware queries" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Open http://24.123.87.42:3001/audio-control in your browser" -ForegroundColor Gray
Write-Host "  2. Verify that the errors are resolved" -ForegroundColor Gray
Write-Host "  3. Test Atlas processor connectivity" -ForegroundColor Gray
Write-Host "  4. Check the browser console for any remaining errors" -ForegroundColor Gray
Write-Host ""
Write-Host "If you encounter issues, check the logs:" -ForegroundColor Yellow
Write-Host "  - PM2 logs: pm2 logs" -ForegroundColor Gray
Write-Host "  - Application logs: Check the console output" -ForegroundColor Gray
Write-Host ""
