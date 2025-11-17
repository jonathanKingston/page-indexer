# Chrome Extension: Page Indexer - Architecture Analysis

## High-Level Data Flow

```
HTML Page Load
    ↓
[content.js] ← Triggers page capture on DOMContentLoaded
    ↓
[background.js] ← Receives CAPTURE_PAGE message
    ↓
[chrome.pageCapture.saveAsMHTML()] ← Captures page as MHTML
    ↓
[offscreen.js] ← Processes MHTML asynchronously
    ↓ (Parallel steps)
    ├─→ Extract HTML from MHTML
    ├─→ Extract text using Readability
    ├─→ Tokenize text using BERT WordPiece
    ├─→ Chunk into 510-token segments (50 overlap)
    └─→ Compute embeddings using ONNX Runtime
    ↓
[Storage] ← Save to OPFS & Chrome Storage
    ├─→ Chrome Storage: Page metadata, URL index
    ├─→ OPFS /chunks/: Serialized chunk JSON
    ├─→ OPFS /embeddings/: Individual embedding vectors
    └─→ OPFS /vectors/: Binary embedding data (alternative)
```

---

## Key Files & Classes

### 1. content.js - Page Capture Trigger
**Purpose**: Monitors page loads and initiates indexing

**Key Class**: `ContentScript`

**Main Methods**:
- `init()` - Initializes on document load
- `isValidPage()` - Checks if page is HTTP/HTTPS
- `handlePageLoad()` - Waits 1 second after load, sends CAPTURE_PAGE message
- `sendMessage(message)` - Chrome message API wrapper
- `handleStatusUpdate(message)` - Listens for indexing status from background

**Message Flow**:
```javascript
→ CAPTURE_PAGE
  { type: 'CAPTURE_PAGE', data: { url, title } }
← INDEXING_STATUS
  { type: 'INDEXING_STATUS', data: { status, error, url } }
```

**Key Exports**:
- `window.offlineIndexer` - Global reference for debugging in console

---

### 2. background.js - Main Orchestration Service
**Purpose**: Coordinates page capture, offscreen processing, search, and storage

**Key Class**: `BackgroundService`

#### Core Processing Pipeline

**Method**: `captureAndProcess(tabId, url, title)`
1. Check if page already indexed
2. Capture MHTML using `chrome.pageCapture.saveAsMHTML(tabId)`
3. Call `processPageWithWorker()` to send to offscreen
4. Store metadata in Chrome Storage
5. Store chunks + embeddings in OPFS

**Method**: `processPageWithWorker(mhtmlBlob, url, title, pageId)`
- Converts Blob to Uint8Array
- Sends PROCESS_PAGE message to offscreen document
- Waits for result with chunks and flags
- Returns processing result

**Method**: `ensureOffscreenDocument()`
- Creates offscreen document if not exists
- Uses Manifest v3 offscreen API
- Reason: 'WORKERS' for MHTML processing

**Method**: `sendToOffscreen(message)`
- Promise-based message passing with timeout (2 minutes)
- Handles request IDs for tracking
- Stores pending requests in `pendingRequests` Map
- Resolves/rejects based on response

#### Search Pipeline

**Method**: `semanticSearch(query, limit = 10)`
- Wrapper that calls `searchWithWorker()`

**Method**: `searchWithWorker(query, limit = 10)`
1. Sends COMPUTE_QUERY_EMBEDDING to offscreen
2. Gets queryEmbedding as Float32Array
3. Iterates through all pages' chunks and embeddings
4. Computes cosine similarity for each chunk
5. Sorts by similarity, returns top K results

**Method**: `cosineSimilarity(a, b)`
- Computes cosine similarity between two Float32Array vectors
- Formula: dotProduct / (magnitude_a * magnitude_b)
- Returns value between 0 and 1

#### Storage Operations

**Method**: `storePageData(pageId, chunks, embeddings)`
- Stores chunks as JSON in OPFS `/chunks/{pageId}/chunks.json`
- Stores embeddings as binary in OPFS `/vectors/{pageId}/vectors.bin`

**Method**: `getPageChunks(pageId)`
- Retrieves chunks JSON from OPFS

**Method**: `loadEmbeddingsFromOPFS(pageId)`
- Loads individual embedding files from `/embeddings/` directory
- Files named: `{sanitizedPageId}_chunk_{i}.json`
- Converts JSON arrays back to Float32Array

**Method**: `getPageData(pageId)`
- Loads chunks + embeddings in parallel
- Returns object with both arrays

#### Configuration & Utilities

**Settings** (stored in Chrome Storage):
```javascript
{
  autoIndexing: true,
  chunkSize: 512,
  overlapSize: 50,
  defaultSearchLimit: 10,
  enableCaching: true,
  indexPrivatePages: true,
  storePageContent: true,
  enableDebugLogging: false,
  enableVisualization: false,
}
```

**Methods**:
- `loadPagesFromStorage()` - Loads page metadata
- `loadSettings()` - Loads user settings
- `saveSettings()` - Persists settings
- `getStats()` - Aggregates page count, chunks, storage
- `getModelStatus()` - Checks if model downloaded
- `downloadModel()` - Copies model files to OPFS
- `deletePage(pageId)` - Removes page from all storage
- `clearAllData()` - Wipes everything
- `exportData()` - Exports metadata for backup

#### Message Handler
**Method**: `handleServiceWorkerMessage(request, sender)`
- Routes incoming messages to appropriate handlers
- Supports: CAPTURE_PAGE, GET_STATS, GET_ALL_PAGES, SEMANTIC_SEARCH, DELETE_PAGE, etc.
- Returns true to send async response

---

### 3. offscreen.js - Processing & Embeddings Engine
**Purpose**: Safely processes MHTML, extracts text, chunks, and computes embeddings using ONNX

**Key Classes**: 
- `Logger` - Conditional debug logging
- `OffscreenController` - Main processing engine

#### ONNX Runtime Initialization

**Method**: `initONNXRuntime(vocab = null)`
- Dynamically imports ONNX Runtime from bundled files
- Loads model from OPFS: `/models/all-MiniLM-L6-v2/model.onnx`
- Creates ONNX session with WASM backend
- Configuration:
  - `executionProviders: ['wasm']`
  - `numThreads: 1` (avoid SharedArrayBuffer issues)
  - SIMD enabled for performance

**Method**: `loadTokenizer(vocab)`
- Creates WordPiece tokenizer from vocab array
- Special tokens: [CLS] (ID: 101), [SEP] (ID: 102), [UNK] (ID: 100)
- Implements greedy longest-match-first subword tokenization
- Returns tokenizer with `encoder.encode(text)` method

#### MHTML Processing

**Method**: `processMHTML(mhtmlData)`
- Handles multiple input formats (Uint8Array, ArrayBuffer, serialized)
- Decodes to UTF-8 text
- Calls `extractHTMLFromMHTML()` then `extractTextFromHTML()`
- Returns plain text content

**Method**: `extractHTMLFromMHTML(mhtmlText)`
- Primary: Uses `mhtml-to-html` npm package
- Fallback: Manual parsing (finds Content-Type: text/html section)

**Method**: `extractTextFromHTML(htmlContent)`
- Uses DOMParser to parse HTML
- Uses @mozilla/readability to extract main content
- Fallback: Regex-based tag stripping
- Returns plain text

#### Text Chunking Strategy

**Method**: `chunkText(text)`
- **Token-based chunking** (not character-based)
- Step 1: Tokenize full text with word-to-token mapping
- Step 2: Split tokenized content into overlapping chunks
  - Chunk size: 510 content tokens (+ [CLS] and [SEP] = 512 max)
  - Overlap: 50 tokens
  - Slide by: (510 - 50) = 460 tokens
- Step 3: Reconstruct human-readable text for each chunk

**Method**: `tokenizeWithMapping(text)`
- Tokenizes while tracking word→token ranges
- Returns: `{ tokens, words, wordToTokens }`
- Used for reconstructing text from token indices

**Method**: `reconstructTextFromTokens(chunkTokens, startTokenIndex, words, wordToTokens, totalContentTokens)`
- Maps token ranges back to original words
- Returns space-joined text segment

#### Embedding Computation

**Method**: `computeEmbeddings(chunks)` 
- Iterates through all chunks
- For each: calls `computeSingleEmbeddingFromTokens(chunk.tokens)`
- 30-second timeout per chunk
- Returns array of Float32Array embeddings

**Method**: `computeSingleEmbedding(text)`
- Text → tokenize → trim to 512 tokens → inference

**Method**: `computeSingleEmbeddingFromTokens(tokens)`
- Validates token array
- Calls `computeEmbeddingFromTokens(tokens, source)`

**Method**: `computeEmbeddingFromTokens(tokens, source)`
- **Core ONNX inference**:
  1. Convert tokens to BigInt64Array (required by ONNX)
  2. Create attention mask (all 1s)
  3. Create token type IDs (all 0s)
  4. Run inference: `session.run({ input_ids, attention_mask, token_type_ids })`
  5. Extract `last_hidden_state` (shape: [1, seq_len, 384])
  6. **Average pool** over sequence dimension
  7. Return 384-dim embedding

#### Embedding Storage

**Method**: `storeEmbeddingsInOPFS(pageId, embeddings)`
- Each embedding stored as separate JSON file in `/embeddings/`
- Filename: `{sanitizedPageId}_chunk_{i}.json`
- Content: `{ embedding: Float32Array→Array, chunkIndex, pageId, timestamp }`

**Method**: `loadEmbeddingsFromOPFS(pageId)`
- Iterates through chunk files until not found
- Converts JSON arrays back to Float32Array

#### Page Processing Pipeline

**Method**: `processPageInternal(mhtmlData, url, title, pageId)`
1. Extract text from MHTML
2. Chunk into 510-token segments
3. Compute embeddings for all chunks
4. Validate chunk-embedding count match
5. Return result: `{ pageId, url, title, chunks, embeddings, timestamp, dimensions }`

#### Message Handler

**Method**: `handleServiceWorkerMessage(message, sendResponse)`
- Handles: PROCESS_PAGE, COMPUTE_QUERY_EMBEDDING, INIT_WITH_VOCAB
- Async processing with response callback

**Message Types**:
```javascript
PROCESS_PAGE
  ← { mhtmlData, url, title, pageId }
  → { chunks, embeddings (null), embeddingsStored: true }

COMPUTE_QUERY_EMBEDDING
  ← { query }
  → { embedding: Float32Array }

INIT_WITH_VOCAB
  ← { vocab: string[], settings? }
  → { success: true }
```

---

### 4. popup.js - Quick Stats & Navigation
**Purpose**: Shows quick statistics and navigation to features

**Key Class**: `PopupController`

**Main Methods**:
- `init()` - Load stats and recent pages
- `loadStats()` - Sends GET_STATS message
- `loadRecentPages(limit=5)` - Sends GET_RECENT_PAGES
- `openSidePanel(view, params)` - Navigates to side panel
- `updateUI()` - Updates DOM with current data

**Displays**:
- Total pages indexed
- Total chunks stored
- Storage usage
- Last 5 indexed pages with titles & timestamps

---

### 5. sidepanel.js - Full UI with Search
**Purpose**: Main interface for browsing pages and searching

**Key Class**: `SidePanelController`

**Views**: pages, search, settings

**Key Methods**:

**Pages View**:
- `renderPagesList()` - Displays pages with pagination
- `filterPages(query)` - Client-side filtering by title/URL
- `sortPages(sortBy)` - Sort by date or title
- `showPageDetail(pageId)` - Modal with chunks & metadata
- `deletePage(pageId)` - Sends DELETE_PAGE message

**Search View**:
- `performSearch()` - Main search execution
  1. Gets query from input
  2. Sends SEMANTIC_SEARCH message with limit
  3. Receives array of results sorted by similarity
  4. Renders results with page title, chunk text, similarity score
- `clearSearchResults()` - Resets search state

**Settings View**:
- `renderSettings()` - Shows current configuration
- `clearAllData()` - Sends CLEAR_ALL_DATA message
- `exportData()` - Sends EXPORT_DATA message

**Utilities**:
- `sendMessage(message)` - Wrapper for background communication
- `goToPage(pageNumber)` - Pagination

---

## Data Structures

### Page Metadata (Chrome Storage)
```javascript
{
  offlineIndexer: {
    pages: {
      [pageId]: {
        url: string,
        title: string,
        timestamp: number,
        chunkCount: number,
        dimensions: number  // 384 for all-MiniLM-L6-v2
      }
    },
    urlIndex: {
      [url]: pageId  // Quick lookup
    }
  }
}
```

### Chunk Object (OPFS)
```javascript
{
  id: "chunk_0",
  tokens: number[],        // With [CLS] and [SEP]
  tokenCount: number,
  text: string,            // Reconstructed text
  startTokenIndex: number,
  endTokenIndex: number
}
```

### Search Result Object
```javascript
{
  pageId: string,
  pageTitle: string,
  pageUrl: string,
  chunkId: string,
  chunkText: string,
  similarity: number,      // 0.0 - 1.0
  timestamp: number
}
```

---

## Storage Architecture

### Chrome Storage (Small metadata only)
- Path: `chrome.storage.local`
- Key: `offlineIndexer` → { pages, urlIndex }
- Key: `offlineIndexerSettings` → settings object

### OPFS Directory Structure
```
/models/
  /all-MiniLM-L6-v2/
    - model.onnx
    - vocab.txt
    - tokenizer.json
    - config.json
    - tokenizer_config.json

/chunks/
  /{pageId}/
    - chunks.json

/vectors/
  /{pageId}/
    - vectors.bin

/embeddings/
  - {sanitizedPageId}_chunk_0.json
  - {sanitizedPageId}_chunk_1.json
  - ...
```

---

## Integration Testing Key Points

### 1. Page Indexing Flow
Test the full pipeline:
- Mock chrome.pageCapture.saveAsMHTML()
- Test content.js → background.js message passing
- Test MHTML processing in offscreen
- Verify chunks created with correct token counts
- Verify embeddings generated and stored

### 2. Search Functionality
- Mock query text
- Test query embedding computation
- Test cosine similarity calculation
- Test result ranking and limiting
- Test with various query types (single word, phrase, etc.)

### 3. Embeddings
- Test ONNX initialization
- Test tokenization with WordPiece
- Test embedding computation output shape (should be [1, 384])
- Test average pooling
- Test embedding storage/retrieval

### 4. Chunking Strategy
- Test text with various token counts
- Verify 510-token chunks with 50-token overlap
- Test chunk text reconstruction from token indices
- Test edge cases (very short text, very long text)

### 5. Storage Operations
- Test Chrome Storage write/read
- Test OPFS directory creation
- Test binary vector storage format
- Test embedding JSON serialization/deserialization

### 6. Error Handling
- Test with invalid MHTML
- Test with pages that extract no text
- Test with network timeouts
- Test with ONNX model not available
- Test edge cases in tokenization

---

## Key Dependencies

**npm packages**:
- `mhtml-to-html` - MHTML to HTML conversion
- `@mozilla/readability` - Extract article content
- `onnxruntime-web` - Machine learning inference

**Chrome APIs**:
- `chrome.pageCapture.saveAsMHTML()` - Capture pages
- `chrome.storage.local` - Metadata storage
- `navigator.storage.getDirectory()` - OPFS access
- `chrome.runtime.sendMessage()` - Inter-component communication
- `chrome.offscreen` - Offscreen document management

---

## Model Information

**Model**: all-MiniLM-L6-v2
- **Type**: ONNX sentence-transformers
- **Input**: BERT-style tokens (max 512)
- **Output**: 384-dimensional embeddings
- **Size**: ~25 MB
- **Tokenizer**: WordPiece (BERT vocab)

**Embedding Computation**:
- Input tokenization with special tokens: [CLS]...content...[SEP]
- Inference through ONNX session (WASM backend)
- Output: last_hidden_state [1, seq_len, 384]
- Average pooling over sequence dimension
- Final output: [384] normalized vector

