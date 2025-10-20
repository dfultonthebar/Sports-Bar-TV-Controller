#!/usr/bin/env python3
"""
Automated Prisma to Drizzle Migration Script
This script automatically migrates Prisma code to Drizzle ORM with logging.
"""

import re
import sys
from pathlib import Path

# Table name mapping from Prisma to Drizzle
TABLE_MAP = {
    'schedule': 'schedules',
    'scheduleLog': 'scheduleLogs',
    'homeTeam': 'homeTeams',
    'fireTVDevice': 'fireTVDevices',
    'matrixConfiguration': 'matrixConfigurations',
    'matrixInput': 'matrixInputs',
    'matrixOutput': 'matrixOutputs',
    'audioProcessor': 'audioProcessors',
    'audioZone': 'audioZones',
    'audioScene': 'audioScenes',
    'audioMessage': 'audioMessages',
    'channelPreset': 'channelPresets',
    'qaEntry': 'qaEntries',
    'chatSession': 'chatSessions',
    'chatMessage': 'chatMessages',
    'document': 'documents',
    'documentChunk': 'documentChunks',
    'todo': 'todos',
    'deviceSubscription': 'deviceSubscriptions',
    'globalCacheDevice': 'globalCacheDevices',
    'irDevice': 'irDevices',
    'irCommand': 'irCommands',
    'selectedLeague': 'selectedLeagues',
    'apiKey': 'apiKeys',
    'performanceLog': 'performanceLogs',
    'errorLog': 'errorLogs',
    'configChangeLog': 'configChangeLogs',
    'userActionLog': 'userActionLogs',
    'channelGuideLog': 'channelGuideLogs',
    'deviceInteractionLog': 'deviceInteractionLogs',
}

def migrate_imports(content):
    """Migrate import statements from Prisma to Drizzle."""
    
    # Remove Prisma import
    content = re.sub(r"import\s+{\s*prisma\s*}\s+from\s+['\"]@/lib/db['\"]", '', content)
    content = re.sub(r"import\s+{\s*prisma\s*}\s+from\s+['\"]@/lib/prisma['\"]", '', content)
    
    # Check if db-helpers imports already exist
    has_db_helpers = 'from @/lib/db-helpers' in content or "from '@/lib/db-helpers'" in content
    has_logger = 'from @/lib/logger' in content or "from '@/lib/logger'" in content
    has_schema = 'from @/db' in content or "from '@/db'" in content
    
    # Add new imports if not present
    new_imports = []
    
    if not has_schema:
        new_imports.append("import { schema } from '@/db'")
    
    if not has_logger:
        new_imports.append("import { logger } from '@/lib/logger'")
    
    if not has_db_helpers:
        new_imports.append("import { findMany, findFirst, findUnique, create, update, deleteRecord, eq, and, or, desc, asc } from '@/lib/db-helpers'")
    
    # Insert new imports after NextRequest import or at the top
    if new_imports:
        import_block = '\n'.join(new_imports)
        
        # Find the last import statement
        last_import = list(re.finditer(r'^import\s+.*?from\s+[\'"].*?[\'"]', content, re.MULTILINE))
        if last_import:
            pos = last_import[-1].end()
            content = content[:pos] + '\n' + import_block + content[pos:]
        else:
            # No imports found, add at the top after any comments
            content = import_block + '\n\n' + content
    
    return content

def migrate_prisma_calls(content, filename):
    """Migrate Prisma method calls to Drizzle."""
    
    # Get the route path from filename for logging
    route_path = filename.replace('src/app/api/', '/api/').replace('/route.ts', '')
    
    # Add API logging at the start of each HTTP method
    for method in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']:
        pattern = rf'export\s+async\s+function\s+{method}\s*\([^)]*\)\s*{{'
        match = re.search(pattern, content)
        if match:
            # Check if logging already exists
            next_lines = content[match.end():match.end()+200]
            if 'logger.api.request' not in next_lines:
                # Add logging
                indent = '  '
                log_line = f"\n{indent}logger.api.request('{method}', '{route_path}')\n"
                content = content[:match.end()] + log_line + content[match.end():]
    
    # Migrate findMany
    pattern = r'await\s+prisma\.(\w+)\.findMany\(([^;]+?)\)'
    def replace_find_many(match):
        table = match.group(1)
        args = match.group(2).strip()
        table_name = TABLE_MAP.get(table, table + 's')
        
        # Parse the arguments to convert to Drizzle syntax
        if not args or args == '{}':
            return f"await findMany('{table_name}')"
        else:
            return f"await findMany('{table_name}', {args})"
    
    content = re.sub(pattern, replace_find_many, content)
    
    # Migrate findFirst
    pattern = r'await\s+prisma\.(\w+)\.findFirst\(([^;]+?)\)'
    def replace_find_first(match):
        table = match.group(1)
        args = match.group(2).strip()
        table_name = TABLE_MAP.get(table, table + 's')
        return f"await findFirst('{table_name}', {args})"
    
    content = re.sub(pattern, replace_find_first, content)
    
    # Migrate findUnique
    pattern = r'await\s+prisma\.(\w+)\.findUnique\(([^;]+?)\)'
    def replace_find_unique(match):
        table = match.group(1)
        args = match.group(2).strip()
        table_name = TABLE_MAP.get(table, table + 's')
        # Extract where clause
        where_match = re.search(r'where:\s*({[^}]+})', args)
        if where_match:
            where_clause = where_match.group(1)
            return f"await findUnique('{table_name}', {where_clause})"
        return f"await findUnique('{table_name}', {args})"
    
    content = re.sub(pattern, replace_find_unique, content)
    
    # Migrate create
    pattern = r'await\s+prisma\.(\w+)\.create\(([^;]+?)\)'
    def replace_create(match):
        table = match.group(1)
        args = match.group(2).strip()
        table_name = TABLE_MAP.get(table, table + 's')
        # Extract data clause
        data_match = re.search(r'data:\s*({[^}]+})', args)
        if data_match:
            data_clause = data_match.group(1)
            return f"await create('{table_name}', {data_clause})"
        return f"await create('{table_name}', {args})"
    
    content = re.sub(pattern, replace_create, content)
    
    # Migrate update
    pattern = r'await\s+prisma\.(\w+)\.update\(([^;]+?)\)'
    def replace_update(match):
        table = match.group(1)
        args = match.group(2).strip()
        table_name = TABLE_MAP.get(table, table + 's')
        # Extract where and data clauses
        where_match = re.search(r'where:\s*({[^}]+})', args)
        data_match = re.search(r'data:\s*({[^}]+})', args)
        if where_match and data_match:
            where_clause = where_match.group(1)
            data_clause = data_match.group(1)
            return f"await update('{table_name}', {where_clause}, {data_clause})"
        return f"await update('{table_name}', {args})"
    
    content = re.sub(pattern, replace_update, content)
    
    # Migrate delete
    pattern = r'await\s+prisma\.(\w+)\.delete\(([^;]+?)\)'
    def replace_delete(match):
        table = match.group(1)
        args = match.group(2).strip()
        table_name = TABLE_MAP.get(table, table + 's')
        # Extract where clause
        where_match = re.search(r'where:\s*({[^}]+})', args)
        if where_match:
            where_clause = where_match.group(1)
            return f"await deleteRecord('{table_name}', {where_clause})"
        return f"await deleteRecord('{table_name}', {args})"
    
    content = re.sub(pattern, replace_delete, content)
    
    return content

def migrate_file(filepath):
    """Migrate a single file from Prisma to Drizzle."""
    
    print(f"Migrating: {filepath}")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Skip if already migrated (has db-helpers import)
        if 'from @/lib/db-helpers' in content or "from '@/lib/db-helpers'" in content:
            if 'import { prisma }' not in content and 'prisma.' not in content:
                print(f"  ✓ Already migrated (skipping)")
                return True
        
        # Backup original
        backup_path = str(filepath) + '.backup'
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Perform migration
        content = migrate_imports(content)
        content = migrate_prisma_calls(content, str(filepath))
        
        # Convert Date objects to ISO strings
        content = re.sub(r'new Date\(\)', "new Date().toISOString()", content)
        content = re.sub(r'(\w+):\s*new Date\(', r'\1: new Date().toISOString() //', content)
        
        # Write migrated content
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"  ✓ Migrated successfully")
        return True
        
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def main():
    """Main migration process."""
    
    if len(sys.argv) > 1:
        # Migrate specific file
        filepath = Path(sys.argv[1])
        if filepath.exists():
            migrate_file(filepath)
        else:
            print(f"File not found: {filepath}")
            sys.exit(1)
    else:
        # Migrate all API route files
        api_dir = Path('src/app/api')
        files = list(api_dir.rglob('route.ts'))
        
        print(f"Found {len(files)} API route files")
        print("=" * 60)
        
        success_count = 0
        for filepath in files:
            if migrate_file(filepath):
                success_count += 1
            print()
        
        print("=" * 60)
        print(f"Migration complete: {success_count}/{len(files)} files migrated")

if __name__ == '__main__':
    main()
