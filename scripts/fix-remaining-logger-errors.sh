#!/bin/bash

# Fix remaining logger TS2353 errors by wrapping custom properties in data: { }

# Array of file:line:property mappings
declare -a fixes=(
  "src/app/api/directv-logs/route.ts:49:deviceId"
  "src/app/api/directv-logs/route.ts:60:ipAddress"
  "src/lib/atlas-hardware-query.ts:444:sources"
  "src/lib/memory-bank/file-watcher.ts:128:hint"
  "src/lib/memory-bank/file-watcher.ts:139:projectRoot"
  "src/lib/memory-bank/index.ts:43:id"
  "src/lib/rag-server/doc-processor.ts:349:filename"
  "src/lib/rag-server/llm-client.ts:55:model"
  "src/lib/rag-server/llm-client.ts:148:model"
  "src/lib/rag-server/query-engine.ts:48:query"
  "src/lib/rag-server/query-engine.ts:111:query"
  "src/lib/rag-server/vector-store.ts:127:entries"
  "src/lib/rag-server/vector-store.ts:177:count"
  "src/lib/rag-server/vector-store.ts:216:filter"
  "src/lib/rag-server/vector-store.ts:241:query"
  "src/lib/rag-server/vector-store.ts:334:filepath"
)

echo "Fixing remaining logger errors..."

for fix in "${fixes[@]}"; do
  IFS=':' read -r file line prop <<< "$fix"
  echo "Processing $file:$line ($prop)"

  # Use Node.js to properly handle the fix
  node -e "
    const fs = require('fs');
    const lines = fs.readFileSync('$file', 'utf8').split('\n');
    const lineNum = $line - 1;

    // Get the logger call - might span multiple lines
    let startLine = lineNum;
    let endLine = lineNum;

    // Find start of logger call
    while (startLine > 0 && !lines[startLine].includes('logger.')) {
      startLine--;
    }

    // Find end of logger call (closing parenthesis and})
    while (endLine < lines.length && (!lines[endLine].includes(')') || !lines[endLine].includes('}'))) {
      endLine++;
    }

    // Extract the logger call
    const loggerCall = lines.slice(startLine, endLine + 1);

    // Check if already has data: wrapper
    const fullCall = loggerCall.join('\n');
    if (fullCall.includes('data: {')) {
      console.log('Already fixed');
      process.exit(0);
    }

    // Find the opening { after the message string
    let braceIndex = -1;
    for (let i = 0; i < loggerCall.length; i++) {
      if (loggerCall[i].includes('{') && !loggerCall[i].includes('data: {')) {
        braceIndex = startLine + i;
        break;
      }
    }

    if (braceIndex !== -1) {
      // Add 'data: {' after the opening brace
      const indent = lines[braceIndex].match(/^\\s*/)[0];
      lines[braceIndex] = lines[braceIndex].replace('{', '{\n' + indent + '  data: {');

      // Add closing } before the final }
      let closingIndex = endLine;
      const closingIndent = lines[closingIndex].match(/^\\s*/)[0];
      lines[closingIndex] = closingIndent + '  }\n' + lines[closingIndex];

      fs.writeFileSync('$file', lines.join('\n'));
      console.log('Fixed');
    } else {
      console.log('Could not find pattern');
    }
  "
done

echo "Done! Run type-check to verify."
