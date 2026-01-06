
# Soundtrack Your Brand API Troubleshooting Guide

## Current Issue: GraphQL Schema Mismatch

You're seeing the error: **"Field 'soundZones' does not exist on type 'Viewer'"**

This indicates that the Soundtrack API's GraphQL schema structure doesn't match the query pattern we're using. This can happen because:

1. The API schema varies by account type or subscription level
2. The API version or endpoint structure has changed
3. The API token has limited permissions

## 🔧 Immediate Fix Steps

### Step 1: Update from GitHub

The latest code includes flexible query patterns that will automatically try multiple approaches:

```bash
cd ~/Sports-Bar-TV-Controller
./update_from_github.sh
```

### Step 2: Test Your API Connection

1. Go to the Soundtrack configuration page: `http://192.168.1.25:3000/soundtrack`
2. Enter your API token
3. Click "Test API Connection"

The test will now try multiple query patterns and show you which one works with your account.

### Step 3: Review Diagnostic Results

The test will show:
- ✅ Which query pattern successfully connected
- 📋 Available queries in your API schema
- ❌ Any errors encountered

## 🔍 Understanding the Issue

### GraphQL Schema Variations

Soundtrack's API may use different structures:

**Pattern 1: Direct Query** (Most common)
```graphql
{
  soundZones {
    id
    name
  }
}
```

**Pattern 2: Through Viewer**
```graphql
{
  viewer {
    soundZones {
      id
      name
    }
  }
}
```

**Pattern 3: Through Me**
```graphql
{
  me {
    soundZones {
      id
      name
    }
  }
}
```

Our updated code now tries all these patterns automatically.

## 🛠️ Manual API Testing

### Test Your Token Directly

You can test your API token using curl to see the raw response:

```bash
# Replace YOUR_TOKEN with your actual base64-encoded token
TOKEN="YOUR_TOKEN"

# Test GraphQL endpoint
curl -X POST https://api.soundtrackyourbrand.com/v2 \
  -H "Authorization: Basic $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { fields { name } } } }"}'
```

This will show you all available queries in your API schema.

### Test Sound Zones Query

```bash
TOKEN="YOUR_TOKEN"

curl -X POST https://api.soundtrackyourbrand.com/v2 \
  -H "Authorization: Basic $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ soundZones { id name } }"}'
```

If this returns an error, try:

```bash
curl -X POST https://api.soundtrackyourbrand.com/v2 \
  -H "Authorization: Basic $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ viewer { soundZones { id name } } }"}'
```

### Try REST API

If GraphQL doesn't work, try the REST endpoint:

```bash
TOKEN="YOUR_TOKEN"

curl https://api.soundtrackyourbrand.com/v2/accounts \
  -H "Authorization: Basic $TOKEN" \
  -H "Accept: application/json"
```

## 🔑 Verify Your API Token

### Getting Your API Token

1. Log in to [Soundtrack Your Brand Business Dashboard](https://business.soundtrackyourbrand.com/)
2. Go to **Settings** → **Integrations** → **API Access**
3. Copy your API token (it should be a long base64-encoded string)

### Token Format

Your token should look like:
```
eG5uVVRH1U2hQQ0hXWk5N
```

**Important:** 
- ✅ The token from Soundtrack is already base64-encoded
- ❌ Do NOT base64-encode it again
- ✅ Just paste it directly into the web interface

### Token Permissions

Ensure your API token has permissions for:
- ✓ Read sound zones
- ✓ Control playback
- ✓ Access stations

## 🐛 Common Issues and Solutions

### Issue 1: "Authentication failed"
**Cause:** Invalid or expired token  
**Solution:** 
1. Generate a new token from Soundtrack dashboard
2. Make sure you're copying the entire token
3. Check for extra spaces before/after the token

### Issue 2: "Field 'X' does not exist"
**Cause:** GraphQL schema mismatch  
**Solution:**
1. Update to latest code (includes flexible queries)
2. Run the API connection test
3. Contact Soundtrack support to verify your account's API access level

### Issue 3: "404 Not Found"
**Cause:** Wrong endpoint or API version  
**Solution:**
1. Verify endpoint is: `https://api.soundtrackyourbrand.com/v2`
2. Check if your account has API access enabled
3. Try REST API endpoints instead of GraphQL

### Issue 4: "No sound zones found"
**Cause:** No devices configured in your Soundtrack account  
**Solution:**
1. Log in to Soundtrack dashboard
2. Set up at least one sound zone (music player)
3. Ensure the device is online

## 📞 Getting Help

### Check Soundtrack Status

1. **Dashboard:** https://business.soundtrackyourbrand.com/
2. **API Docs:** https://api.soundtrackyourbrand.com/v2/docs
3. **Support:** Contact Soundtrack Your Brand support

### Provide This Information

When reporting issues, include:

1. **Error message** from the web interface
2. **Test results** from the connection diagnostic
3. **API token permissions** from your Soundtrack dashboard
4. **Account type** (Business, Enterprise, etc.)
5. **Number of sound zones** configured

### Application Logs

Check the application logs for detailed error messages:

```bash
cd ~/Sports-Bar-TV-Controller
pm2 logs sports-bar
```

Look for lines containing "Soundtrack" or "soundZones".

## 🔄 After Fixing

Once you get a successful connection test:

1. **Refresh Players:** Click the "Refresh" button on the configuration page
2. **Select Visible Players:** Choose which sound zones bartenders can control
3. **Set Display Order:** Arrange the players in your preferred order
4. **Test Controls:** Go to the bartender remote to test music controls

## 📚 Technical Details

### Our Implementation

The system now uses a **multi-pattern fallback approach**:

1. **Try Pattern 1:** Direct `soundZones` query
2. **If fails, Try Pattern 2:** `viewer.soundZones` query
3. **If fails, Try Pattern 3:** `me` query
4. **If all fail:** Attempt REST API
5. **Report:** Detailed error with all attempted patterns

### GraphQL Introspection

We query the API schema to discover available fields:

```graphql
{
  __schema {
    queryType {
      fields {
        name
        description
      }
    }
  }
}
```

This tells us exactly what queries your account supports.

### Code Changes

Recent improvements:
- ✅ Multi-pattern query fallback
- ✅ GraphQL introspection support
- ✅ REST API fallback
- ✅ Detailed diagnostic messages
- ✅ Better error handling

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Test connection shows "Successfully connected"
2. ✅ Players list displays your sound zones
3. ✅ Current playback info appears
4. ✅ Bartender remote shows music controls
5. ✅ Play/pause/volume controls work

## 🚀 Next Steps

Once connected successfully:

1. **Configure Players**
   - Select which zones bartenders can control
   - Set display order
   - Test visibility settings

2. **Use Bartender Remote**
   - Access at `/remote`
   - Control music alongside TVs
   - View now playing info

3. **Monitor Performance**
   - Check logs for any API errors
   - Verify playback state updates
   - Test volume controls

---

## 📝 Version History

- **v2.1** (Oct 2025) - Added multi-pattern fallback and introspection
- **v2.0** (Oct 2025) - Fixed GraphQL schema compatibility
- **v1.0** (Oct 2025) - Initial Soundtrack integration

**Last Updated:** October 1, 2025  
**Status:** ✅ Enhanced with automatic query pattern detection
