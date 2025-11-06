#!/bin/bash

echo "Fixing final TypeScript errors systematically..."

# Fix 1: logs/device-interaction - unknown to boolean
sed -i "s/const success = body.success/const success = Boolean(body.success)/" \
  src/app/api/logs/device-interaction/route.ts

# Fix 2-9: matrix/video-input-selection - number to string (8 errors)
# These are database IDs that need to be strings
perl -i -pe 's/eq\(matrixInputs\.id, (\w+)\)/eq(matrixInputs.id, String($1))/g' \
  src/app/api/matrix/video-input-selection/route.ts
perl -i -pe 's/eq\(matrixOutputs\.id, (\w+)\)/eq(matrixOutputs.id, String($1))/g' \
  src/app/api/matrix/video-input-selection/route.ts

# Fix 10: scheduled-commands - unknown to string
sed -i "s/JSON.parse(command.targets)/JSON.parse(String(command.targets))/" \
  src/app/api/scheduled-commands/route.ts

# Fix 11: soundtrack/config - unknown to string
sed -i "s/body.venue/String(body.venue)/" \
  src/app/api/soundtrack/config/route.ts

# Fix 12: soundtrack/players - unknown to string
sed -i "s/player.id === body.playerId/player.id === String(body.playerId)/" \
  src/app/api/soundtrack/players/route.ts

# Fix 13: sports-guide/ollama/query - unknown to string
sed -i "s/const query = body.query/const query = String(body.query)/" \
  src/app/api/sports-guide/ollama/query/route.ts

# Fix 14: streaming/apps/detect - unknown to string
sed -i "s/const deviceId = body.deviceId/const deviceId = String(body.deviceId)/" \
  src/app/api/streaming/apps/detect/route.ts

# Fix 15-19: web-search - unknown to string/number (5 errors)
sed -i "s/query: query || ''/query: String(query || '')/" \
  src/app/api/web-search/route.ts
sed -i "s/safeSearch: safeSearch/safeSearch: String(safeSearch)/" \
  src/app/api/web-search/route.ts
sed -i "s/freshness: freshness/freshness: String(freshness)/" \
  src/app/api/web-search/route.ts
sed -i "s/count: count ? parseInt(String(count))/count: count ? Number(count)/" \
  src/app/api/web-search/route.ts

# Fix 22: firecube/keep-awake-scheduler - string to boolean
sed -i "s/device.keepAwakeEnabled === 'true'/device.keepAwakeEnabled === true/" \
  src/lib/firecube/keep-awake-scheduler.ts

echo "Done! Fixed systematic TS2345 errors."
