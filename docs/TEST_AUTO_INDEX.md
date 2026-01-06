# Test Auto-Indexing

This is a test document to verify that the RAG auto-indexer is working.

## Features Being Tested

- Automatic file detection when new docs are added
- Re-indexing with debouncing (3 second delay)
- Vector store updates

## Expected Behavior

When this file is saved, the RAG auto-indexer should:
1. Detect the file change within 3 seconds
2. Process the document and extract chunks
3. Generate embeddings using nomic-embed-text
4. Add chunks to the vector store
5. Save the updated vector store

This should all happen automatically without manual intervention!

## Test Timestamp

Last modified: 2025-11-14 01:17 UTC - Testing auto-indexer with fixed saveVectorStore
