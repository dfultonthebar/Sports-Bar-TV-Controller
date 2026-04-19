#!/usr/bin/env python3
"""
Fix validation bypass security issue - Version 2
Handles more complex patterns
"""

import re
from pathlib import Path

def fix_file(file_path: Path) -> bool:
    """Fix validation bypass in a single file."""
    content = file_path.read_text()

    # Skip if no validation or no request.json()
    if 'validateRequestBody' not in content or 'await request.json()' not in content:
        return False

    original = content
    lines = content.split('\n')
    new_lines = []
    i = 0
    modified = False

    while i < len(lines):
        line = lines[i]

        # Check if this is a bodyValidation line
        if 'const bodyValidation = await validateRequestBody' in line:
            # Add this line and the next (if statement)
            new_lines.append(line)
            i += 1
            if i < len(lines) and 'if (!bodyValidation.success)' in lines[i]:
                new_lines.append(lines[i])
                i += 1

                # Check for empty lines
                while i < len(lines) and lines[i].strip() == '':
                    new_lines.append(lines[i])
                    i += 1

                # Now check if next line has await request.json()
                if i < len(lines) and 'await request.json()' in lines[i]:
                    json_line = lines[i]

                    # Check if inside try block
                    if 'try {' in json_line or (i+1 < len(lines) and 'try {' in lines[i+1]):
                        # Extract variable pattern
                        match = re.search(r'const\s+(body|\{[^}]+\})\s*=\s*await request\.json\(\)', json_line)

                        if match:
                            var_pattern = match.group(1)
                            indent = ' ' * (len(json_line) - len(json_line.lstrip()))

                            # Add security comment and use validated data
                            new_lines.append('')
                            new_lines.append(f'{indent}// Security: use validated data')
                            new_lines.append(f'{indent}const {var_pattern} = bodyValidation.data')
                            new_lines.append('')

                            # Skip the original await request.json() line
                            i += 1
                            modified = True

                            # If there's a try block on the next line, don't duplicate it
                            if i < len(lines) and 'try {' in lines[i]:
                                # This is handled, continue normally
                                pass

                            continue

        new_lines.append(line)
        i += 1

    if modified:
        file_path.with_suffix('.ts.bak2').write_text(content)
        file_path.write_text('\n'.join(new_lines))
        return True

    return False

def main():
    """Process all route files."""
    api_dir = Path('src/app/api')
    route_files = list(api_dir.rglob('route.ts'))

    print(f"Processing {len(route_files)} files...")
    fixed = []

    for file_path in sorted(route_files):
        if fix_file(file_path):
            fixed.append(file_path)
            print(f"✓ {file_path}")

    print(f"\n Fixed {len(fixed)} files")

if __name__ == '__main__':
    main()
