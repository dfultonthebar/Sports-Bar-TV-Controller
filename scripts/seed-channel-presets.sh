#!/bin/bash

# Seed Channel Presets Script
# This script populates the ChannelPreset table with default sports channel presets

set -e

echo "=========================================="
echo "Seeding Channel Presets"
echo "=========================================="

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Database path
DB_PATH="$PROJECT_DIR/prisma/data/sports_bar.db"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Error: Database not found at $DB_PATH"
    exit 1
fi

echo "📂 Database: $DB_PATH"

# Run the seed SQL
echo "🌱 Seeding channel presets..."
sqlite3 "$DB_PATH" < "$SCRIPT_DIR/seeds/channel-presets.sql"

# Verify the data
echo ""
echo "✅ Verifying seeded data..."
echo ""
echo "Cable Presets:"
sqlite3 "$DB_PATH" "SELECT name, channelNumber FROM ChannelPreset WHERE deviceType='cable' ORDER BY \"order\";"
echo ""
echo "DirecTV Presets:"
sqlite3 "$DB_PATH" "SELECT name, channelNumber FROM ChannelPreset WHERE deviceType='directv' ORDER BY \"order\";"
echo ""
echo "Total Presets:"
sqlite3 "$DB_PATH" "SELECT COUNT(*) || ' presets' FROM ChannelPreset;"

echo ""
echo "=========================================="
echo "✅ Channel Presets Seeded Successfully!"
echo "=========================================="
