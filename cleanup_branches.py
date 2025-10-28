#!/usr/bin/env python3
import json
import subprocess
import sys

# Read the branch data
with open('/home/ubuntu/.external_service_outputs/git_tool_output_1761662522.json', 'r') as f:
    data = json.load(f)

branches = data['branches']
main_branch = 'main'

# Get main branch SHA
result = subprocess.run(['git', 'rev-parse', 'main'], capture_output=True, text=True)
main_sha = result.stdout.strip()

print(f"Main branch SHA: {main_sha}")
print(f"Total branches found: {len(branches)}")
print("\nChecking which branches are merged into main...")

merged_branches = []
unmerged_branches = []

for branch in branches:
    branch_name = branch['name']
    
    # Skip main branch
    if branch_name == 'main':
        continue
    
    # Check if branch is merged using git merge-base
    try:
        # Get the merge base between main and the branch
        result = subprocess.run(
            ['git', 'merge-base', '--is-ancestor', branch['commit']['sha'], main_sha],
            capture_output=True
        )
        
        if result.returncode == 0:
            merged_branches.append(branch_name)
        else:
            unmerged_branches.append(branch_name)
    except Exception as e:
        print(f"Error checking {branch_name}: {e}")
        unmerged_branches.append(branch_name)

print(f"\n✅ Merged branches (can be deleted): {len(merged_branches)}")
for branch in sorted(merged_branches)[:20]:
    print(f"  - {branch}")
if len(merged_branches) > 20:
    print(f"  ... and {len(merged_branches) - 20} more")

print(f"\n⚠️ Unmerged branches (keep): {len(unmerged_branches)}")
for branch in sorted(unmerged_branches)[:10]:
    print(f"  - {branch}")
if len(unmerged_branches) > 10:
    print(f"  ... and {len(unmerged_branches) - 10} more")

# Save results
with open('/tmp/merged_branches.txt', 'w') as f:
    for branch in merged_branches:
        f.write(f"{branch}\n")

print(f"\n📝 Merged branches list saved to /tmp/merged_branches.txt")
print(f"Total merged branches to delete: {len(merged_branches)}")
