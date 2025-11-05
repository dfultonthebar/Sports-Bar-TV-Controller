const fs = require('fs');

const fixes = [
  {
    file: 'src/lib/memory-bank/file-watcher.ts',
    line: 128,
    search: `logger.warn('[File Watcher] Pattern validation issue:', {
        hint: 'Use glob patterns like "**/*.md" or specific paths'
      })`,
    replace: `logger.warn('[File Watcher] Pattern validation issue:', {
        data: {
          hint: 'Use glob patterns like "**/*.md" or specific paths'
        }
      })`
  },
  {
    file: 'src/lib/memory-bank/file-watcher.ts',
    line: 139,
    search: `logger.info('[File Watcher] Configuration loaded:', {
        projectRoot: state.projectRoot,
        patterns: state.patterns.length,
        watching: state.isWatching
      })`,
    replace: `logger.info('[File Watcher] Configuration loaded:', {
        data: {
          projectRoot: state.projectRoot,
          patterns: state.patterns.length,
          watching: state.isWatching
        }
      })`
  },
  {
    file: 'src/lib/memory-bank/index.ts',
    line: 43,
    search: `logger.info('[Memory Bank] Retrieved snapshot:', {
      id: snapshot.id,
      timestamp: snapshot.timestamp
    })`,
    replace: `logger.info('[Memory Bank] Retrieved snapshot:', {
      data: {
        id: snapshot.id,
        timestamp: snapshot.timestamp
      }
    })`
  },
  {
    file: 'src/lib/rag-server/doc-processor.ts',
    line: 349,
    search: `logger.info('[RAG] Document processing complete:', {
      filename: filePath,
      chunkCount: chunks.length
    })`,
    replace: `logger.info('[RAG] Document processing complete:', {
      data: {
        filename: filePath,
        chunkCount: chunks.length
      }
    })`
  },
  {
    file: 'src/lib/rag-server/llm-client.ts',
    lines: [55, 148],
    search: [
      `logger.info('[LLM] Generating embedding:', {
      model: this.embeddingModel,
      dimensions: embedding.length
    })`,
      `logger.info('[LLM] Query generated:', {
      model: this.model,
      queryLength: completion.length
    })`
    ],
    replace: [
      `logger.info('[LLM] Generating embedding:', {
      data: {
        model: this.embeddingModel,
        dimensions: embedding.length
      }
    })`,
      `logger.info('[LLM] Query generated:', {
      data: {
        model: this.model,
        queryLength: completion.length
      }
    })`
    ]
  },
  {
    file: 'src/lib/rag-server/query-engine.ts',
    lines: [48, 111],
    search: [
      `logger.info('[RAG] Processing query:', {
    query,
    threshold: options?.similarityThreshold || this.similarityThreshold
  })`,
      `logger.info('[RAG] Query results:', {
      query,
      resultCount: results.length,
      topScore: results[0]?.score
    })`
    ],
    replace: [
      `logger.info('[RAG] Processing query:', {
    data: {
      query,
      threshold: options?.similarityThreshold || this.similarityThreshold
    }
  })`,
      `logger.info('[RAG] Query results:', {
      data: {
        query,
        resultCount: results.length,
        topScore: results[0]?.score
      }
    })`
    ]
  },
  {
    file: 'src/lib/rag-server/vector-store.ts',
    lines: [127, 177, 216, 241, 334],
    search: [
      `logger.info('[Vector Store] Entries loaded:', {
      entries: this.entries.length
    })`,
      `logger.info('[Vector Store] Entries added:', {
      count: newEntries.length
    })`,
      `logger.info('[Vector Store] Deleting entries:', {
      filter: JSON.stringify(filter)
    })`,
      `logger.info('[Vector Store] Searching:', {
      query: queryText,
      k,
      threshold: similarityThreshold
    })`,
      `logger.info('[Vector Store] Document deleted:', {
        filepath
      })`
    ],
    replace: [
      `logger.info('[Vector Store] Entries loaded:', {
      data: {
        entries: this.entries.length
      }
    })`,
      `logger.info('[Vector Store] Entries added:', {
      data: {
        count: newEntries.length
      }
    })`,
      `logger.info('[Vector Store] Deleting entries:', {
      data: {
        filter: JSON.stringify(filter)
      }
    })`,
      `logger.info('[Vector Store] Searching:', {
      data: {
        query: queryText,
        k,
        threshold: similarityThreshold
      }
    })`,
      `logger.info('[Vector Store] Document deleted:', {
        data: {
          filepath
        }
      })`
    ]
  }
];

console.log('Fixing remaining logger errors...\n');

let fixedCount = 0;

for (const fix of fixes) {
  try {
    const content = fs.readFileSync(fix.file, 'utf8');

    if (Array.isArray(fix.search)) {
      // Multiple fixes in one file
      let newContent = content;
      for (let i = 0; i < fix.search.length; i++) {
        const searchStr = fix.search[i];
        const replaceStr = fix.replace[i];

        if (newContent.includes(searchStr)) {
          newContent = newContent.replace(searchStr, replaceStr);
          fixedCount++;
          console.log(`✓ Fixed ${fix.file}:${fix.lines[i]}`);
        } else {
          console.log(`⚠ Could not find pattern ${i + 1} in ${fix.file}`);
        }
      }
      fs.writeFileSync(fix.file, newContent);
    } else {
      // Single fix
      if (content.includes(fix.search)) {
        const newContent = content.replace(fix.search, fix.replace);
        fs.writeFileSync(fix.file, newContent);
        fixedCount++;
        console.log(`✓ Fixed ${fix.file}:${fix.line}`);
      } else {
        console.log(`⚠ Could not find pattern in ${fix.file}:${fix.line}`);
      }
    }
  } catch (error) {
    console.error(`✗ Error fixing ${fix.file}:`, error.message);
  }
}

console.log(`\n✓ Fixed ${fixedCount} logger errors!`);
console.log('\nRun "npm run type-check" to verify.');
