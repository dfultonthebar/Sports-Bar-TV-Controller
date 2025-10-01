
#!/bin/bash

# Initialize local configuration from templates
# This script creates local config files from templates if they don't exist
# Local config files are .gitignored so they won't be overwritten by git pulls

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
CONFIG_DIR="$PROJECT_ROOT/config"

echo "🔧 Initializing local configuration..."
echo ""

# Array of config files to create
declare -a configs=(
  "local"
  "devices"
  "sports-teams"
)

created=0
skipped=0

for config in "${configs[@]}"; do
  template="$CONFIG_DIR/$config.template.json"
  local_file="$CONFIG_DIR/$config.local.json"
  
  if [ ! -f "$local_file" ]; then
    if [ -f "$template" ]; then
      cp "$template" "$local_file"
      echo "✅ Created: config/$config.local.json"
      created=$((created + 1))
    else
      echo "⚠️  Warning: Template not found: $template"
    fi
  else
    echo "⏭️  Skipped: config/$config.local.json (already exists)"
    skipped=$((skipped + 1))
  fi
done

echo ""
echo "📊 Summary:"
echo "  • Created: $created file(s)"
echo "  • Skipped: $skipped file(s) (already exist)"
echo ""

if [ $created -gt 0 ]; then
  echo "✏️  Please edit the following files to match your local setup:"
  for config in "${configs[@]}"; do
    local_file="$CONFIG_DIR/$config.local.json"
    if [ -f "$local_file" ]; then
      echo "   - config/$config.local.json"
    fi
  done
  echo ""
fi

echo "ℹ️  These local config files are .gitignored and won't be overwritten by git updates."
echo ""
echo "✨ Configuration initialization complete!"
