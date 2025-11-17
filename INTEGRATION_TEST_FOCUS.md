# Integration Test Focus Guide

## Key Files & Functions by Responsibility

### INDEXING FLOW (HTML → Embeddings)

#### Step 1: Page Capture (content.js)
**File**: `/home/user/page-indexer/content.js`
**Class**: `ContentScript`
**Test Functions**:
- `init()` - Initialization on DOMContentLoaded
- `isValidPage()` - HTTP/HTTPS validation
- `handlePageLoad()` - Triggers capture after 1 second delay
- `sendMessage(message)` - Message passing to background

**Integration Point**: 
- Mock: `chrome.runtime.sendMessage()` to capture CAPTURE_PAGE messages
- Verify: Message contains correct URL and title

---

#### Step 2: Orchestration & MHTML Capture (background.js)
**File**: `/home/user/page-indexer/background.js`
**Class**: `BackgroundService`
**Test Functions**:
- `captureAndProcess(tabId, url, title)` - Main entry point
  - Validate: Page not already indexed
  - Call: `capturePage(tabId)`
  - Call: `processPageWithWorker(mhtmlBlob, url, title, pageId)`
  - Call: `storePageData(pageId, chunks, embeddings)`

- `capturePage(tabId)` - MHTML capture
  - Mock: `chrome.pageCapture.saveAsMHTML()`
  - Return: Blob with MHTML content

- `processPageWithWorker(mhtmlBlob, url, title, pageId)` - Send to offscreen
  - Convert: Blob → Uint8Array
  - Call: `sendToOffscreen(PROCESS_PAGE)`
  - Return: { chunks, embeddings }

- `storePageData(pageId, chunks, embeddings)` - Persist to OPFS
  - Write: `/chunks/{pageId}/chunks.json`
  - Write: `/vectors/{pageId}/vectors.bin` (binary format)
  - OR Write: `/embeddings/{pageId}_chunk_{i}.json`

- `generatePageId(url)` - Create unique page ID
  - Hash-based on URL + timestamp

**Critical Test Cases**:
- Already indexed page (skip processing)
- First-time indexing (full flow)
- MHTML conversion to Uint8Array
- Metadata storage in Chrome Storage
- Binary vector storage format

---

#### Step 3: MHTML Processing → Text Extraction (offscreen.js)
**File**: `/home/user/page-indexer/offscreen.js`
**Class**: `OffscreenController`
**Test Functions**:
- `processMHTML(mhtmlData)` - MHTML to text
  - Call: `extractHTMLFromMHTML()`
  - Call: `extractTextFromHTML()`
  - Return: Plain text string

- `extractHTMLFromMHTML(mhtmlText)` - MHTML to HTML
  - Primary: `mhtml-to-html` npm package
  - Fallback: Manual parse (Content-Type: text/html)

- `extractTextFromHTML(htmlContent)` - HTML to text
  - DOMParser + Readability
  - Fallback: Regex strip <tags>

**Test Cases**:
- MHTML with valid HTML section
- Missing HTML section (fallback parsing)
- HTML with script/style tags
- Various character encodings
- Empty content extraction

---

#### Step 4: Text Tokenization & Chunking (offscreen.js)
**File**: `/home/user/page-indexer/offscreen.js`
**Class**: `OffscreenController`
**Test Functions**:
- `chunkText(text)` - Main chunking function
  - Call: `tokenizeWithMapping(text)`
  - Split: Into 510-token segments with 50-token overlap
  - Call: `reconstructTextFromTokens()` for each chunk
  - Return: Array of chunk objects

- `tokenizeWithMapping(text)` - Token-based chunking
  - Call: `tokenizer.encoder.encode(text)`
  - Track: word → token index ranges
  - Return: { tokens, words, wordToTokens }

- `reconstructTextFromTokens(chunkTokens, startTokenIndex, words, wordToTokens, totalContentTokens)`
  - Map: Token ranges back to original words
  - Return: Reconstructed text string

**Token Constants**:
- MAX_SEQUENCE_LENGTH = 512
- MAX_CONTENT_TOKENS = 510 (reserve 2 for [CLS] and [SEP])
- OVERLAP_TOKENS = 50

**Test Cases**:
- Text with exactly 510 tokens (single chunk)
- Text with 1000+ tokens (multiple overlapping chunks)
- Very short text (< 10 tokens)
- Verify [CLS] and [SEP] tokens present in final chunks
- Verify 50-token overlap between consecutive chunks
- Text reconstruction accuracy

---

#### Step 5: Embedding Generation (offscreen.js)
**File**: `/home/user/page-indexer/offscreen.js`
**Class**: `OffscreenController`
**Test Functions**:
- `initONNXRuntime(vocab)` - Initialize ONNX session
  - Import: ONNX Runtime from bundled files
  - Load: Model from OPFS `/models/all-MiniLM-L6-v2/model.onnx`
  - Create: ONNX session with WASM backend
  - Configure: numThreads=1, SIMD enabled

- `loadTokenizer(vocab)` - Load WordPiece tokenizer
  - Create: vocab map for O(1) lookup
  - Implement: Greedy longest-match-first subword tokenization
  - Special tokens: [CLS]=101, [SEP]=102, [UNK]=100

- `computeEmbeddings(chunks)` - Batch embedding
  - For each chunk: `computeSingleEmbeddingFromTokens(chunk.tokens)`
  - 30-second timeout per chunk
  - Return: Array of Float32Array

- `computeSingleEmbeddingFromTokens(tokens)` - Single embedding
  - Validate: Token array non-empty
  - Call: `computeEmbeddingFromTokens(tokens, source)`

- `computeEmbeddingFromTokens(tokens, source)` - ONNX inference
  1. Convert tokens to BigInt64Array
  2. Create attention_mask (all 1s)
  3. Create token_type_ids (all 0s)
  4. Run: `session.run({ input_ids, attention_mask, token_type_ids })`
  5. Extract: `results.last_hidden_state` (shape: [1, seq_len, 384])
  6. Average pool: Sum each dimension across sequence, divide by seq_len
  7. Return: Float32Array [384]

**Test Cases**:
- ONNX session initialization
- Model loading from OPFS
- Tokenizer with edge cases (unknown tokens, subwords)
- Embedding output shape verification (should be 384-dim)
- Average pooling correctness
- Batch embedding for multiple chunks
- Timeout handling (30 seconds per chunk)

---

### SEARCH FLOW (Query → Results)

#### Main Search Entry (background.js)
**File**: `/home/user/page-indexer/background.js`
**Class**: `BackgroundService`
**Test Functions**:
- `semanticSearch(query, limit=10)` - Public search API
  - Call: `searchWithWorker(query, limit)`

- `searchWithWorker(query, limit=10)` - Core search algorithm
  1. Call: `sendToOffscreen(COMPUTE_QUERY_EMBEDDING)`
  2. Get: queryEmbedding as Float32Array [384]
  3. Loop: All pages in `this.pages`
  4. Loop: All chunks for each page
  5. Call: `cosineSimilarity(queryEmbedding, chunkEmbedding)`
  6. Push: Result with similarity score
  7. Sort: By similarity descending
  8. Return: Top K results

- `cosineSimilarity(a, b)` - Similarity metric
  - Calculate: dotProduct / (magnitude_a * magnitude_b)
  - Handle: Zero-magnitude vectors
  - Return: 0.0 - 1.0 score

**Test Cases**:
- Single word query
- Multi-word phrase
- Query embedding computation
- Cosine similarity calculation (test vectors)
- Result ranking by similarity
- Limit parameter (top K)
- Empty results handling
- Zero-vector edge cases

---

#### Query Embedding (offscreen.js)
**File**: `/home/user/page-indexer/offscreen.js`
**Class**: `OffscreenController`
**Test Functions**:
- `computeSingleEmbedding(text)` - Text to embedding
  - Call: `tokenize(text)`
  - Trim: To MAX_SEQUENCE_LENGTH (512)
  - Call: `computeEmbeddingFromTokens(tokens, 'text input')`
  - Return: Float32Array [384]

**Test Cases**:
- Query shorter than 512 tokens
- Query longer than 512 tokens (truncation)
- Empty query handling
- Special characters in query
- Multiple space handling

---

### STORAGE LAYER

#### OPFS Operations (background.js)
**File**: `/home/user/page-indexer/background.js`
**Class**: `BackgroundService`
**Test Functions**:
- `storePageData(pageId, chunks, embeddings)` - Write to OPFS
  - Write chunks JSON to `/chunks/{pageId}/chunks.json`
  - Write vectors binary to `/vectors/{pageId}/vectors.bin`
    - Header: 8 bytes (vectorCount + vectorSize)
    - Data: vectorCount * vectorSize * 4 bytes (Float32)

- `getPageChunks(pageId)` - Read chunks from OPFS
  - Read: `/chunks/{pageId}/chunks.json`
  - Parse: JSON
  - Return: Array of chunk objects

- `loadEmbeddingsFromOPFS(pageId)` - Read embeddings from OPFS
  - Loop: `/embeddings/{sanitizedPageId}_chunk_{i}.json`
  - Parse: JSON arrays
  - Convert: To Float32Array
  - Return: Array of embeddings

- `getPageVectors(pageId, dimensions)` - Read binary vectors
  - Read: `/vectors/{pageId}/vectors.bin`
  - Parse: Binary format (header + data)
  - Return: Array of Float32Array

**Test Cases**:
- Directory creation in OPFS
- JSON serialization/deserialization
- Binary vector format (header parsing)
- Float32Array round-trip
- Large embedding arrays
- Non-existent file handling
- Sanitization of pageId in filenames

---

#### Chrome Storage Operations (background.js)
**File**: `/home/user/page-indexer/background.js`
**Class**: `BackgroundService`
**Test Functions**:
- `loadPagesFromStorage()` - Load metadata
  - Get: `chrome.storage.local` key `offlineIndexer`
  - Parse: `data.pages` Map

- `savePageToStorage(pageData)` - Save metadata
  - Get: Current data
  - Update: `pages[pageId]` with metadata
  - Update: `urlIndex[url]` for quick lookup
  - Set: `chrome.storage.local`

- `deletePage(pageId)` - Remove page
  - Delete: From `this.pages` Map
  - Delete: From Chrome Storage
  - Delete: From OPFS

- `clearAllData()` - Wipe everything
  - Clear: `this.pages` Map
  - Clear: `chrome.storage.local`
  - Note: OPFS cleanup separate

**Test Cases**:
- Store and retrieve page metadata
- URL index quick lookup
- Delete page from all storages
- Clear all data
- Concurrent storage operations
- Storage quota handling

---

### UI & MESSAGING

#### Search UI (sidepanel.js)
**File**: `/home/user/page-indexer/sidepanel.js`
**Class**: `SidePanelController`
**Test Functions**:
- `performSearch()` - Main search trigger
  1. Get: query from input element
  2. Get: limit from input element
  3. Validate: Query not empty
  4. Call: `sendMessage(SEMANTIC_SEARCH, { query, limit })`
  5. Render: Results

**Test Cases**:
- Empty query validation
- Message passing to background
- Result rendering
- Multiple searches in sequence

---

#### Popup UI (popup.js)
**File**: `/home/user/page-indexer/popup.js`
**Class**: `PopupController`
**Test Functions**:
- `loadStats()` - Load statistics
  - Send: GET_STATS message
  - Update: `this.stats`

- `loadRecentPages(limit=5)` - Load recent pages
  - Send: GET_RECENT_PAGES message
  - Update: `this.recentPages`

**Test Cases**:
- Stats accuracy
- Recent pages ordering (by timestamp)
- UI update after load

---

## Key Data Transformations to Test

### 1. MHTML → HTML → Text
```
MHTML binary
  ↓ (decode UTF-8)
MHTML text (MIME boundaries)
  ↓ (parse Content-Type: text/html)
HTML text
  ↓ (DOMParser + Readability)
Plain text
```

### 2. Text → Tokens → Chunks
```
Text string
  ↓ (WordPiece tokenization)
Token IDs [101, ...tokens..., 102]
  ↓ (split into overlapping segments)
Multiple token arrays (510 tokens each, 50 overlap)
  ↓ (reconstruct text from word ranges)
Chunk objects with text + tokens
```

### 3. Tokens → Embeddings
```
Token IDs [101, ...tokens..., 102]
  ↓ (ONNX inference)
Last hidden state [1, seq_len, 384]
  ↓ (average pool over sequence)
Embedding vector [384]
```

### 4. Query → Embedding → Similarities
```
Query text
  ↓ (tokenize)
Query tokens
  ↓ (ONNX inference)
Query embedding [384]
  ↓ (compare to all chunk embeddings)
Similarity scores
  ↓ (sort, limit)
Top K results
```

---

## Mock/Stub Requirements

### For Unit Testing:
- `chrome.pageCapture.saveAsMHTML(tabId, callback)` → returns mocked MHTML blob
- `chrome.storage.local.get(keys)` → returns mocked storage
- `chrome.storage.local.set(data)` → mocks write
- `navigator.storage.getDirectory()` → mocks OPFS root
- `chrome.runtime.sendMessage(message, callback)` → mocks message passing
- ONNX Runtime session → mock inference or use WASM backend

### For Integration Testing:
- Real ONNX Runtime with actual model
- Real OPFS (or polyfill)
- Real Chrome Storage (or simulator)
- Real text extraction (Readability)
- Sample MHTML test files

---

## Test Fixtures to Create

### Sample MHTML
```
Create MHTML test file with:
- Valid MIME headers
- Content-Type: text/html section
- Sample HTML content
- Expected text after extraction
```

### Sample HTML
```
Create HTML test files with:
- Complex structure (nested tags)
- Script/style tags to strip
- Article content for Readability
- Expected text output
```

### Sample Queries
```
Single word: "machine"
Phrase: "machine learning embeddings"
Specific term: "tokenization"
Semantic variation: "neural networks" (should match embeddings)
```

### Sample Embeddings for Testing Cosine Similarity
```
Create normalized test vectors [384-dim]
- Identical vectors → similarity = 1.0
- Perpendicular vectors → similarity ≈ 0.0
- Similar vectors → similarity > 0.8
```

