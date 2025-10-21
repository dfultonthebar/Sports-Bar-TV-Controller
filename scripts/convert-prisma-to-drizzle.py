#!/usr/bin/env python3
"""
Automated Prisma to Drizzle ORM Migration Script
Converts Prisma queries to Drizzle ORM patterns
"""

import os
import re
import sys
from pathlib import Path

def convert_file(file_path):
    """Convert a single file from Prisma to Drizzle"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        modified = False
        
        # Skip if already using Drizzle
        if 'from \'@/db\'' in content and 'prisma' not in content.lower():
            print(f"✓ {file_path} - Already using Drizzle")
            return False
            
        # 1. Replace Prisma imports
        if 'from \'@/lib/db\'' in content and 'prisma' in content:
            # Remove prisma from import
            content = re.sub(
                r'import\s+{\s*prisma\s*}\s+from\s+[\'"]@/lib/db[\'"]',
                'import { db, schema } from \'@/db\'\nimport { eq, and, or, desc, asc, inArray } from \'drizzle-orm\'\nimport { logger } from \'@/lib/logger\'',
                content
            )
            modified = True
        
        if 'import prisma from \'@/lib/prisma\'' in content:
            content = content.replace(
                'import prisma from \'@/lib/prisma\'',
                'import { db, schema } from \'@/db\'\nimport { eq, and, or, desc, asc, inArray } from \'drizzle-orm\'\nimport { logger } from \'@/lib/logger\'\nimport { findFirst, findMany, create, update, upsert } from \'@/lib/db-helpers\''
            )
            modified = True
        
        if 'from \'@/lib/prisma\'' in content:
            content = content.replace(
                'from \'@/lib/prisma\'',
                'from \'@/db\'\nimport { eq, and, or, desc, asc, inArray } from \'drizzle-orm\'\nimport { logger } from \'@/lib/logger\'\nimport { findFirst, findMany, create, update, upsert } from \'@/lib/db-helpers\''
            )
            modified = True
        
        # 2. Add logger imports if not present
        if 'logger' not in content and modified:
            # Find the last import statement
            import_match = re.findall(r'^import\s+.*from\s+[\'"].*[\'"]', content, re.MULTILINE)
            if import_match:
                last_import = import_match[-1]
                content = content.replace(last_import, last_import + '\nimport { logger } from \'@/lib/logger\'', 1)
        
        # 3. Replace console.log/error with logger calls (basic patterns)
        content = re.sub(r'console\.log\(([\'"])Error', 'logger.error(\\1Error', content)
        content = re.sub(r'console\.error\(', 'logger.error(', content)
        
        # Note: Actual query conversion is complex and requires manual review
        # This script handles imports and basic patterns
        # Complex queries need manual conversion using db-helpers or direct Drizzle queries
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ {file_path} - Converted imports")
            return True
        else:
            print(f"- {file_path} - No changes needed")
            return False
            
    except Exception as e:
        print(f"✗ {file_path} - Error: {e}")
        return False

def main():
    """Main conversion process"""
    if len(sys.argv) < 2:
        print("Usage: python3 convert-prisma-to-drizzle.py <directory>")
        sys.exit(1)
    
    root_dir = Path(sys.argv[1])
    
    if not root_dir.exists():
        print(f"Error: Directory {root_dir} does not exist")
        sys.exit(1)
    
    print("=" * 60)
    print("Prisma to Drizzle ORM Migration Script")
    print("=" * 60)
    print(f"Scanning directory: {root_dir}")
    print()
    
    # Find all TypeScript files
    ts_files = list(root_dir.rglob("*.ts")) + list(root_dir.rglob("*.tsx"))
    
    # Filter out node_modules and .next directories
    ts_files = [f for f in ts_files if 'node_modules' not in str(f) and '.next' not in str(f)]
    
    # Filter files that contain 'prisma'
    prisma_files = []
    for file in ts_files:
        try:
            with open(file, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'prisma' in content.lower():
                    prisma_files.append(file)
        except:
            pass
    
    print(f"Found {len(prisma_files)} files with Prisma references")
    print()
    
    converted = 0
    for file in prisma_files:
        if convert_file(file):
            converted += 1
    
    print()
    print("=" * 60)
    print(f"Conversion complete: {converted}/{len(prisma_files)} files modified")
    print("=" * 60)
    print()
    print("IMPORTANT: This script only handles basic conversions.")
    print("You must manually review and convert:")
    print("  1. All Prisma queries (findFirst, findMany, create, update, etc.)")
    print("  2. Complex where clauses and includes")
    print("  3. Relations and joins")
    print()
    print("Use the following helpers from @/lib/db-helpers:")
    print("  - findFirst, findMany, findUnique")
    print("  - create, createMany")
    print("  - update, updateMany")
    print("  - upsert")
    print("  - deleteRecord, deleteMany")
    print()

if __name__ == "__main__":
    main()
