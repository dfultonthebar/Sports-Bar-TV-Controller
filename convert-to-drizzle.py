#!/usr/bin/env python3
"""
Script to convert Prisma ORM usage to Drizzle ORM with db-helpers
This script automates the conversion of common Prisma patterns to Drizzle
"""

import re
import os
import sys
from pathlib import Path

# Map of Prisma table names to Drizzle schema names
TABLE_MAP = {
    'audioProcessor': 'audioProcessors',
    'audioZone': 'audioZones',
    'audioScene': 'audioScenes',
    'audioMessage': 'audioMessages',
    'audioInputMeter': 'audioInputMeters',
    'fireTVDevice': 'fireTVDevices',
    'schedule': 'schedules',
    'scheduleLog': 'scheduleLogs',
    'homeTeam': 'homeTeams',
    'tvLayout': 'tvLayouts',
    'matrixConfig': 'matrixConfigs',
    'matrixConfiguration': 'matrixConfigurations',
    'matrixInput': 'matrixInputs',
    'matrixOutput': 'matrixOutputs',
    'bartenderRemote': 'bartenderRemotes',
    'deviceMapping': 'deviceMappings',
    'systemSettings': 'systemSettings',
    'testLog': 'testLogs',
    'wolfpackMatrixRouting': 'wolfpackMatrixRoutings',
    'wolfpackMatrixState': 'wolfpackMatrixStates',
    'sportsGuideConfiguration': 'sportsGuideConfigurations',
    'tvProvider': 'tvProviders',
    'providerInput': 'providerInputs',
    'todo': 'todos',
    'todoDocument': 'todoDocuments',
    'indexedFile': 'indexedFiles',
    'qaEntry': 'qaEntries',
    'trainingDocument': 'trainingDocuments',
    'apiKey': 'apiKeys',
    'qaGenerationJob': 'qaGenerationJobs',
    'processedFile': 'processedFiles',
    'cecConfiguration': 'cecConfigurations',
    'globalCacheDevice': 'globalCacheDevices',
    'globalCachePort': 'globalCachePorts',
    'irDevice': 'irDevices',
    'iRDevice': 'irDevices',
    'irCommand': 'irCommands',
    'iRCommand': 'irCommands',
    'irDatabaseCredentials': 'irDatabaseCredentials',
    'iRDatabaseCredentials': 'irDatabaseCredentials',
    'chatSession': 'chatSessions',
    'document': 'documents',
    'channelPreset': 'channelPresets',
    'matrixRoute': 'matrixRoutes',
    'aiGainConfiguration': 'aiGainConfigurations',
    'aIGainConfiguration': 'aiGainConfigurations',
    'aiGainAdjustmentLog': 'aiGainAdjustmentLogs',
    'aIGainAdjustmentLog': 'aiGainAdjustmentLogs',
    'soundtrackConfig': 'soundtrackConfigs',
    'soundtrackPlayer': 'soundtrackPlayers',
    'selectedLeague': 'selectedLeagues',
    'cECConfiguration': 'cecConfigurations',
    'tVProvider': 'tvProviders',
    'qAEntry': 'qaEntries',
    'qAGenerationJob': 'qaGenerationJobs',
}

def convert_file(filepath):
    """Convert a single file from Prisma to Drizzle"""
    print(f"Converting {filepath}...")
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    tables_used = set()
    
    # Find all prisma model usages to determine which schema imports are needed
    for table_name in TABLE_MAP.keys():
        if f'prisma.{table_name}.' in content:
            tables_used.add(TABLE_MAP[table_name])
    
    # Replace imports
    content = re.sub(
        r"import\s+prisma\s+from\s+['\"]@/lib/prisma['\"]",
        "// Converted to Drizzle ORM",
        content
    )
    content = re.sub(
        r"import\s+\{\s*prisma\s*\}\s+from\s+['\"]@/lib/db['\"]",
        "import { db } from '@/db'\nimport { eq, and, or, desc, asc, inArray } from 'drizzle-orm'",
        content
    )
    
    # Add schema imports for tables used
    if tables_used:
        schema_imports = ', '.join(sorted(tables_used))
        # Find where to insert the schema import (after other imports)
        import_pattern = r"(import.*from.*['\"].*['\"])\n"
        last_import_match = None
        for match in re.finditer(import_pattern, content):
            last_import_match = match
        
        if last_import_match:
            insert_pos = last_import_match.end()
            schema_import = f"import {{ {schema_imports} }} from '@/db/schema'\n"
            content = content[:insert_pos] + schema_import + content[insert_pos:]
    
    # Convert Prisma calls to Drizzle
    # Pattern: prisma.model.operation({ args })
    
    # findUnique with where clause
    def convert_find_unique(match):
        table = match.group(1)
        schema_table = TABLE_MAP.get(table, table + 's')
        where_clause = match.group(2)
        
        # Extract the field and value from where clause
        field_match = re.search(r'(\w+):\s*([^,}]+)', where_clause)
        if field_match:
            field = field_match.group(1)
            value = field_match.group(2).strip()
            return f"await db.select().from({schema_table}).where(eq({schema_table}.{field}, {value})).limit(1).get()"
        return match.group(0)  # Return original if we can't parse
    
    content = re.sub(
        r'await\s+prisma\.(\w+)\.findUnique\(\s*\{\s*where:\s*\{([^}]+)\}\s*\}\s*\)',
        convert_find_unique,
        content
    )
    
    # findFirst with where clause
    def convert_find_first(match):
        table = match.group(1)
        schema_table = TABLE_MAP.get(table, table + 's')
        where_clause = match.group(2) if match.lastindex >= 2 else ''
        
        if where_clause:
            # Extract the field and value from where clause
            field_match = re.search(r'(\w+):\s*([^,}]+)', where_clause)
            if field_match:
                field = field_match.group(1)
                value = field_match.group(2).strip()
                return f"await db.select().from({schema_table}).where(eq({schema_table}.{field}, {value})).limit(1).get()"
        return f"await db.select().from({schema_table}).limit(1).get()"
    
    content = re.sub(
        r'await\s+prisma\.(\w+)\.findFirst\(\s*(?:\{\s*where:\s*\{([^}]+)\}\s*\})?\s*\)',
        convert_find_first,
        content
    )
    
    # findMany
    def convert_find_many(match):
        table = match.group(1)
        schema_table = TABLE_MAP.get(table, table + 's')
        args = match.group(2) if match.lastindex >= 2 else ''
        
        if not args or args.strip() == '':
            return f"await db.select().from({schema_table}).all()"
        return f"await db.select().from({schema_table}).all() /* TODO: Convert where/orderBy clauses */"
    
    content = re.sub(
        r'await\s+prisma\.(\w+)\.findMany\(\s*(\{[^}]*\})?\s*\)',
        convert_find_many,
        content
    )
    
    # count
    def convert_count(match):
        table = match.group(1)
        schema_table = TABLE_MAP.get(table, table + 's')
        return f"(await db.select().from({schema_table}).all()).length"
    
    content = re.sub(
        r'await\s+prisma\.(\w+)\.count\(\s*\)',
        convert_count,
        content
    )
    
    # create
    def convert_create(match):
        table = match.group(1)
        schema_table = TABLE_MAP.get(table, table + 's')
        data = match.group(2)
        return f"await db.insert({schema_table}).values({data}).returning().get()"
    
    content = re.sub(
        r'await\s+prisma\.(\w+)\.create\(\s*\{\s*data:\s*(\{[^}]+\})\s*\}\s*\)',
        convert_create,
        content
    )
    
    # update with where clause
    def convert_update(match):
        table = match.group(1)
        schema_table = TABLE_MAP.get(table, table + 's')
        where_clause = match.group(2)
        data_clause = match.group(3)
        
        # Extract field from where
        field_match = re.search(r'(\w+):\s*([^,}]+)', where_clause)
        if field_match:
            field = field_match.group(1)
            value = field_match.group(2).strip()
            return f"await db.update({schema_table}).set({data_clause}).where(eq({schema_table}.{field}, {value})).returning().get()"
        return match.group(0)
    
    content = re.sub(
        r'await\s+prisma\.(\w+)\.update\(\s*\{\s*where:\s*\{([^}]+)\},\s*data:\s*(\{[^}]+\})\s*\}\s*\)',
        convert_update,
        content
    )
    
    # delete with where clause
    def convert_delete(match):
        table = match.group(1)
        schema_table = TABLE_MAP.get(table, table + 's')
        where_clause = match.group(2)
        
        # Extract field from where
        field_match = re.search(r'(\w+):\s*([^,}]+)', where_clause)
        if field_match:
            field = field_match.group(1)
            value = field_match.group(2).strip()
            return f"await db.delete({schema_table}).where(eq({schema_table}.{field}, {value})).returning().get()"
        return match.group(0)
    
    content = re.sub(
        r'await\s+prisma\.(\w+)\.delete\(\s*\{\s*where:\s*\{([^}]+)\}\s*\}\s*\)',
        convert_delete,
        content
    )
    
    # Only write if content changed
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  ✓ Converted {filepath}")
        return True
    else:
        print(f"  - No changes needed for {filepath}")
        return False

def main():
    # Get list of files to convert
    files_to_convert = []
    
    # Find files importing from '@/lib/prisma'
    result = os.popen("grep -r \"from '@/lib/prisma'\" --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=.next src/ 2>/dev/null | cut -d: -f1 | sort -u").read()
    files_to_convert.extend(result.strip().split('\n'))
    
    # Find files importing { prisma } from '@/lib/db'
    result = os.popen("grep -r \"{ prisma }\" --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=.next src/ 2>/dev/null | grep \"from '@/lib/db'\" | cut -d: -f1 | sort -u").read()
    files_to_convert.extend(result.strip().split('\n'))
    
    # Remove duplicates and empty strings
    files_to_convert = list(set(f for f in files_to_convert if f and f.strip()))
    
    # Exclude certain files
    excluded = ['src/lib/prisma.ts', 'src/lib/db.ts', 'src/db/prisma-adapter.ts']
    files_to_convert = [f for f in files_to_convert if f not in excluded]
    
    print(f"Found {len(files_to_convert)} files to convert\n")
    
    converted_count = 0
    for filepath in files_to_convert:
        if os.path.exists(filepath):
            if convert_file(filepath):
                converted_count += 1
    
    print(f"\n✓ Converted {converted_count} files")
    print(f"⚠ Note: Some complex queries may need manual review")

if __name__ == '__main__':
    main()
