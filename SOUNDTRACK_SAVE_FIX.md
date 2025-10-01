
# Soundtrack API Token Save Fix - October 1, 2025

## Problem Solved ✅

You were unable to save your Soundtrack API token because the system was trying to fetch sound zones immediately during the save process, and that query was failing with a schema error.

## What Changed

I've updated the token save process to be **much more forgiving**:

### Before (❌ Failed):
1. Enter API token
2. Click "Save"
3. System validates token
4. System tries to fetch zones ← **Failed here with schema error**
5. Token save fails ❌

### Now (✅ Works):
1. Enter API token
2. Click "Save"
3. System validates token with enhanced test ✅
4. Token saves to database ✅
5. System **tries** to fetch zones (but doesn't fail if it can't)
6. Shows warning if zones couldn't be fetched
7. You can click "Refresh" button to try fetching zones again

## 🔄 Try It Now

1. **Update your code:**
   ```bash
   cd ~/Sports-Bar-TV-Controller
   ./update_from_github.sh
   ```

2. **Go to Soundtrack page:**
   ```
   http://192.168.1.25:3000/soundtrack
   ```

3. **Enter your API token**
   - Get it from: https://business.soundtrackyourbrand.com/
   - Settings → Integrations → API Access
   - Copy the entire token

4. **Click "Save API Token"**
   - It should now save successfully ✅
   - You might see a warning about zones if they can't be fetched
   - That's OK - the token is saved!

5. **Click "Refresh" button**
   - This will try to fetch your sound zones
   - Uses the improved fallback logic
   - Will show which players you have

## 🧪 Test API Connection Button

After saving your token, you can click **"Test API Connection"** to:

- ✅ Verify your token works
- 📋 See which GraphQL query pattern works with your account
- 🔍 Discover available API queries
- ⚠️ Get detailed diagnostics if something fails

## What the Enhanced Test Does

The test is now much smarter:

1. **GraphQL Introspection**
   - Discovers what queries your account supports
   - Shows available API endpoints

2. **Multiple Query Patterns**
   - Tries: `{ soundZones { ... } }`
   - Tries: `{ viewer { soundZones { ... } } }`
   - Tries: `{ me { ... } }`

3. **REST API Fallback**
   - If GraphQL fails, tries REST endpoint
   - Still reports success if REST works

4. **Detailed Reporting**
   - Shows exactly which pattern succeeded
   - Lists available queries in your schema
   - Provides specific error messages

## Expected Results

### ✅ Successful Save

You'll see:
```
✓ API token saved successfully
Account: Graystone Ale House
```

If zones couldn't be fetched automatically:
```
⚠ Could not fetch sound zones automatically. 
   Use the "Refresh" button to try again.
```

### ✅ Successful Test

After clicking "Test API Connection":
```
✓ Successfully connected to Soundtrack Your Brand API
Working query: soundZones direct (or viewer.soundZones)
Available queries: [list of queries]
```

### ⚠️ If Token is Invalid

```
✗ Invalid API token or unable to connect to Soundtrack
Please check your token is correct and not expired
```

## 🔧 Troubleshooting

### Token Saves But No Players Show

**Solution:**
1. Click the **"Refresh"** button
2. Check you have sound zones configured in Soundtrack dashboard
3. Click **"Test API Connection"** to see diagnostics

### Test Shows GraphQL Errors

**What it means:**
- Your account might have a different API schema structure
- The fallback patterns will still try multiple approaches

**What to do:**
1. Share screenshot of test results
2. I can analyze which pattern works for your account
3. May need to adjust the query structure

### Token Won't Save At All

**Possible causes:**
1. Token is incorrect (check for extra spaces)
2. Token is expired (generate new one)
3. Network/firewall blocking Soundtrack API

**Solution:**
- Check the token carefully
- Try generating a new token
- Look at browser console for detailed errors

## 📝 Technical Details

### Code Changes

**File: `/api/soundtrack/config/route.ts`**
- Changed POST handler to validate token with `testConnection()`
- Made zone fetching optional (try/catch around it)
- Returns warning message if zones fail
- Token saves regardless of zone fetch success

**File: `/api/soundtrack/test/route.ts`**
- Updated to use enhanced `testConnection()` method
- Uses multi-pattern fallback logic
- Returns detailed diagnostic information

**File: `/lib/soundtrack-your-brand.ts`** (from previous update)
- Enhanced `testConnection()` with introspection
- Multi-pattern query fallback
- REST API fallback
- Detailed error reporting

### Validation Flow

```
1. User enters token
2. Click "Save"
   ↓
3. Validate token with testConnection()
   - Try introspection
   - Try multiple query patterns
   - Try REST API
   ↓
4. If validation succeeds:
   - Save token to database ✅
   - Try to fetch account info (optional)
   - Try to fetch sound zones (optional)
   - Return success with any warnings
   ↓
5. If validation fails:
   - Show detailed error message
   - Don't save token
   - Provide troubleshooting suggestions
```

## 📚 Related Documentation

- `SOUNDTRACK_API_TROUBLESHOOTING.md` - Full troubleshooting guide
- `SOUNDTRACK_SCHEMA_FIX.md` - Schema compatibility improvements
- `SOUNDTRACK_INTEGRATION_GUIDE.md` - Feature overview
- `SOUNDTRACK_SETUP.md` - Initial setup guide

## 🎯 Next Steps After Successful Save

1. **Verify token saved:**
   - Page should show masked token: `***abcd`
   - Account name should display

2. **Fetch players:**
   - Click "Refresh" button
   - Your sound zones should appear

3. **Configure for bartenders:**
   - Toggle visibility for each player
   - Set display order
   - Save changes

4. **Test in bartender remote:**
   - Go to `/remote`
   - Music controls should appear
   - Test play/pause/volume

## 🔄 Update Instructions

To get this fix:

```bash
cd ~/Sports-Bar-TV-Controller
./update_from_github.sh
```

The update will:
- Pull latest code
- Install dependencies
- Rebuild application
- Restart server
- Preserve all your data

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Token saves without errors
2. ✅ Page shows account name
3. ✅ Test connection shows success
4. ✅ Refresh button loads players
5. ✅ Bartender remote shows music controls

## 📸 After Testing

Please share:
1. Screenshot after clicking "Save API Token"
2. Screenshot after clicking "Test API Connection"
3. Screenshot after clicking "Refresh"

This will help me verify everything is working correctly with your specific Soundtrack account!

---

**Status:** Ready to test  
**Committed to GitHub:** Yes (commit f10f3ec)  
**Updated:** October 1, 2025, 12:01 PM
