# Page Indexer

An exploration into low impact indexing using embeddings.

A Chrome extension that automatically captures web pages as MHTML, extracts text content, chunks it into segments, and computes embeddings using ONNX Runtime Web for offline search capabilities. Includes a basic UI for searching, and managing indexed content.

## Features

### Core Functionality
- **Automatic Page Capture**: Uses `chrome.pageCapture.saveAsMHTML()` to capture pages on load
- **MHTML Processing**: Extracts HTML content from MHTML using `mhtml-to-html`
- **Text Chunking**: Splits content into 512 token segments (configurable 256-1024) with 50 token overlap using simple word-based splitting
- **Embedding Computation**: Uses all-MiniLM-L6-v2 model via ONNX Runtime Web with WebGPU/WASM support
- **OPFS Storage**: Persists embedding vectors and chunk data in Origin Private File System
- **Chrome Storage**: Lightweight metadata storage for quick lookups

captures and indexes pages as you browse. No user interaction required.

## Technical Details

### Storage
- **OPFS**: 
  - Chunks stored as JSON files
  - Embedding vectors stored as binary data (Float32Array serialized)
- **Chrome Storage**: Metadata (URLs, titles, timestamps, chunk counts)

### Chunking Strategy
- Target size: 512 tokens per chunk (configurable 256-1024 in UI)
- Overlap: 50 tokens between chunks
- Method: Simple word-based splitting (words separated by whitespace)
- Note: Uses word count, not actual tokenization for chunk boundaries

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