#!/bin/bash
# =============================================================================
# ensure-schema.sh — Fallback schema sync when drizzle-kit push fails
# =============================================================================
# Reads the Drizzle ORM schema (packages/database/src/schema.ts) and ensures
# every sqliteTable and its columns exist in the production DB. This handles
# the common case where drizzle-kit push aborts with "index already exists"
# before creating newer tables/columns.
#
# Safe to run repeatedly — only adds missing tables and columns, never drops.
#
# Usage:
#   scripts/ensure-schema.sh [DB_PATH]
#   DB_PATH defaults to /home/ubuntu/sports-bar-data/production.db
# =============================================================================

set -uo pipefail

DB_PATH="${1:-/home/ubuntu/sports-bar-data/production.db}"
SCHEMA_FILE="packages/database/src/schema.ts"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_PATH="$REPO_DIR/$SCHEMA_FILE"

if [ ! -f "$SCHEMA_PATH" ]; then
  echo "[ENSURE-SCHEMA] ERROR: Schema file not found: $SCHEMA_PATH"
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "[ENSURE-SCHEMA] ERROR: Database not found: $DB_PATH"
  exit 1
fi

TABLES_CREATED=0
COLUMNS_ADDED=0
ERRORS=0

# Get list of existing tables in DB
EXISTING_TABLES=$(sqlite3 "$DB_PATH" ".tables" | tr -s ' ' '\n' | sort)

# Get list of existing columns per table (cached)
get_existing_columns() {
  local table="$1"
  sqlite3 "$DB_PATH" "PRAGMA table_info('$table');" 2>/dev/null | cut -d'|' -f2
}

# Extract table definitions from schema.ts using node
# This is more reliable than regex parsing for TypeScript
echo "[ENSURE-SCHEMA] Analyzing schema: $SCHEMA_PATH"
echo "[ENSURE-SCHEMA] Target database: $DB_PATH"

# Use node to parse the schema and generate missing DDL
node -e "
const fs = require('fs');
const src = fs.readFileSync('$SCHEMA_PATH', 'utf-8');
const { execSync } = require('child_process');

// Get existing tables from DB
const existingTables = execSync(\"sqlite3 '$DB_PATH' '.tables'\")
  .toString().trim().split(/\s+/).filter(Boolean);

// Parse sqliteTable definitions
// Match: export const X = sqliteTable('TableName', {
const tableRegex = /sqliteTable\(\s*['\"]([^'\"]+)['\"]\s*,\s*\{/g;
let match;
const tables = [];

while ((match = tableRegex.exec(src)) !== null) {
  const tableName = match[1];
  const startIdx = match.index + match[0].length;

  // Find the matching closing brace by counting nested braces
  let depth = 1;
  let i = startIdx;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') depth--;
    i++;
  }
  const body = src.substring(startIdx, i - 1);

  // Parse column definitions
  // Match: columnName: type('dbColumnName')...
  const columns = [];
  const colRegex = /^\s*(\w+)\s*:\s*(text|integer|real|blob)\s*\(\s*['\"]([^'\"]+)['\"]/gm;
  let colMatch;
  while ((colMatch = colRegex.exec(body)) !== null) {
    const [, tsName, colType, dbName] = colMatch;
    // Get the rest of the line to check for defaults, notNull, etc.
    const lineEnd = body.indexOf('\n', colMatch.index);
    const restOfLine = body.substring(colMatch.index, lineEnd > -1 ? lineEnd : undefined);

    const notNull = restOfLine.includes('.notNull()');

    // Extract default value
    let defaultVal = null;
    const defaultMatch = restOfLine.match(/\.default\(\s*([^)]+)\s*\)/);
    if (defaultMatch) {
      let val = defaultMatch[1].trim();
      // Handle common defaults
      if (val === 'false') defaultVal = '0';
      else if (val === 'true') defaultVal = '1';
      else if (val.startsWith(\"'\") || val.startsWith('\"')) defaultVal = val.replace(/[\"']/g, \"'\");
      else if (val === 'timestampNow()') defaultVal = \"CURRENT_TIMESTAMP\";
      else if (!isNaN(val)) defaultVal = val;
    }

    let sqlType = 'TEXT';
    if (colType === 'integer') sqlType = 'INTEGER';
    else if (colType === 'real') sqlType = 'REAL';
    else if (colType === 'blob') sqlType = 'BLOB';

    columns.push({ tsName, dbName, sqlType, notNull, defaultVal });
  }

  tables.push({ tableName, columns });
}

// Generate DDL for missing tables/columns
const ddl = [];

for (const table of tables) {
  if (!existingTables.includes(table.tableName)) {
    // Create entire table
    const colDefs = table.columns.map(c => {
      let def = \"\\\`\${c.dbName}\\\` \${c.sqlType}\";
      if (c.tsName === 'id' && c.sqlType === 'TEXT') def += ' PRIMARY KEY NOT NULL';
      else {
        if (c.notNull) def += ' NOT NULL';
        if (c.defaultVal !== null) def += ' DEFAULT ' + c.defaultVal;
      }
      return def;
    }).join(', ');

    if (colDefs) {
      ddl.push({ type: 'CREATE_TABLE', table: table.tableName, sql: \`CREATE TABLE IF NOT EXISTS \\\`\${table.tableName}\\\` (\${colDefs});\` });
    }
  } else {
    // Table exists — check for missing columns
    const existingCols = execSync(\`sqlite3 '$DB_PATH' \"PRAGMA table_info('\${table.tableName}');\" 2>/dev/null\`)
      .toString().trim().split('\n').filter(Boolean).map(line => line.split('|')[1]);

    for (const col of table.columns) {
      if (!existingCols.includes(col.dbName)) {
        let alterSql = \`ALTER TABLE \\\`\${table.tableName}\\\` ADD COLUMN \\\`\${col.dbName}\\\` \${col.sqlType}\`;
        if (col.notNull && col.defaultVal !== null) {
          alterSql += ' NOT NULL DEFAULT ' + col.defaultVal;
        } else if (col.notNull) {
          // NOT NULL without default — use empty string for TEXT, 0 for INTEGER
          const fallback = col.sqlType === 'TEXT' ? \"''\" : '0';
          alterSql += ' NOT NULL DEFAULT ' + fallback;
        } else if (col.defaultVal !== null) {
          alterSql += ' DEFAULT ' + col.defaultVal;
        }
        alterSql += ';';
        ddl.push({ type: 'ADD_COLUMN', table: table.tableName, column: col.dbName, sql: alterSql });
      }
    }
  }
}

// Output as JSON for the shell to process
console.log(JSON.stringify(ddl));
" 2>/dev/null

# Capture the DDL output
DDL_JSON=$(node -e "
const fs = require('fs');
const src = fs.readFileSync('$SCHEMA_PATH', 'utf-8');
const { execSync } = require('child_process');

const existingTables = execSync(\"sqlite3 '$DB_PATH' '.tables'\")
  .toString().trim().split(/\s+/).filter(Boolean);

const tableRegex = /sqliteTable\(\s*['\"]([^'\"]+)['\"]\s*,\s*\{/g;
let match;
const tables = [];

while ((match = tableRegex.exec(src)) !== null) {
  const tableName = match[1];
  const startIdx = match.index + match[0].length;
  let depth = 1;
  let i = startIdx;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') depth--;
    i++;
  }
  const body = src.substring(startIdx, i - 1);
  const columns = [];
  const colRegex = /^\s*(\w+)\s*:\s*(text|integer|real|blob)\s*\(\s*['\"]([^'\"]+)['\"]/gm;
  let colMatch;
  while ((colMatch = colRegex.exec(body)) !== null) {
    const [, tsName, colType, dbName] = colMatch;
    const lineEnd = body.indexOf('\n', colMatch.index);
    const restOfLine = body.substring(colMatch.index, lineEnd > -1 ? lineEnd : undefined);
    const notNull = restOfLine.includes('.notNull()');
    let defaultVal = null;
    const defaultMatch = restOfLine.match(/\.default\(\s*([^)]+)\s*\)/);
    if (defaultMatch) {
      let val = defaultMatch[1].trim();
      if (val === 'false') defaultVal = '0';
      else if (val === 'true') defaultVal = '1';
      else if (val.startsWith(\"'\") || val.startsWith('\"')) defaultVal = val.replace(/[\"']/g, \"'\");
      else if (val === 'timestampNow()') defaultVal = \"CURRENT_TIMESTAMP\";
      else if (!isNaN(val)) defaultVal = val;
    }
    let sqlType = 'TEXT';
    if (colType === 'integer') sqlType = 'INTEGER';
    else if (colType === 'real') sqlType = 'REAL';
    else if (colType === 'blob') sqlType = 'BLOB';
    columns.push({ tsName, dbName, sqlType, notNull, defaultVal });
  }
  tables.push({ tableName, columns });
}

const ddl = [];
for (const table of tables) {
  if (!existingTables.includes(table.tableName)) {
    const colDefs = table.columns.map(c => {
      let def = \"\\\`\${c.dbName}\\\` \${c.sqlType}\";
      if (c.tsName === 'id' && c.sqlType === 'TEXT') def += ' PRIMARY KEY NOT NULL';
      else {
        if (c.notNull) def += ' NOT NULL';
        if (c.defaultVal !== null) def += ' DEFAULT ' + c.defaultVal;
      }
      return def;
    }).join(', ');
    if (colDefs) {
      ddl.push({ type: 'CREATE_TABLE', table: table.tableName, sql: 'CREATE TABLE IF NOT EXISTS \`' + table.tableName + '\` (' + colDefs + ');' });
    }
  } else {
    const existingCols = execSync('sqlite3 \"$DB_PATH\" \"PRAGMA table_info(\\'' + table.tableName + '\\');\" 2>/dev/null')
      .toString().trim().split('\n').filter(Boolean).map(line => line.split('|')[1]);
    for (const col of table.columns) {
      if (!existingCols.includes(col.dbName)) {
        let alterSql = 'ALTER TABLE \`' + table.tableName + '\` ADD COLUMN \`' + col.dbName + '\` ' + col.sqlType;
        if (col.notNull && col.defaultVal !== null) {
          alterSql += ' NOT NULL DEFAULT ' + col.defaultVal;
        } else if (col.notNull) {
          const fallback = col.sqlType === 'TEXT' ? \"''\" : '0';
          alterSql += ' NOT NULL DEFAULT ' + fallback;
        } else if (col.defaultVal !== null) {
          alterSql += ' DEFAULT ' + col.defaultVal;
        }
        alterSql += ';';
        ddl.push({ type: 'ADD_COLUMN', table: table.tableName, column: col.dbName, sql: alterSql });
      }
    }
  }
}
console.log(JSON.stringify(ddl));
" 2>&1)

if [ $? -ne 0 ]; then
  echo "[ENSURE-SCHEMA] ERROR: Failed to analyze schema"
  echo "$DDL_JSON"
  exit 1
fi

# Parse and execute each DDL statement
CHANGE_COUNT=$(echo "$DDL_JSON" | node -e "
const ddl = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
console.log(ddl.length);
")

if [ "$CHANGE_COUNT" = "0" ]; then
  echo "[ENSURE-SCHEMA] Database schema is up to date (no missing tables or columns)"
  exit 0
fi

echo "[ENSURE-SCHEMA] Found $CHANGE_COUNT schema changes to apply"

# Execute each DDL statement
echo "$DDL_JSON" | node -e "
const { execSync } = require('child_process');
const ddl = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
let created = 0, added = 0, errors = 0;

for (const item of ddl) {
  try {
    execSync('sqlite3 \"$DB_PATH\" \"' + item.sql.replace(/\"/g, '\\\\\"') + '\"', { stdio: 'pipe' });
    if (item.type === 'CREATE_TABLE') {
      console.log('[ENSURE-SCHEMA] Created table: ' + item.table);
      created++;
    } else {
      console.log('[ENSURE-SCHEMA] Added column: ' + item.table + '.' + item.column);
      added++;
    }
  } catch (err) {
    // 'already exists' is fine — another process may have created it
    if (err.stderr && err.stderr.toString().includes('already exists')) {
      console.log('[ENSURE-SCHEMA] Skipped (already exists): ' + (item.column ? item.table + '.' + item.column : item.table));
    } else {
      console.error('[ENSURE-SCHEMA] ERROR: ' + item.sql);
      console.error('  ' + (err.stderr ? err.stderr.toString().trim() : err.message));
      errors++;
    }
  }
}

console.log('[ENSURE-SCHEMA] Summary: ' + created + ' tables created, ' + added + ' columns added, ' + errors + ' errors');
process.exit(errors > 0 ? 1 : 0);
"

exit $?
