# AI Assistant Log Analysis Feature

## Overview

The AI Assistant has been enhanced with comprehensive system log reading and analysis capabilities. This feature allows the AI to diagnose system issues, analyze error patterns, and provide actionable recommendations based on actual system logs.

## New Features

### 1. System Logs Viewer
- **Access**: Click the "System Logs" button in the AI Assistant page
- **Features**:
  - View recent system logs with filtering options
  - Filter by time range (1 hour to 1 week)
  - Filter by severity level (critical, error, warn, info, debug)
  - Filter by category (user_interaction, system, api, hardware, etc.)
  - "Errors Only" quick filter
  - Adjustable max lines (50-500)

### 2. Log Analytics Dashboard
- **Real-time Metrics**:
  - Total log count
  - Error rate percentage
  - Top errors with occurrence counts
  - System health status (Healthy/Warning/Critical)
  - Automated recommendations

### 3. AI-Powered Log Analysis
- **Quick Action**: "Analyze Recent Errors" button
  - Automatically fetches recent error logs
  - Analyzes patterns and root causes
  - Provides immediate action items
  - Suggests preventive measures
  - Includes system health assessment

### 4. Log Export
- Export logs as JSON files for external analysis
- Includes analytics summary
- Timestamped filenames for easy organization

## API Endpoints

### GET `/api/ai-assistant/logs`
Fetches system logs with filtering options.

**Query Parameters**:
- `hours` (number): Time range in hours (default: 24)
- `maxLines` (number): Maximum number of log entries (default: 100)
- `severity` (string): Filter by log level (critical, error, warn, info, debug)
- `category` (string): Filter by category
- `errorsOnly` (boolean): Show only errors and critical logs

**Response**:
```json
{
  "logs": [...],
  "analytics": {
    "totalLogs": 150,
    "errorRate": 5.2,
    "topErrors": [...],
    "recommendations": [...]
  },
  "filters": {...}
}
```

### POST `/api/ai-assistant/logs`
Performs actions on logs (export, analyze).

**Request Body**:
```json
{
  "action": "export" | "analyze",
  "hours": 24,
  "category": "hardware"
}
```

### POST `/api/ai-assistant/analyze-logs`
AI-powered analysis of system logs.

**Request Body**:
```json
{
  "hours": 24,
  "category": "hardware",
  "includeKnowledge": true,
  "model": "llama3.2:3b",
  "focusArea": "device connectivity issues"
}
```

**Response**:
```json
{
  "analysis": "Detailed AI analysis...",
  "model": "llama3.2:3b",
  "sources": [...],
  "logsSummary": {
    "totalLogs": 150,
    "errorCount": 8,
    "warningCount": 12,
    "errorRate": 5.33,
    "timeRange": "24 hours",
    "systemHealth": "healthy"
  },
  "recommendations": [...]
}
```

## Usage Examples

### Example 1: Quick Error Analysis
1. Open AI Assistant page
2. Click "Analyze Recent Errors" button
3. AI automatically:
   - Fetches recent error logs
   - Analyzes patterns
   - Provides diagnosis and recommendations

### Example 2: Detailed Log Investigation
1. Click "System Logs" button
2. Set filters:
   - Time Range: Last 6 Hours
   - Category: Hardware
   - Errors Only: ✓
3. Click "Refresh" to load logs
4. Review individual log entries with details
5. Click "Analyze with AI" for AI-powered insights

### Example 3: Export for External Analysis
1. Open System Logs viewer
2. Configure desired filters
3. Click "Export" button
4. JSON file downloads with logs and analytics

### Example 4: Chat with Log Context
1. Ask the AI: "What hardware errors occurred today?"
2. AI uses log analysis to provide specific answers
3. Sources include actual log entries
4. Recommendations based on real system data

## Log Entry Structure

Each log entry contains:
- `id`: Unique identifier
- `timestamp`: ISO 8601 timestamp
- `level`: Severity level (debug, info, warn, error, critical)
- `category`: Log category
- `source`: Origin of the log
- `action`: Action being performed
- `message`: Human-readable message
- `details`: Additional structured data
- `success`: Operation success status
- `duration`: Operation duration (ms)
- `deviceType`: Device type (if applicable)
- `deviceId`: Device identifier (if applicable)
- `errorStack`: Stack trace (for errors)

## AI Analysis Capabilities

The AI can:
1. **Identify Root Causes**: Analyze error patterns to find underlying issues
2. **Assess Impact**: Determine how errors affect system operations
3. **Provide Immediate Actions**: Suggest what to do right now
4. **Recommend Prevention**: How to avoid future issues
5. **Evaluate System Health**: Overall system status assessment

## Integration with Knowledge Base

When analyzing logs, the AI can:
- Cross-reference with system documentation
- Find relevant troubleshooting guides
- Provide context-aware solutions
- Link to specific documentation sections

## Best Practices

1. **Regular Monitoring**: Check logs daily for early issue detection
2. **Use Filters**: Focus on specific categories or time ranges
3. **Export Important Logs**: Keep records of critical incidents
4. **Act on Recommendations**: Follow AI suggestions promptly
5. **Enable Knowledge Base**: Get more accurate, documentation-backed analysis

## System Health Indicators

- **Healthy**: Error rate < 5%
- **Warning**: Error rate 5-10%
- **Critical**: Error rate > 10%

## Troubleshooting

### Logs Not Loading
- Check that the application is running
- Verify log files exist in `/logs` directory
- Check browser console for errors

### AI Analysis Fails
- Ensure Ollama is running (`http://localhost:11434`)
- Verify the model is available
- Check network connectivity

### Empty Log Results
- Adjust time range (try longer periods)
- Remove restrictive filters
- Check if system has been active

## Future Enhancements

Potential improvements:
- Real-time log streaming
- Automated alert triggers
- Log pattern learning
- Predictive issue detection
- Integration with external monitoring tools

## Technical Details

### Log Storage
- Logs stored in `/logs` directory
- Separate files per category
- Automatic log rotation at 50MB
- Maintains up to 10 rotated files

### Performance
- Logs cached for 5 minutes
- Efficient filtering at API level
- Pagination support for large datasets
- Optimized JSON parsing

## Security Considerations

- Logs may contain sensitive information
- Export feature requires user action
- No automatic external transmission
- Local storage only

## Support

For issues or questions:
1. Check system logs for errors
2. Review AI Assistant documentation
3. Use the AI Assistant to diagnose issues
4. Contact system administrator if needed
