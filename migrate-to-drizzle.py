#!/usr/bin/env python3
"""
Automated Prisma to Drizzle ORM Migration Script
Converts Prisma adapter usage to direct Drizzle with db-helpers
"""

import os
import re
import sys
from pathlib import Path

# Map Prisma model names to Drizzle table names (camelCase to schema keys)
PRISMA_TO_DRIZZLE_MAP = {
    'audioProcessor': 'audioProcessors',
    'audioZone': 'audioZones',
    'audioScene': 'audioScenes',
    'audioMessage': 'audioMessages',
    'audioInputMeter': 'audioInputMeters',
    'fireTVDevice': 'fireTVDevices',
    'schedule': 'schedules',
    'scheduleLog': 'scheduleLogs',
    'fireCubeDevice': 'fireCubeDevices',
    'fireCubeApp': 'fireCubeApps',
    'fireCubeSportsContent': 'fireCubeSportsContents',
    'fireCubeSideloadOperation': 'fireCubeSideloadOperations',
    'fireCubeKeepAwakeLog': 'fireCubeKeepAwakeLogs',
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
    'tVProvider': 'tvProviders',
    'providerInput': 'providerInputs',
    'todo': 'todos',
    'todoDocument': 'todoDocuments',
    'indexedFile': 'indexedFiles',
    'qaEntry': 'qaEntries',
    'qAEntry': 'qaEntries',
    'trainingDocument': 'trainingDocuments',
    'apiKey': 'apiKeys',
    'qaGenerationJob': 'qaGenerationJobs',
    'qAGenerationJob': 'qaGenerationJobs',
    'processedFile': 'processedFiles',
    'cecConfiguration': 'cecConfigurations',
    'cECConfiguration': 'cecConfigurations',
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
}


def migrate_file(file_path: str):
    """Migrate a single file from Prisma to Drizzle"""
    print(f"\n{'='*80}")
    print(f"Migrating: {file_path}")
    print(f"{'='*80}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Skip if already migrated (check for db-helpers import)
    if '@/lib/db-helpers' in content or 'from \'@/lib/db-helpers\'' in content:
        print("✅ Already migrated (has db-helpers import)")
        return False
    
    # Check if file uses prisma
    if 'from "@/lib/prisma"' not in content and "from '@/lib/prisma'" not in content:
        print("⏭️  Skipping (no prisma import found)")
        return False
    
    print("📝 Converting imports...")
    
    # Detect which db-helpers functions are needed
    needed_functions = set()
    if re.search(r'prisma\.\w+\.findMany', content):
        needed_functions.add('findMany')
    if re.search(r'prisma\.\w+\.findFirst', content):
        needed_functions.add('findFirst')
    if re.search(r'prisma\.\w+\.findUnique', content):
        needed_functions.add('findUnique')
    if re.search(r'prisma\.\w+\.create\(', content):
        needed_functions.add('create')
    if re.search(r'prisma\.\w+\.update\(', content):
        needed_functions.add('update')
    if re.search(r'prisma\.\w+\.updateMany', content):
        needed_functions.add('updateMany')
    if re.search(r'prisma\.\w+\.delete\(', content):
        needed_functions.add('deleteRecord')
    if re.search(r'prisma\.\w+\.deleteMany', content):
        needed_functions.add('deleteMany')
    if re.search(r'prisma\.\w+\.count', content):
        needed_functions.add('count')
    if re.search(r'prisma\.\w+\.upsert', content):
        needed_functions.add('upsert')
    
    # Add drizzle operators
    needed_functions.update(['eq', 'and', 'or', 'asc', 'desc'])
    
    # Replace the prisma import
    new_imports = f"import {{ {', '.join(sorted(needed_functions))} }} from '@/lib/db-helpers'\n"
    new_imports += "import { schema } from '@/db'\n"
    new_imports += "import { logger } from '@/lib/logger'"
    
    content = re.sub(
        r'import\s+prisma\s+from\s+["\']@/lib/prisma["\']',
        new_imports,
        content
    )
    
    # Replace console.error with logger.api.error or logger.error
    content = re.sub(
        r'console\.error\((.*?)\)',
        r'logger.error(\1)',
        content
    )
    
    # Replace console.log with logger.debug
    content = re.sub(
        r'console\.log\((.*?)\)',
        r'logger.debug(\1)',
        content
    )
    
    print("📝 Converting Prisma calls to Drizzle...")
    
    # Track all prisma model patterns in the file
    prisma_models_found = set()
    for model in PRISMA_TO_DRIZZLE_MAP.keys():
        if f'prisma.{model}.' in content:
            prisma_models_found.add(model)
    
    print(f"Found Prisma models: {prisma_models_found}")
    
    # Convert each Prisma model usage
    for prisma_model, drizzle_table in PRISMA_TO_DRIZZLE_MAP.items():
        if prisma_model not in prisma_models_found:
            continue
        
        print(f"  Converting {prisma_model} → {drizzle_table}")
        
        # Pattern: prisma.model.findMany({ ... })
        content = convert_find_many(content, prisma_model, drizzle_table)
        
        # Pattern: prisma.model.findFirst({ ... })
        content = convert_find_first(content, prisma_model, drizzle_table)
        
        # Pattern: prisma.model.findUnique({ ... })
        content = convert_find_unique(content, prisma_model, drizzle_table)
        
        # Pattern: prisma.model.create({ ... })
        content = convert_create(content, prisma_model, drizzle_table)
        
        # Pattern: prisma.model.update({ ... })
        content = convert_update(content, prisma_model, drizzle_table)
        
        # Pattern: prisma.model.updateMany({ ... })
        content = convert_update_many(content, prisma_model, drizzle_table)
        
        # Pattern: prisma.model.delete({ ... })
        content = convert_delete(content, prisma_model, drizzle_table)
        
        # Pattern: prisma.model.deleteMany({ ... })
        content = convert_delete_many(content, prisma_model, drizzle_table)
        
        # Pattern: prisma.model.count({ ... })
        content = convert_count(content, prisma_model, drizzle_table)
        
        # Pattern: prisma.model.upsert({ ... })
        content = convert_upsert(content, prisma_model, drizzle_table)
    
    # Check if content changed
    if content == original_content:
        print("⚠️  No changes made")
        return False
    
    # Write back to file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ Migration complete")
    return True


def convert_find_many(content: str, prisma_model: str, drizzle_table: str) -> str:
    """Convert prisma.model.findMany to findMany with Drizzle syntax"""
    # Simple pattern without where clause
    pattern = rf'await prisma\.{prisma_model}\.findMany\(\)'
    replacement = f"await findMany('{drizzle_table}')"
    content = re.sub(pattern, replacement, content)
    
    # Pattern with options object
    pattern = rf'await prisma\.{prisma_model}\.findMany\(\{{([^}}]+)\}}\)'
    
    def replacer(match):
        options = match.group(1).strip()
        # This is a simplified conversion - complex where clauses need manual review
        return f"await findMany('{drizzle_table}', {{ {options} }})"
    
    content = re.sub(pattern, replacer, content)
    return content


def convert_find_first(content: str, prisma_model: str, drizzle_table: str) -> str:
    """Convert prisma.model.findFirst to findFirst with Drizzle syntax"""
    pattern = rf'await prisma\.{prisma_model}\.findFirst\(\)'
    replacement = f"await findFirst('{drizzle_table}')"
    content = re.sub(pattern, replacement, content)
    
    pattern = rf'await prisma\.{prisma_model}\.findFirst\(\{{([^}}]+)\}}\)'
    
    def replacer(match):
        options = match.group(1).strip()
        return f"await findFirst('{drizzle_table}', {{ {options} }})"
    
    content = re.sub(pattern, replacer, content)
    return content


def convert_find_unique(content: str, prisma_model: str, drizzle_table: str) -> str:
    """Convert prisma.model.findUnique to findUnique with Drizzle syntax"""
    pattern = rf'await prisma\.{prisma_model}\.findUnique\(\{{([^}}]+)\}}\)'
    
    def replacer(match):
        options = match.group(1).strip()
        return f"await findUnique('{drizzle_table}', {options})"
    
    content = re.sub(pattern, replacer, content)
    return content


def convert_create(content: str, prisma_model: str, drizzle_table: str) -> str:
    """Convert prisma.model.create to create with Drizzle syntax"""
    # Pattern: prisma.model.create({ data: { ... } })
    pattern = rf'await prisma\.{prisma_model}\.create\(\{{\s*data:\s*(\{{[^}}]*\}})\s*\}}\)'
    
    def replacer(match):
        data = match.group(1).strip()
        return f"await create('{drizzle_table}', {data})"
    
    content = re.sub(pattern, replacer, content, flags=re.DOTALL)
    return content


def convert_update(content: str, prisma_model: str, drizzle_table: str) -> str:
    """Convert prisma.model.update to update with Drizzle syntax"""
    # This is complex and needs manual review in most cases
    pattern = rf'await prisma\.{prisma_model}\.update\('
    if pattern in content:
        print(f"    ⚠️  Found update() - may need manual review")
    return content


def convert_update_many(content: str, prisma_model: str, drizzle_table: str) -> str:
    """Convert prisma.model.updateMany to updateMany with Drizzle syntax"""
    pattern = rf'await prisma\.{prisma_model}\.updateMany\('
    if pattern in content:
        print(f"    ⚠️  Found updateMany() - may need manual review")
    return content


def convert_delete(content: str, prisma_model: str, drizzle_table: str) -> str:
    """Convert prisma.model.delete to deleteRecord with Drizzle syntax"""
    pattern = rf'await prisma\.{prisma_model}\.delete\('
    if pattern in content:
        print(f"    ⚠️  Found delete() - may need manual review")
    return content


def convert_delete_many(content: str, prisma_model: str, drizzle_table: str) -> str:
    """Convert prisma.model.deleteMany to deleteMany with Drizzle syntax"""
    pattern = rf'await prisma\.{prisma_model}\.deleteMany\('
    if pattern in content:
        print(f"    ⚠️  Found deleteMany() - may need manual review")
    return content


def convert_count(content: str, prisma_model: str, drizzle_table: str) -> str:
    """Convert prisma.model.count to count with Drizzle syntax"""
    pattern = rf'await prisma\.{prisma_model}\.count\(\)'
    replacement = f"await count('{drizzle_table}')"
    content = re.sub(pattern, replacement, content)
    return content


def convert_upsert(content: str, prisma_model: str, drizzle_table: str) -> str:
    """Convert prisma.model.upsert to upsert with Drizzle syntax"""
    pattern = rf'await prisma\.{prisma_model}\.upsert\('
    if pattern in content:
        print(f"    ⚠️  Found upsert() - may need manual review")
    return content


def main():
    """Main migration script"""
    print("\n" + "="*80)
    print("PRISMA TO DRIZZLE MIGRATION SCRIPT")
    print("="*80)
    
    # Get list of files to migrate
    src_dir = Path('/home/ubuntu/Sports-Bar-TV-Controller/src')
    
    files_to_migrate = [
        'services/presetReorderService.ts',
        'app/api/matrix-display/route.ts',
        'app/api/diagnostics/device-mapping/route.ts',
        'app/api/selected-leagues/route.ts',
        'app/api/channel-presets/by-device/route.ts',
        'app/api/channel-presets/tune/route.ts',
        'app/api/channel-presets/update-usage/route.ts',
        'app/api/channel-presets/[id]/route.ts',
        'app/api/ai/run-diagnostics/route.ts',
        'app/api/ai/analyze-layout/route.ts',
        'app/api/sports-guide/current-time/route.ts',
        'app/api/soundtrack/players/route.ts',
        'app/api/soundtrack/cache/route.ts',
        'app/api/soundtrack/diagnose/route.ts',
        'app/api/soundtrack/config/route.ts',
        'app/api/soundtrack/stations/route.ts',
        'app/api/soundtrack/now-playing/route.ts',
        'app/api/soundtrack/account/route.ts',
        'app/api/unified-tv-control/route.ts',
        'app/api/atlas/route-matrix-to-zone/route.ts',
        'app/api/atlas/ai-analysis/route.ts',
        'app/api/matrix/connection-manager/route.ts',
        'app/api/matrix/config/route.ts',
        'app/api/matrix/outputs-schedule/route.ts',
        'app/api/matrix/test-connection/route.ts',
        'app/api/matrix/initialize-connection/route.ts',
        'app/api/matrix/route/route.ts',
        'app/api/tests/logs/route.ts',
        'app/api/cec/enhanced-control/route.ts',
        'app/api/cec/config/route.ts',
        'app/api/cec/power-control/route.ts',
        'lib/services/qa-uploader.ts',
        'lib/services/cec-discovery-service.ts',
        'lib/services/qa-generator.ts',
        'lib/atlas-meter-service.ts',
        'lib/scheduler-service.ts',
        'lib/firecube/sideload-service.ts',
        'lib/firecube/keep-awake-scheduler.ts',
        'lib/firecube/subscription-detector.ts',
        'lib/firecube/app-discovery.ts',
        'lib/firecube/sports-content-detector.ts',
        'lib/tvDocs/generateQA.ts',
        'lib/tvDocs/index.ts',
        'lib/ai-knowledge-qa.ts',
        'lib/ai-knowledge-enhanced.ts',
    ]
    
    migrated_count = 0
    skipped_count = 0
    
    for file_path in files_to_migrate:
        full_path = src_dir / file_path
        if full_path.exists():
            if migrate_file(str(full_path)):
                migrated_count += 1
            else:
                skipped_count += 1
        else:
            print(f"⚠️  File not found: {full_path}")
            skipped_count += 1
    
    print("\n" + "="*80)
    print(f"MIGRATION COMPLETE")
    print(f"  ✅ Migrated: {migrated_count}")
    print(f"  ⏭️  Skipped: {skipped_count}")
    print("="*80)
    print("\n⚠️  IMPORTANT: Review files with update/delete operations manually!")
    print("These operations require careful where clause conversion.\n")


if __name__ == '__main__':
    main()
