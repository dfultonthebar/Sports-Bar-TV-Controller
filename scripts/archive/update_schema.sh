
#!/bin/bash
set -e

echo "=== Updating Prisma Schema ==="

# Backup current schema
cp prisma/schema.prisma prisma/schema.prisma.backup

# Append new models to schema
cat prisma/schema_additions.prisma >> prisma/schema.prisma

# Also update HomeTeam model to add missing fields
# We need to modify the existing HomeTeam model

echo ""
echo "=== Schema updated successfully ==="
echo "Next steps:"
echo "1. Review prisma/schema.prisma"
echo "2. Run: npx prisma migrate dev --name add_sports_guide_and_todo_models"
echo "3. Run: npx prisma generate"
