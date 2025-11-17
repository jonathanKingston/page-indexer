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

### History Search (New!)
A fast, elegant search interface for your indexed pages with dual search modes:

**Search Modes**:
- **Baseline Mode**: Lightning-fast text search (<10ms) with intelligent scoring
  - Text matching (title, URL, domain) with term weighting
  - Recency decay (exponential, 2-week tau)
  - Smart ranking based on indexed content
- **AI Mode**: Semantic search using all-MiniLM-L6-v2 embeddings
  - Understands conceptual queries beyond keyword matching
  - Shows relevant snippets from matching chunks
  - Automatic fallback to baseline if unavailable

**Features**:
- **Dual-Mode Search**: Toggle between fast baseline and AI semantic search
- **Modal Details**: Click any result to view full page information
- **Full Keyboard Support**: `/` to focus, `↑/↓` to navigate, `Enter` to view, `Esc` to close
- **Accessibility**: WCAG AA compliant with ARIA labels and screen reader support
- **Empty State Handling**: Shows helpful message when no pages are indexed
- **Mock Data Mode**: Add `?mock=1` for testing/demo without indexed pages

To use: Open `history.html` in the extension. See HISTORY_SEARCH.md for full documentation.

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