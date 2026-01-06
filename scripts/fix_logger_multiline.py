#!/usr/bin/env python3

"""
Fix multiline logger calls with unknown properties
"""

import subprocess
import re
from pathlib import Path

def get_ts_errors():
    """Get TS2353 errors from tsc"""
    try:
        result = subprocess.run(
            ['npx', 'tsc', '--noEmit'],
            capture_output=True,
            text=True,
            cwd=Path.cwd()
        )
        output = result.stdout + result.stderr
    except Exception as e:
        print(f"Error running tsc: {e}")
        return []

    errors = []
    pattern = re.compile(r'^(.+?)\((\d+),\d+\):\s+error\s+TS2353:.*\'(\w+)\' does not exist in type \'LogOptions\'')

    for line in output.split('\n'):
        match = pattern.match(line)
        if match:
            errors.append({
                'file': match.group(1).strip(),
                'line': int(match.group(2)),
                'property': match.group(3)
            })

    return errors

def fix_file(file_path, errors_for_file):
    """Fix a single file"""
    try:
        with open(file_path, 'r') as f:
            content = f.read()

        lines = content.split('\n')
        modified = False

        # Process in reverse order to avoid line number shifts
        for error in sorted(errors_for_file, key=lambda x: x['line'], reverse=True):
            line_idx = error['line'] - 1
            if line_idx < 0 or line_idx >= len(lines):
                continue

            line = lines[line_idx]

            # Check if this is a logger call
            if 'logger.' not in line:
                continue

            # Check if already wrapped in data
            if '{ data:' in line or '{data:' in line:
                print(f"  ℹ️  Line {error['line']}: Already wrapped")
                continue

            # Find if this is part of a multiline object literal
            # Look for pattern: logger.xxx('message', {
            #                     property: value,
            #                     ...
            #                   })

            # Find the start of the object (may be on this line or previous)
            obj_start_idx = line_idx
            obj_start_line = lines[obj_start_idx]

            # Find where the second argument starts
            while obj_start_idx >= 0:
                if 'logger.' in lines[obj_start_idx]:
                    obj_start_line = lines[obj_start_idx]
                    break
                obj_start_idx -= 1

            if obj_start_idx < 0:
                print(f"  ⚠️  Line {error['line']}: Could not find logger call start")
                continue

            # Check if second param is an object with unknown properties
            # Pattern: logger.method('...', { or logger.method("...", {
            match = re.search(r'(logger\.\w+)\s*\(\s*[\'"`][^\'"]*[\'"`]\s*,\s*\{', obj_start_line)
            if not match:
                print(f"  ⚠️  Line {error['line']}: Could not find object start")
                continue

            # Find the closing of the object
            obj_end_idx = line_idx
            brace_count = 0
            found_start = False

            for i in range(obj_start_idx, len(lines)):
                for char in lines[i]:
                    if char == '{':
                        brace_count += 1
                        found_start = True
                    elif char == '}' and found_start:
                        brace_count -= 1
                        if brace_count == 0:
                            obj_end_idx = i
                            break
                if brace_count == 0 and found_start:
                    break

            if brace_count != 0:
                print(f"  ⚠️  Line {error['line']}: Could not find matching braces")
                continue

            # Now we have the range [obj_start_idx, obj_end_idx]
            # We need to add "data: {" after the first "{" and add "}" before the last "}"

            # Get the indent level
            obj_start = lines[obj_start_idx]
            indent_match = re.match(r'(\s*)', obj_start)
            base_indent = indent_match.group(1) if indent_match else ''

            # Add data wrapper
            # Line at obj_start_idx: replace the first { after the comma with { data: {
            lines[obj_start_idx] = re.sub(
                r'(logger\.\w+\s*\([^,]+,\s*)\{',
                r'\1{ data: {',
                lines[obj_start_idx],
                count=1
            )

            # Line at obj_end_idx: add closing } before the })
            # Find the position of the last }
            obj_end_line = lines[obj_end_idx]
            # Add closing } for data wrapper
            # Pattern: replace }[)] with }}[)]
            lines[obj_end_idx] = re.sub(
                r'\}(\s*\))',
                r'}\n' + base_indent + '  }\g<1>',
                obj_end_line,
                count=1
            )

            modified = True
            print(f"  ✓ Fixed lines {obj_start_idx + 1}-{obj_end_idx + 1}")

        if modified:
            with open(file_path, 'w') as f:
                f.write('\n'.join(lines))
            return True

        return False

    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    print("🔧 Fixing multiline logger calls with unknown properties\n")

    errors = get_ts_errors()
    print(f"Found {len(errors)} TS2353 errors\n")

    # Group by file
    files = {}
    for error in errors:
        if error['file'] not in files:
            files[error['file']] = []
        files[error['file']].append(error)

    fixed_count = 0
    for file_path, file_errors in files.items():
        print(f"Processing {file_path} ({len(file_errors)} errors)")
        if fix_file(file_path, file_errors):
            fixed_count += 1

    print(f"\n✨ Fixed {fixed_count} files")

    # Re-check
    print("\nRunning final type check...")
    try:
        result = subprocess.run(
            ['bash', '-c', 'npx tsc --noEmit 2>&1 | grep "TS2353.*LogOptions" | wc -l'],
            capture_output=True,
            text=True,
            cwd=Path.cwd()
        )
        remaining = int(result.stdout.strip())
        print(f"Remaining TS2353 LogOptions errors: {remaining}")
    except:
        pass

if __name__ == '__main__':
    main()
