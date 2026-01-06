# @sports-bar/tv-docs

TV documentation utilities for searching, downloading, and extracting manual content.

## Features

- **Search Manuals**: Find TV manuals and documentation from the internet
- **Download Manuals**: Download PDF and HTML manuals to local storage
- **Extract Content**: Extract text content from PDF and text files
- **Content Processing**: Split content into chunks and extract key sections

## Installation

```bash
npm install @sports-bar/tv-docs
```

## Dependencies

- `pdf-parse`: For PDF content extraction
- `@sports-bar/logger`: For logging (peer dependency)

## Usage

### Search for TV Manual

```typescript
import { searchTVManual, validateManualUrl } from '@sports-bar/tv-docs'

const results = await searchTVManual('Samsung', 'UN55RU7100')
console.log('Found manuals:', results)

// Validate a specific URL
const isValid = await validateManualUrl('https://example.com/manual.pdf')
```

### Download Manual

```typescript
import { downloadTVManual, getManualPath } from '@sports-bar/tv-docs'

// Download from search results
const download = await downloadTVManual('Samsung', 'UN55RU7100', searchResults)
if (download) {
  console.log('Manual saved to:', download.path)
}

// Check if manual exists
const existingPath = await getManualPath('Samsung', 'UN55RU7100')
```

### Extract Content

```typescript
import {
  extractManualContent,
  splitContentIntoChunks,
  extractKeySections
} from '@sports-bar/tv-docs'

// Extract text from PDF or text file
const content = await extractManualContent('/path/to/manual.pdf')

// Split into chunks for processing
const chunks = splitContentIntoChunks(content, 2000)

// Extract key sections
const sections = extractKeySections(content)
console.log('Sections:', Object.keys(sections))
```

## API Reference

### Types

- `TVManualSearchResult`: Search result with URL, title, and relevance score
- `TVDocumentationRecord`: Database record for TV documentation
- `TVManualFetchOptions`: Options for fetching manuals
- `TVManualFetchResult`: Result of manual fetch operation

### Functions

#### Search

- `searchTVManual(manufacturer, model)`: Search for TV manuals
- `validateManualUrl(url)`: Validate if URL is a valid manual

#### Download

- `downloadTVManual(manufacturer, model, searchResults)`: Download manual from search results
- `getManualPath(manufacturer, model)`: Get path to existing manual
- `listDownloadedManuals()`: List all downloaded manuals

#### Extract

- `extractManualContent(filePath)`: Extract text from PDF or text file
- `splitContentIntoChunks(content, chunkSize)`: Split content into chunks
- `extractKeySections(content)`: Extract key sections from content

## Notes

- Manuals are stored in `docs/tv-manuals/` directory
- PDF files require `pdf-parse` dependency
- All functions use `@sports-bar/logger` for logging
- This package does NOT include database-dependent functions (those remain in the web app)
