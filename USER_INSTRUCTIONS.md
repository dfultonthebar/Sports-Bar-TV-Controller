# 🚀 Instructions to Complete Your Update

## Current Situation

✅ **Fix has been implemented and pushed to GitHub**  
✅ **Pull Request #121 created and ready for review**  
✅ **Code is available in the UI for your review**  

**PR Link:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/121

## What Was Fixed

1. **Updated `.gitignore`** to ignore:
   - `data/*.db` and `data/*.db-journal`
   - `benchmark-reports/`
   - `next/`
   - `*.tgz` and `*.tar.gz`

2. **Enhanced `update_from_github.sh`** to:
   - Detect untracked file conflicts before `git pull`
   - Automatically backup conflicting files
   - Complete the update successfully
   - Restore non-conflicting files

## 📋 Step-by-Step Instructions

### Option 1: Merge PR and Update (RECOMMENDED)

This is the cleanest approach:

```bash
# Step 1: Review and merge the PR on GitHub
# Visit: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/121
# Click "Merge pull request" button

# Step 2: Navigate to your project directory
cd ~/Sports-Bar-TV-Controller

# Step 3: Fetch the latest changes
git fetch origin main

# Step 4: Reset to the latest main (gets the fix)
git reset --hard origin/main

# Step 5: Run the update script - it will now handle conflicts automatically!
./update_from_github.sh
```

### Option 2: Quick Fix (If You Want to Update Right Now)

If you can't wait for the PR to be merged:

```bash
# Step 1: Navigate to your project directory
cd ~/Sports-Bar-TV-Controller

# Step 2: Manually remove the conflicting untracked files
# (They'll be recreated by the application if needed)
rm -f data/sports_bar.db
rm -rf benchmark-reports
rm -rf next
rm -f *.tgz

# Step 3: Now you can pull the latest changes
git pull origin main

# Step 4: Run the update script
./update_from_github.sh
```

### Option 3: Cherry-Pick the Fix (Advanced)

If you want to apply the fix to your current branch:

```bash
# Step 1: Navigate to your project directory
cd ~/Sports-Bar-TV-Controller

# Step 2: Fetch the fix branch
git fetch origin fix/update-script-untracked-files

# Step 3: Cherry-pick the fix commit
git cherry-pick 1fb482d

# Step 4: Now run the update script
./update_from_github.sh
```

## 🔍 What to Expect

When you run `./update_from_github.sh` after the fix:

```
🔍 Checking for untracked files that might conflict with update...
⚠️  Found untracked files that conflict with incoming changes:
   - data/sports_bar.db
   
   These files will be backed up and moved to:
   /home/ubuntu/sports-bar-backups/untracked-conflicts-20251007-193000
   
   ✅ Backed up: data/sports_bar.db
✅ Conflicting untracked files backed up successfully

⬇️  Pulling latest changes from GitHub...
✅ Successfully pulled latest changes

📋 Checking if backed up files should be restored...
   ℹ️  data/sports_bar.db - now tracked by git (keeping new version)
   
💡 Backup of conflicting files kept at: /home/ubuntu/sports-bar-backups/untracked-conflicts-20251007-193000
```

## 🎯 Verification Steps

After running the update, verify everything is working:

```bash
# 1. Check git status (should be clean)
git status

# 2. Check that ignored files are properly ignored
git check-ignore data/sports_bar.db benchmark-reports/ next/

# 3. Verify the application starts
pm2 status sports-bar-tv-controller

# 4. Check the application is responding
curl http://localhost:3000
```

## 📁 Where Are My Files?

If the script backed up your files, they're here:

```bash
# List all backups
ls -lh ~/sports-bar-backups/

# View conflict backups specifically
ls -lh ~/sports-bar-backups/untracked-conflicts-*/

# Restore a specific file if needed
cp ~/sports-bar-backups/untracked-conflicts-TIMESTAMP/data/sports_bar.db ./data/
```

## ⚠️ Important Notes

### About `data/sports_bar.db`

The database file location has been a source of confusion. Here's the clarification:

- **Tracked by git:** `prisma/dev.db` or `prisma/data/sports_bar.db`
- **Local only (ignored):** `data/sports_bar.db`

The `.env` file should point to the correct location:
```bash
DATABASE_URL="file:./prisma/dev.db"
# or
DATABASE_URL="file:./prisma/data/sports_bar.db"
```

### About Stashed Changes

If you ran `git stash` earlier, you can restore those changes:

```bash
# List stashed changes
git stash list

# Apply the most recent stash
git stash pop

# Or apply a specific stash
git stash apply stash@{0}
```

## 🆘 Troubleshooting

### If Update Still Fails

```bash
# Check what files are causing issues
git status

# Check what files would be overwritten
git fetch origin main
git diff --name-only HEAD origin/main

# Manually backup and remove problematic files
mkdir -p ~/manual-backup
cp <problematic-file> ~/manual-backup/
rm <problematic-file>

# Try update again
git pull origin main
./update_from_github.sh
```

### If You Need to Restore Everything

```bash
# Find your latest backup
ls -lt ~/sports-bar-backups/config-backup-*.tar.gz | head -1

# Extract it
cd ~/Sports-Bar-TV-Controller
tar -xzf ~/sports-bar-backups/config-backup-TIMESTAMP.tar.gz

# Restart the application
pm2 restart sports-bar-tv-controller
```

## 📞 Need More Help?

1. **Check the detailed analysis:** `FIX_SUMMARY.md` in the project root
2. **Review the PR:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/121
3. **Check update logs:** `cat ~/Sports-Bar-TV-Controller/update.log`
4. **View backups:** `ls -lh ~/sports-bar-backups/`

## ✅ Success Checklist

After completing the update, you should have:

- [ ] PR #121 reviewed and merged (or fix applied)
- [ ] Update script ran successfully
- [ ] No git conflicts or errors
- [ ] Application running (`pm2 status`)
- [ ] Application responding (`curl http://localhost:3000`)
- [ ] All your data preserved
- [ ] Backups available in `~/sports-bar-backups/`

## 🎉 You're All Set!

Once you complete these steps, your system will be updated and the git conflict issue will be permanently resolved. Future updates will automatically handle any untracked file conflicts.

---

**Quick Commands Reference:**

```bash
# Merge PR and update (recommended)
cd ~/Sports-Bar-TV-Controller
git fetch origin main
git reset --hard origin/main
./update_from_github.sh

# Check status
git status
pm2 status

# View backups
ls -lh ~/sports-bar-backups/
```

**Important:** Don't forget to configure GitHub App permissions if needed: [GitHub App](https://github.com/apps/abacusai/installations/select_target)
