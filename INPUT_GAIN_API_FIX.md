# Input Gain API Fix - Critical Error Resolution

## Issue Summary
The `/api/audio-processor/[id]/input-gain` POST endpoint was experiencing 500 Internal Server Errors with empty JSON responses, causing "Unexpected end of JSON input" errors on the client side.

## Root Causes Identified

### 1. **Variable Scope Issue** (Critical)
- `processorId` variable was declared inside the try block but accessed in the catch block
- This caused a ReferenceError when exceptions occurred
- Result: Empty responses sent to client

### 2. **Insufficient Error Handling**
- Promise rejections from helper functions were not properly caught
- Network errors and timeouts didn't return valid JSON responses
- Parsing errors in request body not handled gracefully

### 3. **Poor Timeout Management**
- Connection timeouts were too short (5 seconds)
- No handling for race conditions between timeout and response
- Multiple resolve/reject calls on same promise

### 4. **Inadequate Validation**
- Missing validation for input number type
- Missing validation for gain value type (could be NaN)
- No detailed error messages for validation failures

### 5. **Limited Logging**
- Insufficient diagnostic information for debugging
- Error context not preserved
- No tracking of promise resolution state

## Changes Implemented

### POST Handler Improvements (`route.ts`)

#### 1. Variable Scope Fix
```typescript
// BEFORE: processorId declared inside try block
try {
  const processorId = params.id
  // ...
} catch (error) {
  logger.api.error('POST', `/api/audio-processor/${processorId}/input-gain`, error) // ❌ ReferenceError
}

// AFTER: processorId declared outside try block
let processorId = 'unknown'
try {
  processorId = params.id
  // ...
} catch (error) {
  logger.api.error('POST', `/api/audio-processor/${processorId}/input-gain`, error) // ✅ Works correctly
}
```

#### 2. Enhanced Request Parsing
```typescript
// Added dedicated try-catch for JSON parsing
try {
  requestBody = await request.json()
} catch (parseError) {
  return NextResponse.json({ 
    error: 'Invalid JSON in request body',
    details: parseError.message 
  }, { status: 400 })
}
```

#### 3. Comprehensive Validation
- **Input number validation**: Check type and range
- **Gain value validation**: Check type, NaN, and range (-80 to 0 dB)
- **Detailed error messages**: Include received values and valid ranges
- **Processor validation**: Enhanced not-found error with processor ID

#### 4. Separated Error Handling
```typescript
// Wrapped Atlas communication in separate try-catch
try {
  result = await setInputGain(processor, inputNumber, gain)
  atlasLogger.info('INPUT_GAIN', 'Successfully set gain on Atlas processor', { ... })
} catch (gainError) {
  // Return specific error for Atlas communication failures
  return NextResponse.json({ 
    error: 'Failed to communicate with Atlas processor',
    details: gainError.message,
    processor: { id, name, ipAddress }
  }, { status: 500 })
}
```

#### 5. Non-blocking AI Config Updates
```typescript
// AI config update wrapped in try-catch to prevent blocking main operation
try {
  // Update AI gain configuration
} catch (dbError) {
  // Log but don't fail the request
  atlasLogger.warn('INPUT_GAIN', 'Failed to update AI gain configuration', dbError)
}
```

#### 6. Guaranteed JSON Responses
```typescript
// Top-level catch ensures we ALWAYS return valid JSON
catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  return NextResponse.json({ 
    error: 'Failed to set input gain',
    details: errorMessage,
    processorId,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  }, { status: 500 })
}
```

### Helper Function Improvements

#### 1. setInputGain() Function
- **Promise State Tracking**: Added `resolved` flag to prevent multiple resolve/reject calls
- **Increased Timeout**: Extended from 5 to 7 seconds for more reliable communication
- **Write Error Handling**: Added callback to client.write() to catch send failures
- **Stringify Error Handling**: Wrapped JSON.stringify in try-catch
- **Enhanced Data Logging**: Added verbose logging for received data
- **Better Error Messages**: Context-aware error messages based on error type
- **Connection Close Handling**: Proper handling of unexpected connection closures
- **Partial Response Logging**: Log partial responses for debugging

#### 2. Error Message Improvements
```typescript
// Provide helpful, actionable error messages
if (error.message.includes('ECONNREFUSED')) {
  errorMsg = `Cannot connect to Atlas processor at ${ipAddress}:5321. Is the processor powered on and connected to the network?`
} else if (error.message.includes('ETIMEDOUT')) {
  errorMsg = `Connection to Atlas processor at ${ipAddress}:5321 timed out. Check network connectivity.`
} else if (error.message.includes('EHOSTUNREACH')) {
  errorMsg = `Atlas processor at ${ipAddress}:5321 is unreachable. Check network configuration.`
}
```

## Testing Recommendations

### 1. Unit Tests
- Test with invalid JSON request bodies
- Test with missing inputNumber or gain
- Test with invalid types (string instead of number)
- Test with out-of-range gain values
- Test with non-existent processor ID

### 2. Integration Tests
- Test with Atlas processor offline
- Test with network connectivity issues
- Test with slow Atlas response times
- Test concurrent requests

### 3. Monitoring
- Check logs for verbose diagnostic information
- Monitor response times
- Track error rates
- Verify all errors return valid JSON

## Deployment Steps

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Test locally** (if possible)
   ```bash
   npm run dev
   # Test the endpoint with various scenarios
   ```

3. **Deploy to production server**
   ```bash
   # Stop the current application
   pm2 stop sports-bar-tv-controller
   
   # Pull the changes
   git pull origin main
   
   # Install dependencies (if needed)
   npm install
   
   # Build the application
   npm run build
   
   # Restart the application
   pm2 restart sports-bar-tv-controller
   ```

4. **Monitor logs**
   ```bash
   pm2 logs sports-bar-tv-controller
   # Watch for any errors or issues
   ```

## Expected Outcomes

### Before Fix
- ❌ 500 errors with empty responses
- ❌ "Unexpected end of JSON input" on client
- ❌ No diagnostic information in logs
- ❌ Variable scope errors in catch blocks

### After Fix
- ✅ All errors return valid JSON responses
- ✅ Detailed error messages with context
- ✅ Verbose logging for debugging
- ✅ Proper error handling throughout the request lifecycle
- ✅ Guaranteed response in all scenarios
- ✅ Better timeout management
- ✅ Enhanced validation with helpful messages

## API Response Examples

### Success Response
```json
{
  "success": true,
  "inputNumber": 1,
  "gain": -20,
  "result": {
    "jsonrpc": "2.0",
    "result": "OK",
    "id": 1
  },
  "processor": {
    "id": "atlas-001",
    "name": "Main Bar",
    "model": "AZMP8"
  },
  "message": "Input 1 gain set to -20dB"
}
```

### Error Response (Validation)
```json
{
  "error": "Gain must be between -80 and 0 dB",
  "received": 10,
  "validRange": {
    "min": -80,
    "max": 0
  }
}
```

### Error Response (Communication Failure)
```json
{
  "error": "Failed to communicate with Atlas processor",
  "details": "Connection to Atlas processor at 192.168.5.101:5321 timed out. Check network connectivity.",
  "processor": {
    "id": "atlas-001",
    "name": "Main Bar",
    "ipAddress": "192.168.5.101"
  }
}
```

### Error Response (Unexpected)
```json
{
  "error": "Failed to set input gain",
  "details": "Unexpected error message here",
  "processorId": "atlas-001"
}
```

## Files Modified
- `src/app/api/audio-processor/[id]/input-gain/route.ts`

## Breaking Changes
None - All changes are backwards compatible with existing API contracts.

## Related Issues
- Fixes empty JSON responses on error
- Resolves "Unexpected end of JSON input" client errors
- Improves Atlas processor communication reliability
- Enhances error diagnosis capabilities

## References
- Atlas Protocol: ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf
- SourceGain parameter range: -80 to 0 dB
- TCP Port: 5321
- Message terminator: \r\n

---

**Date**: October 22, 2025
**Author**: DeepAgent AI
**Status**: Ready for Testing and Deployment
