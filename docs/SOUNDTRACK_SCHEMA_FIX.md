
# Soundtrack API Schema Fix - October 1, 2025

## Problem Identified

The Soundtrack Your Brand integration was showing this error:
```
Field 'soundZones' does not exist on type 'Viewer'
```

This indicates the GraphQL query structure doesn't match your Soundtrack account's API schema.

## Solution Implemented

I've updated the Soundtrack API integration with **intelligent query pattern detection**:

### Changes Made

1. **Multi-Pattern Fallback System**
   - Tries multiple GraphQL query structures automatically
   - Falls back to REST API if GraphQL fails
   - No manual configuration needed

2. **Enhanced Diagnostics**
   - GraphQL introspection to discover available queries
   - Tests multiple query patterns and reports which works
   - Detailed error messages with troubleshooting steps

3. **Improved Error Handling**
   - Better error messages
   - Helpful recommendations
   - Automatic fallback logic

## 🔄 Update Instructions

### To get the fix:

```bash
cd ~/Sports-Bar-TV-Controller
./update_from_github.sh
```

The update script will:
- ✅ Pull latest code from GitHub
- ✅ Install dependencies
- ✅ Rebuild the application
- ✅ Restart the server
- ✅ Preserve all your configuration data

## 🧪 Testing the Fix

After updating:

1. **Open the Soundtrack page:**
   ```
   http://192.168.1.25:3000/soundtrack
   ```

2. **Enter your API token**
   - Get it from: https://business.soundtrackyourbrand.com/
   - Settings → Integrations → API Access
   - Copy the entire token (already base64-encoded)

3. **Click "Test API Connection"**
   
   The test will now:
   - Try different query patterns
   - Show which pattern works
   - Display available API queries
   - Provide specific recommendations

4. **Review the results:**
   - ✅ **Success:** Shows "Successfully connected" + which pattern worked
   - ⚠️ **Warning:** Shows what failed and suggests fixes
   - ❌ **Error:** Detailed message with next steps

## 📋 What The Test Does

### Pattern 1: Direct Query (Try First)
```graphql
{
  soundZones { id name }
}
```

### Pattern 2: Viewer Query (Fallback)
```graphql
{
  viewer { soundZones { id name } }
}
```

### Pattern 3: Me Query (Alternative)
```graphql
{
  me { id }
}
```

### Pattern 4: REST API (Last Resort)
```
GET /v2/accounts
```

The system automatically tries all patterns and uses the one that works.

## 🎯 Expected Results

### If Token is Valid and Has Permissions:

You'll see one of these success messages:

**GraphQL Success:**
```
✅ Successfully connected to Soundtrack Your Brand API
Working query: soundZones direct
Available queries: [list of available API queries]
```

**REST Success:**
```
✅ Successfully connected to Soundtrack Your Brand API (REST)
Note: GraphQL queries failed, but REST API is working
```

### If There's an Issue:

You'll see specific error messages like:

```
❌ Authentication failed
→ Check your API token is correct and not expired
```

```
❌ Field 'X' does not exist on type 'Y'
→ Your account may have limited API access
→ Contact Soundtrack support to verify API permissions
```

```
❌ 404 Not Found
→ Check your account has API access enabled
→ Verify endpoint: https://api.soundtrackyourbrand.com/v2
```

## 📚 Documentation

### Full Troubleshooting Guide

See `SOUNDTRACK_API_TROUBLESHOOTING.md` for:
- Manual API testing with curl
- Token verification steps
- Common issues and solutions
- How to contact Soundtrack support
- Detailed error explanations

### Previous Documentation

- `SOUNDTRACK_INTEGRATION_GUIDE.md` - Feature overview
- `SOUNDTRACK_SETUP.md` - Initial setup guide
- `SOUNDTRACK_BUILD_FIXES.md` - Compilation fixes

## 🔧 Technical Implementation

### New Capabilities

```typescript
// The API client now:
1. Tries introspection first (discovers schema)
2. Tests multiple query patterns
3. Falls back to REST API
4. Returns detailed diagnostic info
5. Uses working pattern automatically
```

### Backwards Compatible

- ✅ Works with existing configurations
- ✅ No database changes required
- ✅ Preserves API token
- ✅ No manual configuration needed

## 🚀 Next Steps After Successful Connection

Once the test shows success:

1. **Refresh Players**
   - Click the "Refresh" button
   - Your sound zones will load

2. **Configure Visibility**
   - Select which players bartenders can see
   - Set display order

3. **Test in Bartender Remote**
   - Go to `/remote`
   - Music controls will appear
   - Test play/pause/volume

## ⚠️ If Still Having Issues

### Check These Common Causes:

1. **Token Issues**
   - Token expired (generate new one)
   - Token copied incorrectly (check for spaces)
   - Token doesn't have required permissions

2. **Account Issues**
   - No sound zones configured in Soundtrack
   - API access not enabled for your account
   - Account subscription level doesn't include API

3. **Network Issues**
   - Firewall blocking Soundtrack API
   - DNS resolution problems
   - Internet connection issues

### Get Help

1. **Check application logs:**
   ```bash
   cd ~/Sports-Bar-TV-Controller
   pm2 logs sports-bar | grep -i soundtrack
   ```

2. **Manual API test:**
   ```bash
   # See SOUNDTRACK_API_TROUBLESHOOTING.md for curl commands
   ```

3. **Contact Soundtrack:**
   - Dashboard: https://business.soundtrackyourbrand.com/
   - Support: help@soundtrackyourbrand.com
   - Mention: "API GraphQL schema access"

## 📊 Files Changed

### Code Files:
- `src/lib/soundtrack-your-brand.ts` - Enhanced with multi-pattern support
- All API routes now use flexible queries

### Documentation:
- `SOUNDTRACK_API_TROUBLESHOOTING.md` - Comprehensive troubleshooting (NEW)
- `SOUNDTRACK_SCHEMA_FIX.md` - This document (NEW)
- `SOUNDTRACK_BUILD_FIXES.md` - Compilation fixes

### Commits:
- `7954a38` - Flexible GraphQL query patterns
- `785560f` - Troubleshooting documentation
- `029a72e` - Build fixes documentation
- `c5fff7d` - Initial GraphQL fixes

## ✅ Verification Checklist

After updating, verify:

- [ ] Update script completed successfully
- [ ] Application is running (check `pm2 status`)
- [ ] Soundtrack page loads without errors
- [ ] API token saved successfully
- [ ] Connection test runs and shows results
- [ ] Test shows which pattern works (if successful)
- [ ] Players load after successful test
- [ ] Bartender remote shows music controls

## 📞 Support

If you need assistance:

1. **Check the logs** (see above)
2. **Review the troubleshooting guide**
3. **Test manually with curl** (commands in troubleshooting guide)
4. **Verify Soundtrack account** has API access
5. **Share test results** if asking for help

---

## Summary

✅ **Fixed:** GraphQL schema compatibility issues  
✅ **Added:** Automatic query pattern detection  
✅ **Added:** Comprehensive diagnostics  
✅ **Added:** REST API fallback support  
✅ **Documented:** Full troubleshooting guide  

**Status:** Ready for testing - please update and run connection test

**Last Updated:** October 1, 2025, 11:45 AM  
**Commits:** 785560f (on GitHub)
