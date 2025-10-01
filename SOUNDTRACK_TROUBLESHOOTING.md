# Soundtrack Your Brand API Troubleshooting Guide

## Current Issue

The Soundtrack Your Brand integration is experiencing API connectivity issues. All API endpoints are returning **404 Not Found** errors, which indicates one of the following problems:

## Possible Causes

### 1. **API Endpoint Changes**
Soundtrack Your Brand may have updated their API structure. The current integration uses v2 endpoints:
```
https://api.soundtrackyourbrand.com/v2/account
https://api.soundtrackyourbrand.com/v2/players
https://api.soundtrackyourbrand.com/v2/stations
```

If these endpoints have been deprecated or moved to a newer version (v3), the integration will fail.

### 2. **API Key Issues**
- The API key may have expired
- The API key may have been revoked
- The API key format may have changed
- The authentication method may have changed (Bearer vs Basic)

### 3. **Account Status**
- The Soundtrack Your Brand account may be suspended
- The subscription may have lapsed
- API access may require a different account tier

### 4. **Authentication Method**
The API may have changed from Bearer token to Basic authentication or vice versa. The current implementation tries both methods automatically.

## Diagnostic Tools

### Web Interface Diagnostic Tool

1. Navigate to `/soundtrack` in the application
2. Click the **"Test API Connection"** button
3. Review the diagnostic results and recommendations

## Resolution Steps

### Step 1: Verify Account Status
1. Log in to your Soundtrack Your Brand account at:
   - **Business Dashboard**: https://business.soundtrackyourbrand.com/
   - **Main Website**: https://www.soundtrackyourbrand.com/

2. Check:
   - Is the subscription active?
   - Are there any account notifications?
   - Can you access the API settings page?

### Step 2: Check API Documentation
1. Visit the official Soundtrack Your Brand API documentation:
   - **Current API docs**: https://soundtrack.api-docs.io/
   - **Developer Portal**: Check your business dashboard for API settings

2. Look for:
   - Current API version (v2, v3, or newer)
   - Authentication method changes
   - Base URL changes
   - Deprecation notices

### Step 3: Regenerate API Key
1. Log in to Soundtrack Your Brand dashboard
2. Navigate to API settings (usually under Settings → Integrations → API)
3. Generate a new API key
4. Copy the new API key
5. Update it in the application:
   - Navigate to `/soundtrack`
   - Enter the new API key
   - Click "Save API Key"
   - Click "Test API Connection"

### Step 4: Update API Endpoints (If Needed)
If the API documentation shows different endpoints, you may need to update the code:

1. Edit `src/lib/soundtrack-your-brand.ts`
2. Update the `baseUrl` in the `SoundtrackYourBrandAPI` class
3. Update any endpoint paths that have changed
4. Rebuild and restart the application

### Step 5: Contact Soundtrack Support
If the above steps don't resolve the issue:

**Soundtrack Your Brand Support**:
- Email: support@soundtrackyourbrand.com
- Business Dashboard: Submit a support ticket
- Provide: Error details, API version, account name

## Technical Implementation Details

### Current Integration
- **Library**: `/src/lib/soundtrack-your-brand.ts`
- **API Routes**: `/src/app/api/soundtrack/`
- **Configuration Page**: `/src/app/soundtrack/page.tsx`
- **Bartender Control**: `/src/components/BartenderMusicControl.tsx`

### Features Implemented
- API key management with encryption
- Account verification
- Player (sound zone) management
- Station browsing and selection
- Now playing information
- Playback control (play, pause, station change, volume)
- Bartender visibility settings
- Display order management

## Workarounds

While the API issue is being resolved:

### Option 1: Disable Soundtrack Integration
The application will continue to work without Soundtrack. All other features remain functional.

### Option 2: Use Alternative Control Methods
- Control music directly through Soundtrack Your Brand mobile app
- Use physical remote controls for the sound system
- Access Soundtrack web interface on a dedicated tablet

## Recent Changes Log

### 2025-10-01: Enhanced Error Handling & Diagnostics
- Added automatic retry with Basic authentication
- Implemented connection diagnostic tool
- Enhanced error messages with troubleshooting steps
- Added recommendations display on configuration page
- Improved bartender remote error display

---

**Last Updated**: October 1, 2025  
**Status**: API connectivity issues - troubleshooting in progress
