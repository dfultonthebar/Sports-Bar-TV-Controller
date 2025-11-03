# MCP Server Setup Guide
## Sports Bar TV Controller

This document describes the Model Context Protocol (MCP) servers installed and configured for the Sports Bar TV Controller project.

## Installed MCP Servers

### 1. SQLite MCP Server ⭐
**Package**: `mcp-server-sqlite` (Python)
**Status**: ✅ Installed and Configured
**Database**: `/home/ubuntu/sports-bar-data/production.db`

**Capabilities**:
- Execute SQL queries directly from Claude
- Inspect database schema
- Analyze device status, routing history
- Generate reports on usage patterns

**Usage Example**:
```sql
-- Query all active devices
SELECT * FROM devices WHERE status = 'ONLINE';

-- Analyze TV routing history
SELECT outputNumber, COUNT(*) as route_count
FROM routing_history
GROUP BY outputNumber
ORDER BY route_count DESC;

-- Check Sports Guide data
SELECT * FROM sports_events WHERE start_time > datetime('now');
```

### 2. Multi-Database MCP Server
**Package**: `mcp-database-server` (npm)
**Status**: ✅ Installed and Configured
**Supported**: SQLite, PostgreSQL, SQL Server, MySQL

**Capabilities**:
- Multi-database support
- Database introspection
- Query execution
- Transaction management

### 3. Filesystem MCP Server
**Package**: `@modelcontextprotocol/server-filesystem`
**Status**: ✅ Available (Auto-installed)
**Paths**:
- `/home/ubuntu/Sports-Bar-TV-Controller` (Project)
- `/home/ubuntu/sports-bar-data` (Data)

**Capabilities**:
- Secure file read/write operations
- Directory listing
- File search
- Path operations

### 4. Puppeteer MCP Server
**Package**: `@modelcontextprotocol/server-puppeteer`
**Status**: ✅ Installed
**Note**: Deprecated but functional

**Capabilities**:
- Browser automation
- Screenshot capture
- Web scraping
- UI testing automation

**Usage Example**:
```javascript
// Capture screenshot of remote control page
await page.goto('http://localhost:3001/remote');
await page.screenshot({ path: 'screenshot.png' });

// Test TV selection
await page.click('[data-tv="1"]');
await page.waitForSelector('.input-selector');
```

## Configuration Files

### Claude Desktop Config
**Location**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "python3",
      "args": ["-m", "mcp_server_sqlite", "/home/ubuntu/sports-bar-data/production.db"]
    },
    "database": {
      "command": "npx",
      "args": ["mcp-database-server"],
      "env": {
        "DB_PATH": "/home/ubuntu/sports-bar-data/production.db",
        "DB_TYPE": "sqlite"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/home/ubuntu/Sports-Bar-TV-Controller",
        "/home/ubuntu/sports-bar-data"
      ]
    },
    "puppeteer": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-puppeteer"]
    }
  }
}
```

### Project MCP Config
**Location**: `.claude/mcp-config.json`

Contains server descriptions, capabilities, and usage examples.

## Testing MCP Servers

### Test SQLite MCP
```bash
# Test SQLite server directly
python3 -m mcp_server_sqlite /home/ubuntu/sports-bar-data/production.db
```

### Test Database MCP
```bash
# Test database server
DB_PATH=/home/ubuntu/sports-bar-data/production.db DB_TYPE=sqlite npx mcp-database-server
```

### Test Filesystem MCP
```bash
# Test filesystem server
npx -y @modelcontextprotocol/server-filesystem /home/ubuntu/Sports-Bar-TV-Controller
```

## Common Use Cases

### 1. Database Analysis
**Query device status**:
```sql
SELECT
  d.id,
  d.name,
  d.status,
  d.last_seen,
  COUNT(r.id) as total_routes
FROM devices d
LEFT JOIN routing_history r ON d.output_number = r.outputNumber
GROUP BY d.id
ORDER BY total_routes DESC;
```

### 2. Sports Guide Analysis
**Find upcoming games**:
```sql
SELECT
  sport,
  home_team,
  away_team,
  start_time,
  channel
FROM sports_events
WHERE start_time BETWEEN datetime('now') AND datetime('now', '+7 days')
ORDER BY start_time;
```

### 3. System Health Check
**Check last 24h activity**:
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as events,
  COUNT(DISTINCT output_number) as unique_tvs
FROM routing_history
WHERE created_at > datetime('now', '-1 day')
GROUP BY DATE(created_at);
```

### 4. File Operations
**Read configuration**:
- Read `/home/ubuntu/Sports-Bar-TV-Controller/data/tv-layout.json`
- Analyze layout zones
- Validate configuration

**Write logs**:
- Create backup files
- Write analysis reports
- Update configuration

### 5. UI Testing with Puppeteer
**Test Remote Control**:
```javascript
// Navigate to remote page
await page.goto('http://localhost:3001/remote');

// Click TV 1
await page.click('[data-output="1"]');

// Verify input selector appears
const selector = await page.waitForSelector('.input-selector');
expect(selector).toBeTruthy();

// Select input
await page.click('[data-input="5"]');

// Verify routing
await page.waitForSelector('.routing-success');
```

## Advanced Features

### Custom MCP Servers (Potential)

#### Hardware Control MCP
Create custom MCP for:
- ADB commands (Fire TV control)
- CEC commands (TV power control)
- Wolf Pack API (Matrix routing)
- Atlas API (Audio control)

**Example structure**:
```bash
/home/ubuntu/Sports-Bar-TV-Controller/mcp-servers/
├── hardware/
│   ├── adb-mcp.ts
│   ├── cec-mcp.ts
│   ├── wolfpack-mcp.ts
│   └── atlas-mcp.ts
├── sports/
│   ├── espn-mcp.ts
│   ├── mlb-mcp.ts
│   └── unified-mcp.ts
└── package.json
```

#### Sports Data MCP
Create custom MCP for:
- ESPN API integration
- MLB API access
- Streaming service APIs
- Channel mapping

### Integration with n8n
MCP servers can be used within n8n workflows:
- Database queries from automation
- File operations in workflows
- Browser automation for testing
- Sports data fetching

## Troubleshooting

### SQLite MCP Not Working
```bash
# Check Python installation
python3 --version

# Reinstall
pip3 install --upgrade mcp-server-sqlite --break-system-packages

# Test manually
python3 -m mcp_server_sqlite /home/ubuntu/sports-bar-data/production.db
```

### Database Connection Errors
```bash
# Check database exists
ls -lh /home/ubuntu/sports-bar-data/production.db

# Check permissions
chmod 644 /home/ubuntu/sports-bar-data/production.db

# Check WAL files
ls -lh /home/ubuntu/sports-bar-data/*.db*
```

### Filesystem Access Denied
```bash
# Check directory permissions
ls -ld /home/ubuntu/Sports-Bar-TV-Controller
ls -ld /home/ubuntu/sports-bar-data

# Fix if needed
chmod 755 /home/ubuntu/Sports-Bar-TV-Controller
chmod 755 /home/ubuntu/sports-bar-data
```

### Puppeteer Errors
```bash
# Install Chromium dependencies
npm install -g @modelcontextprotocol/server-puppeteer

# Or use system Chromium
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## Security Considerations

### Database Access
- SQLite MCP has **full database access**
- Use read-only mode for analysis:
  ```bash
  chmod 444 /home/ubuntu/sports-bar-data/production.db  # Read-only
  ```

### Filesystem Access
- Limited to configured directories only
- Cannot access system files
- Safe for production use

### Network Access
- Puppeteer can access any URL
- Be cautious with external sites
- Prefer localhost testing

## Performance Tips

### Database Queries
- Use EXPLAIN QUERY PLAN for optimization
- Add indexes for frequent queries
- Limit large result sets with LIMIT

### File Operations
- Use batch operations when possible
- Avoid reading large files entirely
- Use streaming for big datasets

### Browser Automation
- Reuse browser instances
- Use headless mode for speed
- Clean up resources after tests

## Next Steps

1. **Test all MCP servers** with sample queries
2. **Create custom Hardware MCP** for device control
3. **Create Sports Data MCP** for API integration
4. **Integrate with n8n workflows**
5. **Add MCP-based monitoring** for system health

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [SQLite MCP](https://pypi.org/project/mcp-server-sqlite/)
- [Database MCP](https://www.npmjs.com/package/mcp-database-server)
- [Puppeteer MCP](https://www.npmjs.com/package/@modelcontextprotocol/server-puppeteer)

---

**Last Updated**: 2025-10-31
**Project**: Sports Bar TV Controller
**Version**: 1.0.0
