# Deployment Instructions for Preset Display Fix

## Server Details
- Host: 135.131.39.26:223
- Username: ubuntu
- Password: 6809233DjD$$$
- Project Path: /home/ubuntu/Sports-Bar-TV-Controller

## Deployment Steps

### 1. SSH into the server
```bash
ssh -p 223 ubuntu@135.131.39.26
```

### 2. Navigate to project directory
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
```

### 3. Fetch and checkout the fix branch
```bash
git fetch origin
git checkout fix/preset-display-on-input-selection
git pull origin fix/preset-display-on-input-selection
```

### 4. Install dependencies (if needed)
```bash
npm install --legacy-peer-deps
```

### 5. Build the application
```bash
npm run build
```

### 6. Restart the application
```bash
pm2 restart sports-bar-controller
# OR if that doesn't work:
pm2 restart all
```

### 7. Verify the application is running
```bash
pm2 status
pm2 logs sports-bar-controller --lines 50
```

## Testing the Fix

1. Open the bartender remote interface in your browser
2. Select a TV from the dropdown (if applicable)
3. **Select an INPUT device** (e.g., "Cable Box 4" or "DirecTV Box")
4. **Verify that channel presets appear** below the input selection
5. Click on a preset button to test channel tuning

## Expected Behavior

- When you select an input with a Cable Box device, you should see cable presets
- When you select an input with a DirecTV device, you should see DirecTV presets
- Clicking a preset should tune to that channel
- Status messages should appear showing the tuning progress

## Rollback (if needed)

If there are any issues, you can rollback to main:
```bash
git checkout main
git pull origin main
npm run build
pm2 restart sports-bar-controller
```

## Pull Request
PR #57: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/57
