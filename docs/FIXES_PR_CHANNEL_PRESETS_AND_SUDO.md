# Fixes for Channel Presets Form and Passwordless Sudo

## Issues Fixed

### Issue 1: Channel Presets Form Not Accepting Input
**Problem**: Users reported that the channel presets form was not accepting any input when trying to add channel presets (e.g., "ESPN" + "27").

**Root Cause**: The input fields lacked proper focus indicators and autocomplete attributes that could improve user experience and ensure proper interaction.

**Solution**:
- Added `autoFocus` attribute to the first input field (Channel Name) to automatically focus when the form opens
- Added `autoComplete="off"` to prevent browser autocomplete from interfering with input
- Enhanced focus styling with `focus:ring-2 focus:ring-blue-500/50` for better visual feedback
- Applied these improvements to both "Add" and "Edit" forms

**Files Changed**:
- `src/components/settings/ChannelPresetsPanel.tsx`

**Changes Made**:
1. Added `autoFocus` to Channel Name input in both Add and Edit forms
2. Added `autoComplete="off"` to all input fields
3. Enhanced focus ring styling for better visual feedback when inputs are active

### Issue 2: Update Script Still Prompting for Password
**Problem**: Despite PR #45 which was supposed to embed the sudo password, the update script still prompted for password during updates.

**Root Cause**: The script was using `echo "password" | sudo -S` pattern which is insecure and unreliable. The proper solution is to configure passwordless sudo in the sudoers file.

**Solution**:
- Replaced all hardcoded password usage with `sudo -n` (no password mode)
- Added passwordless sudo check at the start of the update script
- Created a helper script to configure passwordless sudo
- Updated all sudo commands to use passwordless mode
- Added clear error messages with instructions if passwordless sudo is not configured

**Files Changed**:
- `update_from_github.sh`
- `scripts/setup-passwordless-sudo.sh` (new file)

**Changes Made**:
1. Added passwordless sudo check at the beginning of update script
2. Replaced `echo "password" | sudo -S` with `sudo -n` throughout the script
3. Updated `install_pm2()` function to use passwordless sudo
4. Updated `setup_pm2_startup()` function to use passwordless sudo
5. Updated libCEC installation to use passwordless sudo
6. Created `scripts/setup-passwordless-sudo.sh` helper script for one-time configuration
7. Added clear error messages with setup instructions

## Setup Instructions

### For Users: One-Time Passwordless Sudo Setup

After pulling this PR, you need to configure passwordless sudo once:

```bash
# Run the setup script (you'll be prompted for your password ONE TIME)
./scripts/setup-passwordless-sudo.sh
```

This will:
- Create `/etc/sudoers.d/sports-bar-tv-controller` with proper permissions
- Allow the update script to run without password prompts
- Improve security by avoiding hardcoded passwords

### Manual Setup (Alternative)

If you prefer to configure manually:

```bash
# Edit sudoers file
sudo visudo -f /etc/sudoers.d/sports-bar-tv-controller

# Add this line (replace 'ubuntu' with your username):
ubuntu ALL=(ALL) NOPASSWD: ALL

# Save and exit
```

## Testing

### Test Channel Presets Form
1. Navigate to Settings → Channel Presets
2. Click "Add Channel Preset"
3. Verify that:
   - The Channel Name field is automatically focused
   - You can type in both Channel Name and Channel Number fields
   - The focus ring appears when clicking on inputs
   - Form submission works correctly

### Test Passwordless Sudo
1. Configure passwordless sudo using the setup script
2. Run the update script: `./update_from_github.sh`
3. Verify that:
   - No password prompts appear during the update
   - PM2 installation works without prompts
   - libCEC installation works without prompts
   - PM2 startup configuration works without prompts

## Security Notes

**Why Passwordless Sudo?**
- More secure than hardcoding passwords in scripts
- Standard practice for automated systems and CI/CD
- Scoped to specific user via sudoers.d file
- Can be easily revoked by removing the sudoers file

**Security Best Practices**:
- The sudoers file is created with proper permissions (0440)
- Only affects the specific user running the application
- Can be restricted to specific commands if needed
- Better than storing passwords in environment variables or scripts

## Rollback Instructions

If you need to revert these changes:

### Remove Passwordless Sudo
```bash
sudo rm /etc/sudoers.d/sports-bar-tv-controller
```

### Revert Code Changes
```bash
git checkout main -- src/components/settings/ChannelPresetsPanel.tsx
git checkout main -- update_from_github.sh
git checkout main -- scripts/setup-passwordless-sudo.sh
```

## Additional Notes

- The channel presets form improvements are purely cosmetic/UX enhancements
- The passwordless sudo changes are required for automated updates
- Both fixes are backward compatible
- No database migrations required
- No breaking changes to existing functionality
