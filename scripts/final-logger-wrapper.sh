#!/bin/bash

echo "Applying final logger API fixes..."

# src/components/SportsGuide.tsx line 106
sed -i '106,110s/^\(\s*\)\(success:\)/\1data: {\n\1  \2/' src/components/SportsGuide.tsx
sed -i '111s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/components/SportsGuide.tsx

# src/lib/atlas-hardware-query.ts line 444
sed -i '444,450s/^\(\s*\)\(sources:\)/\1data: {\n\1  \2/' src/lib/atlas-hardware-query.ts
sed -i '451s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/atlas-hardware-query.ts

# src/lib/memory-bank/file-watcher.ts line 128
sed -i '128,130s/^\(\s*\)\(hint:\)/\1data: {\n\1  \2/' src/lib/memory-bank/file-watcher.ts  
sed -i '131s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/memory-bank/file-watcher.ts

# src/lib/memory-bank/file-watcher.ts line 139
sed -i '139,141s/^\(\s*\)\(projectRoot:\)/\1data: {\n\1  \2/' src/lib/memory-bank/file-watcher.ts
sed -i '142s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/memory-bank/file-watcher.ts

# src/lib/memory-bank/index.ts line 43
sed -i '43,47s/^\(\s*\)\(id:\)/\1data: {\n\1  \2/' src/lib/memory-bank/index.ts
sed -i '48s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/memory-bank/index.ts

# src/lib/rag-server/doc-processor.ts line 349
sed -i '349,351s/^\(\s*\)\(filename:\)/\1data: {\n\1  \2/' src/lib/rag-server/doc-processor.ts
sed -i '352s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/rag-server/doc-processor.ts

# src/lib/rag-server/llm-client.ts line 55
sed -i '55,59s/^\(\s*\)\(model:\)/\1data: {\n\1  \2/' src/lib/rag-server/llm-client.ts
sed -i '60s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/rag-server/llm-client.ts

# src/lib/rag-server/llm-client.ts line 148
sed -i '148,152s/^\(\s*\)\(model:\)/\1data: {\n\1  \2/' src/lib/rag-server/llm-client.ts
sed -i '153s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/rag-server/llm-client.ts

# src/lib/rag-server/query-engine.ts line 48 and 111
sed -i '48,50s/^\(\s*\)\(query:\)/\1data: {\n\1  \2/' src/lib/rag-server/query-engine.ts
sed -i '51s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/rag-server/query-engine.ts

sed -i '111,115s/^\(\s*\)\(query:\)/\1data: {\n\1  \2/' src/lib/rag-server/query-engine.ts
sed -i '116s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/rag-server/query-engine.ts

# src/lib/rag-server/vector-store.ts multiple lines
sed -i '127,129s/^\(\s*\)\(entries:\)/\1data: {\n\1  \2/' src/lib/rag-server/vector-store.ts
sed -i '130s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/rag-server/vector-store.ts

sed -i '177,179s/^\(\s*\)\(count:\)/\1data: {\n\1  \2/' src/lib/rag-server/vector-store.ts
sed -i '180s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/rag-server/vector-store.ts

sed -i '216,220s/^\(\s*\)\(filter:\)/\1data: {\n\1  \2/' src/lib/rag-server/vector-store.ts
sed -i '221s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/rag-server/vector-store.ts

sed -i '241,245s/^\(\s*\)\(query:\)/\1data: {\n\1  \2/' src/lib/rag-server/vector-store.ts
sed -i '246s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/rag-server/vector-store.ts

sed -i '334,336s/^\(\s*\)\(filepath:\)/\1data: {\n\1  \2/' src/lib/rag-server/vector-store.ts
sed -i '337s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/rag-server/vector-store.ts

# src/lib/validation/middleware.ts multiple lines  
sed -i '140,142s/^\(\s*\)\(endpoint:\)/\1data: {\n\1  \2/' src/lib/validation/middleware.ts
sed -i '143s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/validation/middleware.ts

sed -i '225,227s/^\(\s*\)\(endpoint:\)/\1data: {\n\1  \2/' src/lib/validation/middleware.ts
sed -i '228s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/validation/middleware.ts

sed -i '288,292s/^\(\s*\)\(params:\)/\1data: {\n\1  \2/' src/lib/validation/middleware.ts
sed -i '293s/^\(\s*\)\(\}\)/\1}\n\1\2/' src/lib/validation/middleware.ts

echo "✅ Applied all fixes"

