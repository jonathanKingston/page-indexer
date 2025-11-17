# Page Indexer

An exploration into low impact indexing using embeddings.

A Chrome extension that automatically captures web pages as MHTML, extracts text content, chunks it into segments, and computes embeddings using ONNX Runtime Web for offline search capabilities. Includes a basic UI for searching, and managing indexed content.

## Features

### Core Functionality
- **Automatic Page Capture**: Uses `chrome.pageCapture.saveAsMHTML()` to capture pages on load
- **MHTML Processing**: Extracts HTML content from MHTML using `mhtml-to-html`
- **Text Chunking**: Splits content into 510 token segments with 50 token overlap using BERT WordPiece tokenization
- **Embedding Computation**: Uses all-MiniLM-L6-v2 model via ONNX Runtime Web with WebGPU/WASM support
- **OPFS Storage**: Persists embedding vectors and chunk data in Origin Private File System
- **Chrome Storage**: Lightweight metadata storage for quick lookups

captures and indexes pages as you browse. No user interaction required.

## Development Setup

### Prerequisites
- Node.js and npm installed
- Firefox (for testing with web-ext)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Download required models and ONNX Runtime files:
   ```bash
   npm run setup
   ```

### Building
Build the extension (bundles offscreen.js with esbuild):
```bash
npm run build        # Production build
npm run build:dev    # Development build with source maps
npm run watch        # Watch mode for development
```

### Testing & Validation
Run the extension in Firefox for validation:
```bash
npm run start        # Build and run in Firefox
npm run start:dev    # Build with source maps and run in Firefox
npm run package      # Build and package extension as .zip
npm run lint:ext     # Lint extension code
```

**Note**: This extension is designed for Chrome (Manifest v3) but can be tested in Firefox for validation purposes. Some Chrome-specific APIs (like `pageCapture` and `offscreen`) are not available in Firefox.

The packaged extension will be available in `web-ext-artifacts/page_indexer-1.0.0.zip`.

## Technical Details

### Storage
- **OPFS**: 
  - Chunks stored as JSON files
  - Embedding vectors stored as binary data (Float32Array serialized)
- **Chrome Storage**: Metadata (URLs, titles, timestamps, chunk counts)

### Chunking Strategy
- Target size: 510 content tokens per chunk (plus 2 special tokens: [CLS] and [SEP])
- Overlap: 50 tokens between chunks
- Method: BERT WordPiece tokenization with token-based chunking
- Features: Text reconstruction for displaying readable snippets in search results
- Note: Tokenizes entire text first, then chunks based on actual token boundaries

### Search Algorithm
1. Compute query embedding using same model
2. Load all page embeddings from OPFS
3. Compute cosine similarity for all chunks
4. Rank results by similarity score
5. Return top K results with metadata

## UI Components

### Browser Action Popup
- **Quick Stats**: Pages indexed, chunks stored, storage usage
- **Recent Pages**: Last 5 indexed pages with favicons
- **Quick Actions**: View all pages, search index, settings

### Debugging
- **Content Script**: Use `window.offlineIndexer` in console
- **Background**: Check service worker logs in DevTools
- **Worker**: Monitor worker messages in background script
- **Storage**: Inspect OPFS and chrome.storage in DevTools
- **UI**: Use browser DevTools for popup and side panel debugging

## Limitations

- Only works on HTTP/HTTPS pages
- Requires OPFS support (Chrome 86+)
- Model download required on first run (~25MB)
- WebGPU support recommended for performance
- Storage limited by browser quotas
- Side panel requires Chrome 114+

## License

MIT License - see LICENSE file for details.