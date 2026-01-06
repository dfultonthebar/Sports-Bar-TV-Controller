#!/bin/bash
cd "$(dirname "$0")"
echo "Building AI Knowledge Base..."
npx tsx scripts/build-knowledge-base.ts
