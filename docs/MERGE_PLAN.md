# PR Merge Plan - Clean Reinstall Feature

## Current Status

✅ **All PRs Created and Ready**

### Open PRs (in merge order):

1. **PR #126** - Bug fix: Handle unset USER variable in install.sh
   - Status: Open, ready to merge
   - Priority: HIGH (bug fix)
   
2. **PR #125** - Comprehensive One-Line Installer v2.0
   - Status: Open, ready to merge
   - Priority: HIGH (installer update)
   
3. **PR #128** - Clean Reinstall Functionality ⭐ NEW
   - Status: Open, ready to merge
   - Priority: MEDIUM (new feature)
   
4. **PR #127** - Comprehensive deployment documentation
   - Status: Open, needs update with uninstall info
   - Priority: LOW (documentation)

## Merge Order

### Phase 1: Bug Fix
```bash
# Merge PR #126 first (bug fix)
```
**Reason:** Fixes critical USER variable issue

### Phase 2: Installer Update
```bash
# Merge PR #125 (installer update)
```
**Reason:** Updates installer with all recent fixes

### Phase 3: Clean Reinstall Feature
```bash
# Merge PR #128 (this PR - uninstall/reinstall)
```
**Reason:** Adds new uninstall/reinstall functionality

### Phase 4: Documentation
```bash
# Update PR #127 with uninstall documentation
# Then merge PR #127
```
**Reason:** Complete documentation with all features

## What Was Accomplished

### ✅ Phase 1: Script Creation (COMPLETE)

**Created Files:**
- `uninstall.sh` (573 lines, 16KB)
  - Interactive mode with confirmations
  - Non-interactive mode (--yes)
  - Selective removal (--keep-nodejs, --keep-ollama)
  - Backup functionality (--backup)
  - Dry run mode (--dry-run)
  - Comprehensive logging

- `install.sh` (updated, 988 lines, 19KB)
  - Added --reinstall flag
  - Added --force flag
  - Integrated uninstall script download
  - Updated help text

### ✅ Phase 2: Documentation (COMPLETE)

**Created Files:**
- `UNINSTALL_GUIDE.md` (452 lines, 9.8KB)
  - Complete usage guide
  - All options documented
  - Troubleshooting section
  - Multiple examples

- `TEST_RESULTS.md` (391 lines)
  - Comprehensive test report
  - All tests passed
  - Detailed verification

- `TEST_UNINSTALL_REINSTALL.sh` (163 lines)
  - Automated test suite
  - 12 test cases
  - All passed

**Updated Files:**
- `README.md` - Added uninstall section

### ✅ Phase 3: Testing (COMPLETE)

**Test Results:**
- ✅ Script syntax validation
- ✅ Help functions working
- ✅ Dry run mode functional
- ✅ All flags implemented
- ✅ Reinstall integration working
- ✅ Documentation complete
- ✅ Logging functional

### ✅ Phase 4: PR Creation (COMPLETE)

**PR #128 Created:**
- Title: "feat: Add Clean Reinstall Functionality with Comprehensive Uninstall Script"
- Status: Open
- URL: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/128
- Files changed: 6 files, 1,995 insertions, 614 deletions

## Features Implemented

### Uninstall Script Features

1. **Service Management**
   - Stops PM2 processes
   - Stops systemd service
   - Stops Ollama service (optional)

2. **Application Removal**
   - Removes installation directory
   - Removes database files
   - Removes knowledge base
   - Removes logs and temp files

3. **System Cleanup**
   - Removes systemd service files
   - Removes PM2 configuration
   - Reloads systemd daemon

4. **Dependency Management**
   - Optional Node.js removal
   - Optional Ollama removal
   - Preserves other applications

5. **Safety Features**
   - Interactive confirmations
   - Dry run mode
   - Backup functionality
   - Detailed logging
   - Error handling

### Install Script Updates

1. **Reinstall Functionality**
   - Downloads uninstall script
   - Runs uninstall automatically
   - Keeps dependencies by default
   - Proceeds with installation

2. **New Flags**
   - `--reinstall` - Clean reinstall
   - `--force` - Non-interactive mode

## Usage Examples

### Quick Uninstall
```bash
./uninstall.sh --yes --keep-nodejs --keep-ollama
```

### Backup and Uninstall
```bash
./uninstall.sh --backup --yes
```

### Quick Reinstall
```bash
./install.sh --reinstall --force
```

### One-Line Reinstall
```bash
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash -s -- --reinstall --force
```

## Next Steps

### For User (Manual Steps Required):

1. **Review PR #128**
   - Check the code changes
   - Review documentation
   - Test if desired

2. **Merge PRs in Order**
   - ⚠️ **IMPORTANT:** Do NOT merge PRs automatically
   - Review each PR before merging
   - Merge in this order:
     1. PR #126 (bug fix)
     2. PR #125 (installer)
     3. PR #128 (uninstall/reinstall)
     4. PR #127 (documentation - after updating)

3. **Update PR #127**
   - Add uninstall documentation
   - Update with new features
   - Then merge

### Verification Steps:

After merging, verify:
1. Scripts are executable
2. Help functions work
3. Dry run mode works
4. Documentation is complete

## Important Notes

### ⚠️ Do Not Merge Automatically
- PRs should be reviewed by the user
- User should verify changes
- User should test if needed
- User controls merge timing

### 🔒 GitHub App Permissions
As always, remind the user that for full GitHub functionality, they may need to grant permissions to the Abacus.AI GitHub App at:
https://github.com/apps/abacusai/installations/select_target

### 📝 Documentation
All documentation is complete and ready:
- UNINSTALL_GUIDE.md - Comprehensive guide
- TEST_RESULTS.md - Test verification
- README.md - Quick reference

## Summary

✅ **All deliverables completed:**
- ✅ uninstall.sh script with all features
- ✅ Updated install.sh with --reinstall option
- ✅ Comprehensive documentation
- ✅ Test suite and results
- ✅ PR #128 created and ready

**Status:** Ready for user review and merge

**PR Links:**
- PR #126: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/126
- PR #125: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/125
- PR #128: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/128
- PR #127: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/127

---

**Created:** October 7, 2025
**Feature:** Clean Reinstall with Uninstall Script
**Status:** ✅ COMPLETE - Ready for Review and Merge
