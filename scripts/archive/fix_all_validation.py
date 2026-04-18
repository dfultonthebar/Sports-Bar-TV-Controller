#!/usr/bin/env python3
"""
Fix validation bypass security issue in all API route files.
Replaces: await request.json() with bodyValidation.data
After: const bodyValidation = await validateRequestBody(...)
"""

import re
import sys
from pathlib import Path

def fix_validation_bypass(content: str) -> tuple[str, bool]:
    """Fix the validation bypass pattern in a file."""

    # Pattern 1: Simple destructuring from request.json()
    # Match: const { ... } = await request.json()
    # After a bodyValidation check
    pattern1 = re.compile(
        r'(const bodyValidation = await validateRequestBody\([^)]+\)\s+'
        r'if \(!bodyValidation\.success\) return bodyValidation\.error\s*\n)'
        r'(\s*\n\s*)'
        r'(try \{\s*\n\s*)'
        r'(const (?:body|\{[^}]+\}) = await request\.json\(\))',
        re.MULTILINE | re.DOTALL
    )

    def replace1(match):
        validation_block = match.group(1)
        whitespace = match.group(2)
        try_block = match.group(3)
        json_line = match.group(4)

        # Extract variable name/pattern
        if json_line.startswith('const body'):
            replacement = validation_block + '\n  // Security: use validated data\n  const body = bodyValidation.data\n' + whitespace + try_block
        else:
            # Extract destructuring pattern
            var_pattern = json_line[6:json_line.index(' =')]
            replacement = validation_block + f'\n  // Security: use validated data\n  const {var_pattern} = bodyValidation.data\n' + whitespace + try_block

        return replacement

    new_content, count1 = pattern1.subn(replace1, content)

    # Pattern 2: const body = await request.json() followed by destructuring
    pattern2 = re.compile(
        r'(const bodyValidation = await validateRequestBody\([^)]+\)\s+'
        r'if \(!bodyValidation\.success\) return bodyValidation\.error\s*\n)'
        r'(\s*\n\s*)'
        r'(try \{\s*\n\s*)'
        r'(const body = await request\.json\(\)\s*\n\s*const \{[^}]+\} = body)',
        re.MULTILINE | re.DOTALL
    )

    def replace2(match):
        validation_block = match.group(1)
        whitespace = match.group(2)
        try_block = match.group(3)
        json_lines = match.group(4)

        # Extract destructuring pattern
        dest_match = re.search(r'const (\{[^}]+\}) = body', json_lines)
        if dest_match:
            var_pattern = dest_match.group(1)
            replacement = validation_block + f'\n  // Security: use validated data\n  const {var_pattern} = bodyValidation.data\n' + whitespace + try_block
        else:
            replacement = validation_block + '\n  // Security: use validated data\n  const body = bodyValidation.data\n' + whitespace + try_block

        return replacement

    new_content, count2 = pattern2.subn(replace2, new_content)

    return new_content, (count1 + count2 > 0)

def process_file(file_path: Path) -> bool:
    """Process a single file and return True if modified."""
    try:
        content = file_path.read_text()

        # Only process if it has both validateRequestBody and await request.json()
        if 'validateRequestBody' not in content or 'await request.json()' not in content:
            return False

        new_content, modified = fix_validation_bypass(content)

        if modified:
            # Create backup
            backup_path = file_path.with_suffix('.ts.bak')
            backup_path.write_text(content)

            # Write fixed content
            file_path.write_text(new_content)
            print(f"✓ Fixed: {file_path}")
            return True

        return False

    except Exception as e:
        print(f"✗ Error processing {file_path}: {e}", file=sys.stderr)
        return False

def main():
    """Find and fix all API route files."""
    api_dir = Path('src/app/api')

    if not api_dir.exists():
        print(f"Error: {api_dir} not found", file=sys.stderr)
        sys.exit(1)

    # Find all route.ts files
    route_files = list(api_dir.rglob('route.ts'))

    print(f"Found {len(route_files)} route files")
    print("Processing...")
    print()

    fixed_count = 0
    for route_file in sorted(route_files):
        if process_file(route_file):
            fixed_count += 1

    print()
    print(f"Summary: Fixed {fixed_count} files")

    if fixed_count > 0:
        print()
        print("Backup files created with .ts.bak extension")
        print("Run 'npm run build' to verify fixes")

if __name__ == '__main__':
    main()
