# Quick Reference - Key Files & Functions for Integration Tests

## Absolute File Paths

```
Indexing:
  /home/user/page-indexer/content.js          (Page capture trigger)
  /home/user/page-indexer/background.js       (Main orchestration)
  /home/user/page-indexer/offscreen.js        (Processing + embeddings)

UI & Search:
  /home/user/page-indexer/popup.js            (Quick stats)
  /home/user/page-indexer/sidepanel.js        (Main search UI)

Config:
  /home/user/page-indexer/manifest.json       (Chrome extension config)
```

---

## Data Flow at a Glance

### 1. INDEXING (HTML → Embeddings)
```
HTML Page Load
  ↓ content.js::ContentScript.handlePageLoad()
  ↓ Sends: chrome.runtime.sendMessage(CAPTURE_PAGE)
  ↓ background.js::BackgroundService.captureAndProcess()
  ├─→ capturePage(tabId) - chrome.pageCapture.saveAsMHTML()
  ├─→ processPageWithWorker() - Sends to offscreen
  └─→ storePageData() - Saves to OPFS
  ↓ offscreen.js::OffscreenController.processPageInternal()
  ├─→ processMHTML() - Extract HTML
  ├─→ extractTextFromHTML() - Extract text
  ├─→ chunkText() - 510-token chunks with 50 overlap
  ├─→ computeEmbeddings() - ONNX inference
  └─→ storeEmbeddingsInOPFS() - Save to OPFS
  ↓ Storage Complete
```

### 2. SEARCH (Query → Results)
```
User Query
  ↓ sidepanel.js::SidePanelController.performSearch()
  ↓ Sends: chrome.runtime.sendMessage(SEMANTIC_SEARCH)
  ↓ background.js::BackgroundService.searchWithWorker()
  ├─→ sendToOffscreen(COMPUTE_QUERY_EMBEDDING)
  ├─→ offscreen.js::computeSingleEmbedding(query)
  ├─→ Load all page embeddings from OPFS
  ├─→ cosineSimilarity() for each chunk
  ├─→ Sort by similarity score
  └─→ Return top K results
  ↓ Render results in sidepanel
```

---

## Critical Functions to Test

### INDEXING PIPELINE

**content.js**
- `ContentScript.init()` - Starts on page load
- `ContentScript.handlePageLoad()` - Triggers indexing after 1s delay
- `ContentScript.sendMessage(message)` - Sends CAPTURE_PAGE to background

**background.js**
- `BackgroundService.captureAndProcess(tabId, url, title)` - Main entry point
- `BackgroundService.capturePage(tabId)` - Gets MHTML blob
- `BackgroundService.processPageWithWorker(mhtmlBlob, url, title, pageId)` - Sends to offscreen
- `BackgroundService.storePageData(pageId, chunks, embeddings)` - Saves to OPFS
- `BackgroundService.generatePageId(url)` - Hash-based ID generation
- `BackgroundService.savePageToStorage(pageData)` - Saves metadata

**offscreen.js**
- `OffscreenController.initONNXRuntime(vocab)` - Initialize ONNX session
- `OffscreenController.loadTokenizer(vocab)` - Load WordPiece tokenizer
- `OffscreenController.processMHTML(mhtmlData)` - MHTML → text
- `OffscreenController.extractHTMLFromMHTML(mhtmlText)` - MHTML → HTML
- `OffscreenController.extractTextFromHTML(htmlContent)` - HTML → text
- `OffscreenController.chunkText(text)` - Create 510-token chunks
- `OffscreenController.tokenizeWithMapping(text)` - Token-based chunking
- `OffscreenController.reconstructTextFromTokens(...)` - Restore text from tokens
- `OffscreenController.computeEmbeddings(chunks)` - Batch embedding
- `OffscreenController.computeSingleEmbeddingFromTokens(tokens)` - Single embedding
- `OffscreenController.computeEmbeddingFromTokens(tokens, source)` - ONNX inference
- `OffscreenController.storeEmbeddingsInOPFS(pageId, embeddings)` - Save embeddings

### SEARCH PIPELINE

**background.js**
- `BackgroundService.semanticSearch(query, limit)` - Public search API
- `BackgroundService.searchWithWorker(query, limit)` - Core search algorithm
- `BackgroundService.cosineSimilarity(a, b)` - Similarity calculation
- `BackgroundService.loadEmbeddingsFromOPFS(pageId)` - Load embeddings
- `BackgroundService.getPageData(pageId)` - Load chunks + embeddings

**offscreen.js**
- `OffscreenController.computeSingleEmbedding(text)` - Query embedding

**sidepanel.js**
- `SidePanelController.performSearch()` - Trigger search from UI

---

## Message Types & Payloads

### Indexing Messages
```javascript
// content.js → background.js
CAPTURE_PAGE {
  type: 'CAPTURE_PAGE',
  data: { url: string, title: string }
}

// background.js → offscreen.js
PROCESS_PAGE {
  type: 'PROCESS_PAGE',
  data: {
    mhtmlData: Uint8Array,
    url: string,
    title: string,
    pageId: string
  }
}
Response {
  success: true,
  data: {
    pageId: string,
    url: string,
    title: string,
    chunks: Array<ChunkObject>,
    embeddings: null,
    embeddingsStored: true,
    timestamp: number,
    dimensions: number
  }
}
```

### Search Messages
```javascript
// sidepanel.js → background.js
SEMANTIC_SEARCH {
  type: 'SEMANTIC_SEARCH',
  data: { query: string, limit: number }
}

// background.js → offscreen.js
COMPUTE_QUERY_EMBEDDING {
  type: 'COMPUTE_QUERY_EMBEDDING',
  data: { query: string }
}
Response {
  success: true,
  data: {
    embedding: Float32Array [384]
  }
}

// background.js → UI
SEMANTIC_SEARCH Response {
  success: true,
  data: [
    {
      pageId: string,
      pageTitle: string,
      pageUrl: string,
      chunkId: string,
      chunkText: string,
      similarity: number (0.0-1.0),
      timestamp: number
    },
    ...
  ]
}
```

---

## Storage Locations

### Chrome Storage
```
chrome.storage.local {
  offlineIndexer: {
    pages: {
      [pageId]: {
        url: string,
        title: string,
        timestamp: number,
        chunkCount: number,
        dimensions: number
      }
    },
    urlIndex: {
      [url]: pageId
    }
  },
  offlineIndexerSettings: {
    autoIndexing: boolean,
    chunkSize: number,
    overlapSize: number,
    defaultSearchLimit: number,
    enableCaching: boolean,
    enableDebugLogging: boolean,
    ...
  }
}
```

### OPFS (Origin Private File System)
```
/models/all-MiniLM-L6-v2/
  - model.onnx         (25 MB)
  - vocab.txt
  - tokenizer.json
  - config.json
  - tokenizer_config.json

/chunks/{pageId}/
  - chunks.json        (Array of chunk objects)

/vectors/{pageId}/
  - vectors.bin        (Binary: [vectorCount][vectorSize][data...])

/embeddings/
  - {pageId}_chunk_0.json   ({"embedding": [384]})
  - {pageId}_chunk_1.json
  - ...
```

---

## Token Constants & Behavior

```javascript
// In OffscreenController
MAX_SEQUENCE_LENGTH = 512          // BERT max sequence length
MAX_CONTENT_TOKENS = 510           // Reserve 2 for [CLS] and [SEP]
OVERLAP_TOKENS = 50                // Overlap between chunks
SLIDE_BY = 460                     // MAX_CONTENT_TOKENS - OVERLAP_TOKENS

// Special Token IDs (BERT vocab)
[CLS] = 101
[SEP] = 102
[UNK] = 100

// Chunking behavior
Chunk 0: tokens[0:510]   + [CLS] + [SEP]
Chunk 1: tokens[460:970] + [CLS] + [SEP]
Chunk 2: tokens[920:...] + [CLS] + [SEP]
```

---

## Embedding Details

```javascript
// Model: all-MiniLM-L6-v2
INPUT:
  - input_ids: int64 tensor [1, seq_len]
  - attention_mask: int64 tensor [1, seq_len] (all 1s)
  - token_type_ids: int64 tensor [1, seq_len] (all 0s)

ONNX INFERENCE:
  session.run({
    input_ids: inputIdsTensor,
    attention_mask: attentionMaskTensor,
    token_type_ids: tokenTypeIdsTensor
  })

OUTPUT:
  - last_hidden_state: float32 tensor [1, seq_len, 384]

POOLING:
  - Average pool over seq_len dimension
  - Result: Float32Array [384]

COSINE SIMILARITY:
  sim = (a · b) / (||a|| * ||b||)
  Range: [0.0, 1.0]
```

---

## Testing Checklist

### Unit Tests
- [ ] Content script page load detection
- [ ] MHTML blob handling
- [ ] Text extraction from HTML
- [ ] WordPiece tokenization
- [ ] Token-based chunking (510 tokens + 50 overlap)
- [ ] ONNX embedding computation
- [ ] Cosine similarity calculation
- [ ] JSON serialization/deserialization
- [ ] Binary vector format encoding/decoding

### Integration Tests
- [ ] Full indexing pipeline (page → embeddings)
- [ ] Multiple pages indexing
- [ ] Duplicate page detection (skip re-indexing)
- [ ] Search with various queries
- [ ] Result ranking by similarity
- [ ] Result limiting (top K)
- [ ] Storage persistence and retrieval
- [ ] OPFS directory structure
- [ ] Chrome storage metadata

### Edge Cases
- [ ] Very long text (>10000 tokens)
- [ ] Very short text (<10 tokens)
- [ ] Empty page content
- [ ] Query longer than 512 tokens
- [ ] Zero-magnitude embeddings
- [ ] Non-existent page ID in search
- [ ] Concurrent indexing operations
- [ ] Storage quota exceeded
- [ ] ONNX timeout (30 seconds per chunk)

---

## Key Dependencies

```json
{
  "mhtml-to-html": "^2.0.0",
  "onnxruntime-web": "^1.17.0",
  "@mozilla/readability": "^0.6.0"
}
```

---

## Browser APIs Used

- `chrome.pageCapture.saveAsMHTML(tabId, callback)`
- `chrome.storage.local.get(keys, callback)`
- `chrome.storage.local.set(data, callback)`
- `chrome.runtime.sendMessage(message, callback)`
- `chrome.runtime.onMessage.addListener(listener)`
- `chrome.offscreen.createDocument(options)`
- `chrome.offscreen.closeDocument()`
- `chrome.offscreen.hasDocument()`
- `navigator.storage.getDirectory()`
- `FileSystemDirectoryHandle.getFileHandle(name, options)`
- `FileSystemFileHandle.createWritable()`
- `FileSystemFile.text()`

---

## Common Gotchas

1. **OPFS requires HTTPS/extension context** - Tests need proper sandboxing
2. **ONNX Runtime WASM backend** - Requires proper WASM paths
3. **BigInt64Array for tokens** - ONNX requires int64, not standard int32
4. **Float32Array serialization** - JSON requires conversion to Array
5. **Average pooling formula** - Sum each dim across seq_len, then divide
6. **Chunk overlap calculation** - Chunks overlap at token boundaries, not character
7. **PageId sanitization** - Must remove special chars for filenames
8. **Message size limits** - Embeddings stored separately in OPFS to avoid limits
9. **Token type IDs** - All zeros for single-sequence input (no segment IDs)
10. **Model loading path** - Must use object URL from OPFS file handle

