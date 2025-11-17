/**
 * Background Service Worker
 * Orchestrates page capture and embedding processing
 */

class BackgroundService {
  constructor() {
    this.initialized = false;
    this.pages = new Map(); // In-memory cache of pages
    this.offscreenDocument = null;
    this.offscreenReady = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.settings = {
      autoIndexing: true,
      chunkSize: 512,
      overlapSize: 50,
      defaultSearchLimit: 10,
      enableCaching: true,
      indexPrivatePages: true,
      storePageContent: true,
      enableDebugLogging: false,
      enableVisualization: false,
      searchMode: 'hybrid', // 'dense', 'bm25', or 'hybrid'
    };

    // BM25 inverted index data structures
    this.invertedIndex = new Map(); // term -> [{pageId, chunkId, termFreq, positions}]
    this.documentFrequency = new Map(); // term -> number of documents containing term
    this.documentLengths = new Map(); // (pageId, chunkId) -> document length in tokens
    this.averageDocumentLength = 0;
    this.totalDocuments = 0;

    // BM25 parameters
    this.bm25_k1 = 1.2;
    this.bm25_b = 0.75;
  }

  /**
   * Initialize the background service
   */
  async init() {
    if (this.initialized) return;

    try {
      // Load existing pages from storage
      await this.loadPagesFromStorage();

      // Load settings
      await this.loadSettings();

      // Load BM25 index from OPFS
      await this.loadBM25Index();

      // No mock data - extension works only with real indexed pages

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize background service:', error);
      throw error;
    }
  }

  /**
   * Ensure offscreen document is created
   */
  async ensureOffscreenDocument() {
    if (this.offscreenDocument) {
      return;
    }

    try {
      // Check if offscreen document already exists
      const existingContexts = await chrome.offscreen.hasDocument();
      if (existingContexts) {
        this.offscreenDocument = true;
        return;
      }

      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Use Web Workers for MHTML processing and embedding computation',
      });

      this.offscreenDocument = true;
    } catch (error) {
      console.error('Failed to create offscreen document:', error);
      throw error;
    }
  }

  /**
   * Close offscreen document
   */
  async closeOffscreenDocument() {
    if (!this.offscreenDocument) {
      return;
    }

    try {
      await chrome.offscreen.closeDocument();
      this.offscreenDocument = null;
    } catch (error) {
      console.error('Failed to close offscreen document:', error);
    }
  }

  /**
   * Ensure offscreen document is ready to receive messages
   */
  async ensureOffscreenReady() {
    await this.ensureOffscreenDocument();

    if (this.offscreenReady) {
      return;
    }

    return new Promise(async resolve => {
      const onReady = async msg => {
        if (msg?.type === 'offscreen:ready') {
          chrome.runtime.onMessage.removeListener(onReady);
          this.offscreenReady = true;

          // Load and send vocab to offscreen document
          try {
            const vocab = await this.loadVocab();
            if (vocab) {
              await this.sendVocabToOffscreen(vocab);
            }
          } catch (error) {
            console.error('Failed to send vocab to offscreen:', error);
          }

          resolve();
        }
      };
      chrome.runtime.onMessage.addListener(onReady);

      // Add timeout to prevent infinite waiting
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(onReady);
        this.offscreenReady = true; // Assume ready if timeout
        resolve();
      }, 5000); // 5 second timeout
    });
  }

  /**
   * Load vocab.txt from bundled files
   * @returns {Promise<string[]>} Vocabulary array
   */
  async loadVocab() {
    try {
      const vocabUrl = chrome.runtime.getURL('generated/models/all-MiniLM-L6-v2/vocab.txt');
      const response = await fetch(vocabUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch vocab: ${response.status}`);
      }

      const vocabText = await response.text();
      const vocab = vocabText.split('\n').filter(line => line.trim());

      console.log('Loaded vocab from bundle, size:', vocab.length);
      return vocab;
    } catch (error) {
      console.error('Failed to load vocab:', error);
      return null;
    }
  }

  /**
   * Send vocab to offscreen document
   * @param {string[]} vocab - Vocabulary array
   */
  async sendVocabToOffscreen(vocab) {
    try {
      await this.sendToOffscreen({
        type: 'INIT_WITH_VOCAB',
        data: { vocab },
      });
      console.log('Vocab sent to offscreen document');
    } catch (error) {
      console.error('Failed to send vocab to offscreen:', error);
      throw error;
    }
  }

  /**
   * Send message to offscreen document
   * @param {Object} message - Message to send
   * @returns {Promise<Object>} Response from offscreen document
   */
  async sendToOffscreen(message) {
    await this.ensureOffscreenReady();

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();

      // Store the response callback
      this.pendingRequests.set(requestId, { resolve, reject });

      // Send message to offscreen document with response callback
      chrome.runtime.sendMessage(
        {
          ...message,
          requestId: requestId,
        },
        response => {
          if (chrome.runtime.lastError) {
            console.error('Failed to send message to offscreen:', chrome.runtime.lastError);
            if (this.pendingRequests.has(requestId)) {
              this.pendingRequests.delete(requestId);
              reject(
                new Error(
                  'Failed to communicate with offscreen document: ' +
                    chrome.runtime.lastError.message
                )
              );
            }
          } else if (response) {
            // Handle the response from offscreen document
            if (this.pendingRequests.has(requestId)) {
              this.pendingRequests.delete(requestId);
              if (response.success) {
                resolve(response.data);
              } else {
                reject(new Error(response.error || 'Offscreen document returned error'));
              }
            }
          }
        }
      );

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 120000); // 2 minute timeout for embedding computation
    });
  }

  /**
   * Handle response from offscreen document
   * @param {Object} message - Response message
   */
  handleOffscreenResponse(message) {
    const { requestId, type, data } = message;

    if (this.pendingRequests.has(requestId)) {
      const { resolve, reject } = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);

      if (type === 'ERROR') {
        reject(new Error(data.error));
      } else {
        resolve(data);
      }
    }
  }

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  generateRequestId() {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  /**
   * Load pages from chrome.storage
   */
  async loadPagesFromStorage() {
    try {
      const result = await chrome.storage.local.get(['offlineIndexer']);
      const data = result.offlineIndexer;

      if (data && data.pages) {
        for (const [pageId, page] of Object.entries(data.pages)) {
          this.pages.set(pageId, page);
        }
      }
    } catch (error) {
      console.error('Failed to load pages from storage:', error);
    }
  }

  /**
   * Load settings from chrome.storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['offlineIndexerSettings']);
      if (result.offlineIndexerSettings) {
        this.settings = { ...this.settings, ...result.offlineIndexerSettings };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Save settings to chrome.storage
   */
  async saveSettings() {
    try {
      await chrome.storage.local.set({ offlineIndexerSettings: this.settings });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * Capture page as MHTML and process
   * @param {number} tabId - Tab ID to capture
   * @param {string} url - Page URL
   * @param {string} title - Page title
   */
  async captureAndProcess(tabId, url, title) {
    try {
      if (!this.initialized) {
        await this.init();
      }

      // Auto-download model if not available
      await this.ensureModelAvailable();

      // Check if page is already indexed
      const existingPage = Array.from(this.pages.values()).find(p => p.url === url);
      if (existingPage) {
        return;
      }

      // Capture page as MHTML
      const mhtmlBlob = await this.capturePage(tabId);
      if (!mhtmlBlob) {
        throw new Error('Failed to capture page');
      }

      // Process the MHTML using the embedding worker
      const pageId = this.generatePageId(url);
      const result = await this.processPageWithWorker(mhtmlBlob, url, title, pageId);

      // Store the processed page data
      const pageData = {
        pageId,
        url,
        title,
        timestamp: Date.now(),
        chunkCount: result.chunks.length,
        dimensions: result.dimensions,
      };

      this.pages.set(pageId, pageData);
      await this.savePageToStorage(pageData);

      // Store chunks and embeddings in OPFS
      await this.storePageData(pageId, result.chunks, result.embeddings);
    } catch (error) {
      console.error('Failed to capture and process page:', error);
      console.error('Error details:', {
        url,
        title,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Process page using offscreen document and embedding worker
   * @param {Blob} mhtmlBlob - MHTML blob
   * @param {string} url - Page URL
   * @param {string} title - Page title
   * @param {string} pageId - Page ID
   * @returns {Promise<Object>} Processing result
   */
  async processPageWithWorker(mhtmlBlob, url, title, pageId) {
    try {
      // Convert Blob to Uint8Array for transmission
      const mhtmlArrayBuffer = await mhtmlBlob.arrayBuffer();
      const mhtmlData = new Uint8Array(mhtmlArrayBuffer);

      // Send to offscreen document for processing
      const result = await this.sendToOffscreen({
        type: 'PROCESS_PAGE',
        data: {
          mhtmlData: Array.from(mhtmlData), // Convert to serializable array
          url,
          title,
          pageId,
        },
      });

      if (result && result.chunks) {
        // If embeddings are stored separately in OPFS, load them
        if (result.embeddingsStored && !result.embeddings) {
          result.embeddings = await this.loadEmbeddingsFromOPFS(result.pageId);
        }

        return result;
      } else {
        throw new Error('Page processing failed - invalid result format');
      }
    } catch (error) {
      console.error('Failed to process page via worker:', error);
      throw error;
    }
  }

  /**
   * Load embeddings from OPFS
   * @param {string} pageId - Page ID
   * @returns {Float32Array[]} Array of embedding vectors
   */
  async loadEmbeddingsFromOPFS(pageId) {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const embeddingsDir = await opfsRoot.getDirectoryHandle('embeddings');

      const embeddings = [];
      let chunkIndex = 0;

      // Load embeddings for this page
      while (true) {
        try {
          // Sanitize pageId to ensure valid filename
          const sanitizedPageId = pageId ? pageId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'unknown';
          const fileName = `${sanitizedPageId}_chunk_${chunkIndex}.json`;
          const fileHandle = await embeddingsDir.getFileHandle(fileName);
          const file = await fileHandle.getFile();
          const text = await file.text();
          const data = JSON.parse(text);

          // Convert back to Float32Array
          // Log the raw data to debug

          let embeddingArray;
          if (Array.isArray(data.embedding)) {
            embeddingArray = data.embedding;
          } else if (typeof data.embedding === 'object' && data.embedding !== null) {
            // Convert object with numeric keys to array
            const keys = Object.keys(data.embedding).sort((a, b) => Number(a) - Number(b));
            embeddingArray = keys.map(key => data.embedding[key]);
          } else {
            console.error(
              `Invalid embedding data for chunk ${chunkIndex}, type: ${typeof data.embedding}`
            );
            break;
          }

          const embedding = new Float32Array(embeddingArray);
          embeddings.push(embedding);
          chunkIndex++;
        } catch (error) {
          // No more chunks for this page
          break;
        }
      }

      return embeddings;
    } catch (error) {
      console.error('Failed to load embeddings from OPFS:', error);
      return [];
    }
  }

  /**
   * Simple hash function for deterministic values
   * @param {string} str - String to hash
   * @returns {number} Hash value
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Count tokens in text using a simple approximation
   * @param {string} text - Text to count tokens for
   * @returns {number} Approximate token count
   */
  countTokens(text) {
    if (!text || text.length === 0) return 0;

    // More accurate token counting based on BERT-style tokenization
    // Split by whitespace and common punctuation
    const tokens = text
      .split(/(\s+|[.,!?;:()\[\]{}"'`~@#$%^&*+=|\\/<>-])/)
      .filter(token => token.trim().length > 0);

    let tokenCount = 0;

    for (const token of tokens) {
      if (token.trim()) {
        // Each word-like token counts as 1
        if (/^\w+$/.test(token)) {
          tokenCount += 1;
        } else if (/^\s+$/.test(token)) {
          // Whitespace doesn't count
          continue;
        } else {
          // Punctuation and special characters count as 1 each
          tokenCount += 1;
        }
      }
    }

    return Math.max(1, tokenCount); // At least 1 token
  }

  /**
   * Store page data in OPFS
   * @param {string} pageId - Page ID
   * @param {Array} chunks - Page chunks
   * @param {Array} embeddings - Page embeddings
   */
  async storePageData(pageId, chunks, embeddings) {
    try {
      const opfsRoot = await navigator.storage.getDirectory();

      // Store chunks
      const chunksDir = await opfsRoot.getDirectoryHandle('chunks', { create: true });
      const pageChunksDir = await chunksDir.getDirectoryHandle(pageId, { create: true });
      const chunksFile = await pageChunksDir.getFileHandle('chunks.json', { create: true });
      const chunksWritable = await chunksFile.createWritable();
      await chunksWritable.write(JSON.stringify(chunks));
      await chunksWritable.close();

      // Store embeddings as binary data
      const vectorsDir = await opfsRoot.getDirectoryHandle('vectors', { create: true });
      const pageVectorsDir = await vectorsDir.getDirectoryHandle(pageId, { create: true });
      const vectorsFile = await pageVectorsDir.getFileHandle('vectors.bin', { create: true });
      const vectorsWritable = await vectorsFile.createWritable();

      // Convert embeddings to binary format
      const vectorCount = embeddings.length;
      const vectorSize = embeddings[0]?.length || 384;
      const buffer = new ArrayBuffer(8 + vectorCount * vectorSize * 4); // 8 bytes header + data
      const dataView = new DataView(buffer);

      // Write header
      dataView.setUint32(0, vectorCount);
      dataView.setUint32(4, vectorSize);

      // Write vectors
      let offset = 8;
      for (const embedding of embeddings) {
        for (let i = 0; i < vectorSize; i++) {
          dataView.setFloat32(offset, embedding[i] || 0);
          offset += 4;
        }
      }

      await vectorsWritable.write(buffer);
      await vectorsWritable.close();

      // Build BM25 inverted index for each chunk
      for (const chunk of chunks) {
        this.buildBM25Index(pageId, chunk.id, chunk.text);
      }

      // Save BM25 index to OPFS
      await this.saveBM25Index();
    } catch (error) {
      console.error(`Failed to store page data for ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Capture page as MHTML using chrome.pageCapture
   * @param {number} tabId - Tab ID to capture
   * @returns {Promise<Blob>} MHTML blob
   */
  async capturePage(tabId) {
    return new Promise((resolve, reject) => {
      chrome.pageCapture.saveAsMHTML(
        {
          tabId: tabId,
        },
        mhtmlBlob => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (mhtmlBlob) {
            resolve(mhtmlBlob);
          } else {
            reject(new Error('No MHTML data received'));
          }
        }
      );
    });
  }

  /**
   * Generate unique page ID
   * @param {string} url - Page URL
   * @returns {string} Unique page ID
   */
  generatePageId(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `page_${Math.abs(hash)}_${Date.now()}`;
  }

  /**
   * Save page to chrome.storage
   * @param {Object} pageData - Page data to save
   */
  async savePageToStorage(pageData) {
    try {
      const result = await chrome.storage.local.get(['offlineIndexer']);
      const data = result.offlineIndexer || { pages: {}, urlIndex: {} };

      data.pages[pageData.pageId] = {
        url: pageData.url,
        title: pageData.title,
        timestamp: pageData.timestamp,
        chunkCount: pageData.chunkCount,
        dimensions: pageData.dimensions,
      };

      data.urlIndex[pageData.url] = pageData.pageId;

      await chrome.storage.local.set({ offlineIndexer: data });
    } catch (error) {
      console.error('Failed to save page to storage:', error);
      throw error;
    }
  }

  /**
   * Get all pages
   * @returns {Array} Array of all pages
   */
  async getAllPages() {
    return Array.from(this.pages.values());
  }

  /**
   * Get recent pages
   * @param {number} limit - Number of pages to return
   * @returns {Array} Array of recent pages
   */
  async getRecentPages(limit = 5) {
    const pages = Array.from(this.pages.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    return pages;
  }

  /**
   * Get page detail
   * @param {string} pageId - Page ID
   * @returns {Object} Page details
   */
  async getPageDetail(pageId) {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }
    return page;
  }

  /**
   * Get page chunks from OPFS storage
   * @param {string} pageId - Page ID
   * @returns {Array} Page chunks
   */
  async getPageChunks(pageId) {
    const page = this.pages.get(pageId);
    if (!page) return [];

    try {
      // Access OPFS directly (no dynamic imports in service worker)
      const opfsRoot = await navigator.storage.getDirectory();
      const chunksDir = await opfsRoot.getDirectoryHandle('chunks');
      const pageDir = await chunksDir.getDirectoryHandle(pageId);
      const chunksFile = await pageDir.getFileHandle('chunks.json');
      const file = await chunksFile.getFile();
      const chunksText = await file.text();
      const chunks = JSON.parse(chunksText);
      return chunks || [];
    } catch (error) {
      console.error(`Failed to load chunks for page ${pageId}:`, error);
      return [];
    }
  }

  /**
   * Get page vectors from OPFS storage
   * @param {string} pageId - Page ID
   * @param {number} dimensions - Vector dimensions
   * @returns {Array} Page vectors
   */
  async getPageVectors(pageId, dimensions) {
    const page = this.pages.get(pageId);
    if (!page) return [];

    try {
      // Access OPFS directly (no dynamic imports in service worker)
      const opfsRoot = await navigator.storage.getDirectory();
      const vectorsDir = await opfsRoot.getDirectoryHandle('vectors');
      const pageDir = await vectorsDir.getDirectoryHandle(pageId);
      const vectorsFile = await pageDir.getFileHandle('vectors.bin');
      const file = await vectorsFile.getFile();
      const arrayBuffer = await file.arrayBuffer();

      // Convert binary data back to Float32Array vectors
      const vectors = [];
      const dataView = new DataView(arrayBuffer);
      const vectorCount = dataView.getUint32(0);
      const vectorSize = dataView.getUint32(4);

      for (let i = 0; i < vectorCount; i++) {
        const vector = new Float32Array(vectorSize);
        const offset = 8 + i * vectorSize * 4;
        for (let j = 0; j < vectorSize; j++) {
          vector[j] = dataView.getFloat32(offset + j * 4);
        }
        vectors.push(vector);
      }

      return vectors;
    } catch (error) {
      console.error(`Failed to load vectors for page ${pageId}:`, error);
      return [];
    }
  }

  /**
   * Get complete page data including chunks and embeddings
   * @param {string} pageId - Page ID
   * @returns {Object} Page data with chunks and embeddings
   */
  async getPageData(pageId) {
    try {
      // Get chunks and embeddings in parallel
      const [chunks, embeddings] = await Promise.all([
        this.getPageChunks(pageId),
        this.loadEmbeddingsFromOPFS(pageId),
      ]);

      // Ensure chunks have token counts
      const chunksWithTokens = chunks.map(chunk => {
        if (!chunk.tokenCount) {
          chunk.tokenCount = this.countTokens(chunk.text || '');
        }
        return chunk;
      });

      return {
        chunks: chunksWithTokens,
        embeddings,
      };
    } catch (error) {
      console.error(`Failed to get page data for ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Perform semantic search using embeddings via search worker
   * Supports multiple search modes: dense, bm25, or hybrid
   * @param {string} query - Search query
   * @param {number} limit - Number of results
   * @param {string} mode - Search mode: 'dense', 'bm25', or 'hybrid' (optional, uses settings.searchMode if not provided)
   * @returns {Array} Search results
   */
  async semanticSearch(query, limit = 10, mode = null) {
    try {
      const searchMode = mode || this.settings.searchMode || 'hybrid';

      switch (searchMode) {
        case 'bm25':
          // BM25 keyword search only
          return await this.bm25Search(query, limit);

        case 'dense':
          // Dense vector search only
          return await this.searchWithWorker(query, limit);

        case 'hybrid':
        default:
          // Hybrid search combining BM25 and dense vectors
          return await this.hybridSearch(query, limit);
      }
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Search using real embeddings with cosine similarity via embedding worker
   * @param {string} query - Search query
   * @param {number} limit - Number of results
   * @returns {Array} Search results
   */
  async searchWithWorker(query, limit = 10) {
    try {
      // Compute query embedding via embedding worker
      const queryResult = await this.sendToOffscreen({
        type: 'COMPUTE_QUERY_EMBEDDING',
        data: { query },
      });

      if (!queryResult || !queryResult.embedding) {
        throw new Error('Failed to compute query embedding - invalid result format');
      }

      // Convert the embedding object back to Float32Array (it gets serialized as plain object)
      let queryEmbedding = queryResult.embedding;
      if (!(queryEmbedding instanceof Float32Array)) {
        // Convert plain object back to Float32Array
        const embeddingArray = Object.values(queryEmbedding);
        queryEmbedding = new Float32Array(embeddingArray);
      }

      // Get all pages (entries with pageId and page data)
      const pageEntries = Array.from(this.pages.entries());
      const results = [];

      // Load all page data in parallel using Promise.all()
      const pageDataPromises = pageEntries.map(([pageId, page]) =>
        this.getPageData(pageId)
          .then(pageData => ({ pageId, page, pageData }))
          .catch(error => {
            console.warn(`Failed to load page ${pageId}:`, error);
            return null; // Return null for failed loads
          })
      );

      const loadedPages = await Promise.all(pageDataPromises);

      // Search through all loaded pages and their chunks
      for (const loadedPage of loadedPages) {
        // Skip failed loads
        if (!loadedPage) continue;

        const { pageId, page, pageData } = loadedPage;

        if (!pageId) {
          console.warn('Skipping page with undefined pageId:', page);
          continue;
        }

        if (pageData.chunks && pageData.embeddings) {
          // Search through chunks using real embeddings
          for (let i = 0; i < pageData.chunks.length; i++) {
            const chunk = pageData.chunks[i];
            let embedding = pageData.embeddings[i];

            // Convert embedding to Float32Array if needed
            if (embedding && !(embedding instanceof Float32Array)) {
              embedding = new Float32Array(Object.values(embedding));
            }

            if (embedding && embedding.length === queryEmbedding.length) {
              const similarity = this.cosineSimilarity(queryEmbedding, embedding);

              results.push({
                pageId: pageId,
                pageTitle: page.title,
                pageUrl: page.url,
                chunkId: chunk.id,
                chunkText: chunk.text,
                similarity: similarity,
                timestamp: page.timestamp,
              });
            } else if (embedding) {
            }
          }
        }
      }

      // Sort by similarity and return top results
      const sortedResults = results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);

      return sortedResults;
    } catch (error) {
      console.error('Real embedding search failed:', error);
      throw error;
    }
  }

  /**
   * Calculate text similarity between query and chunk
   * @param {string} query - Search query
   * @param {string} chunkText - Chunk text
   * @returns {number} Similarity score
   */
  calculateTextSimilarity(query, chunkText) {
    const queryWords = query.split(/\s+/);
    const chunkWords = chunkText.split(/\s+/);

    let matches = 0;
    for (const word of queryWords) {
      if (chunkWords.some(chunkWord => chunkWord.includes(word))) {
        matches++;
      }
    }

    return matches / queryWords.length;
  }

  /**
   * Compute cosine similarity between two vectors
   * @param {Float32Array} a - First vector
   * @param {Float32Array} b - Second vector
   * @returns {number} Cosine similarity score (0-1)
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Delete page
   * @param {string} pageId - Page ID to delete
   */
  async deletePage(pageId) {
    try {
      this.pages.delete(pageId);

      // Remove from storage
      const result = await chrome.storage.local.get(['offlineIndexer']);
      const data = result.offlineIndexer;

      if (data && data.pages) {
        const page = data.pages[pageId];
        if (page) {
          delete data.pages[pageId];
          delete data.urlIndex[page.url];
          await chrome.storage.local.set({ offlineIndexer: data });
        }
      }
    } catch (error) {
      console.error('Failed to delete page:', error);
      throw error;
    }
  }

  /**
   * Clear all data
   */
  async clearAllData() {
    try {
      this.pages.clear();
      await chrome.storage.local.clear();
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }

  /**
   * Export data
   * @returns {Object} Exported data
   */
  async exportData() {
    const pages = Array.from(this.pages.values());
    return {
      pages,
      settings: this.settings,
      exportDate: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * Get settings
   * @returns {Object} Current settings
   */
  async getSettings() {
    return { ...this.settings };
  }

  /**
   * Update setting
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   */
  async updateSetting(key, value) {
    this.settings[key] = value;
    await this.saveSettings();
  }

  /**
   * Calculate real storage usage from OPFS
   * @returns {Promise<number>} Storage usage in bytes
   */
  async calculateRealStorageUsage() {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      let totalSize = 0;

      // Calculate size of all stored embeddings using new format
      try {
        const embeddingsDir = await opfsRoot.getDirectoryHandle('embeddings');

        // Get all files in embeddings directory
        const files = [];
        for await (const [name, handle] of embeddingsDir.entries()) {
          if (handle.kind === 'file' && name.endsWith('.json')) {
            files.push({ name, handle });
          }
        }

        // Calculate total size of embedding files
        for (const file of files) {
          try {
            const fileData = await file.handle.getFile();
            totalSize += fileData.size;
          } catch (error) {
            console.warn(`Failed to calculate size for embedding file ${file.name}:`, error);
          }
        }

        console.log(
          `Calculated storage usage: ${totalSize} bytes from ${files.length} embedding files`
        );
      } catch (error) {
        console.warn('Failed to access embeddings directory:', error);
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
      return 0;
    }
  }

  /**
   * Get indexing statistics
   * @returns {Object} Statistics object
   */
  async getStats() {
    const pages = Array.from(this.pages.values());
    const totalChunks = pages.reduce((sum, page) => sum + page.chunkCount, 0);

    // Get model status
    const modelStatus = await this.getModelStatus();

    return {
      pageCount: pages.length,
      totalChunks,
      storageUsage: await this.calculateRealStorageUsage(),
      model: modelStatus,
      pages: pages.map(p => ({
        url: p.url,
        title: p.title,
        timestamp: p.timestamp,
        chunkCount: p.chunkCount,
      })),
    };
  }

  /**
   * Get model status information
   * @returns {Object} Model status object
   */
  async getModelStatus() {
    try {
      // Check if model is downloaded directly using OPFS API
      const isDownloaded = await this.isModelDownloaded();

      return {
        modelName: 'all-MiniLM-L6-v2',
        dimensions: 384,
        downloaded: isDownloaded,
        size: '~25 MB',
        status: isDownloaded ? 'Ready' : 'Not Downloaded',
        error: null,
      };
    } catch (error) {
      console.error('Failed to get model status:', error);
      return {
        modelName: 'all-MiniLM-L6-v2',
        dimensions: 384,
        downloaded: false,
        size: '~25 MB',
        status: 'Error',
        error: error.message,
      };
    }
  }

  /**
   * Check if model is already downloaded
   * @returns {boolean} True if model exists in OPFS
   */
  async isModelDownloaded() {
    try {
      const opfsRoot = await navigator.storage.getDirectory();

      // Check if model directory exists
      const modelDir = await opfsRoot.getDirectoryHandle('models');
      const modelSubDir = await modelDir.getDirectoryHandle('all-MiniLM-L6-v2');

      // Check if model.onnx exists
      const modelFile = await modelSubDir.getFileHandle('model.onnx');
      const modelFileObj = await modelFile.getFile();

      // Check if tokenizer files exist
      const tokenizerFile = await modelSubDir.getFileHandle('tokenizer.json');
      const configFile = await modelSubDir.getFileHandle('config.json');

      return modelFileObj.size > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Download ONNX model to OPFS from bundled files
   */
  async downloadModel() {
    try {
      // Check if already downloaded
      if (await this.isModelDownloaded()) {
        return true;
      }

      // Access OPFS
      const opfsRoot = await navigator.storage.getDirectory();

      // Create model directory
      const modelDir = await opfsRoot.getDirectoryHandle('models', { create: true });
      const modelSubDir = await modelDir.getDirectoryHandle('all-MiniLM-L6-v2', { create: true });

      // Model files are bundled in the extension
      const modelFiles = {
        model: 'generated/models/all-MiniLM-L6-v2/model.onnx',
        tokenizer: 'generated/models/all-MiniLM-L6-v2/tokenizer.json',
        config: 'generated/models/all-MiniLM-L6-v2/config.json',
        vocab: 'generated/models/all-MiniLM-L6-v2/vocab.txt',
        tokenizer_config: 'generated/models/all-MiniLM-L6-v2/tokenizer_config.json',
      };

      // Copy bundled model files to OPFS
      for (const [name, bundledPath] of Object.entries(modelFiles)) {
        const filename =
          name === 'model'
            ? 'model.onnx'
            : name === 'vocab'
              ? 'vocab.txt'
              : name === 'tokenizer_config'
                ? 'tokenizer_config.json'
                : `${name}.json`;
        await this.copyBundledFileToOPFS(bundledPath, modelSubDir, filename);
      }

      return true;
    } catch (error) {
      console.error('Failed to download model:', error);
      throw error;
    }
  }

  /**
   * Copy bundled file to OPFS
   * @param {string} bundledPath - Path to bundled file
   * @param {FileSystemDirectoryHandle} dirHandle - Directory handle
   * @param {string} filename - Target filename
   */
  async copyBundledFileToOPFS(bundledPath, dirHandle, filename) {
    try {
      // Fetch the bundled file using chrome-extension:// URL
      const extensionId = chrome.runtime.id;
      const fileUrl = `chrome-extension://${extensionId}/${bundledPath}`;

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch bundled file: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();

      await writable.write(arrayBuffer);
      await writable.close();
    } catch (error) {
      console.error(`Failed to copy ${filename} to OPFS:`, error);
      throw error;
    }
  }

  /**
   * Auto-download model if not available
   */
  async ensureModelAvailable() {
    try {
      const modelStatus = await this.getModelStatus();

      if (!modelStatus.downloaded) {
        await this.downloadModel();
        return true;
      }

      return true; // Model already available
    } catch (error) {
      console.error('Failed to ensure model availability:', error);
      return false;
    }
  }

  /**
   * Compute TF-IDF based embeddings for text chunks
   * This provides real semantic embeddings without ONNX Runtime issues
   */
  async computeTFIDFEmbeddings(chunks) {
    // Build vocabulary from all chunks
    const vocabulary = new Set();
    const chunkTerms = chunks.map(chunk => {
      const terms = this.tokenizeText(chunk.text);
      terms.forEach(term => vocabulary.add(term));
      return terms;
    });

    const vocabArray = Array.from(vocabulary);
    const vocabSize = vocabArray.length;
    const docCount = chunks.length;

    // Compute TF-IDF scores
    const embeddings = [];

    for (let i = 0; i < chunks.length; i++) {
      const terms = chunkTerms[i];
      const embedding = new Float32Array(384); // Standard embedding size

      // Compute TF-IDF for each term in this chunk
      const termFreq = {};
      terms.forEach(term => {
        termFreq[term] = (termFreq[term] || 0) + 1;
      });

      // Compute TF-IDF scores
      let embeddingIndex = 0;
      for (const term of vocabArray) {
        if (embeddingIndex >= 384) break;

        const tf = termFreq[term] || 0;
        const tfScore = tf / terms.length;

        // Compute IDF (inverse document frequency)
        const docFreq = chunkTerms.filter(chunkTerms => chunkTerms.includes(term)).length;
        const idfScore = Math.log(docCount / (docFreq + 1));

        const tfidfScore = tfScore * idfScore;
        embedding[embeddingIndex] = tfidfScore;
        embeddingIndex++;
      }

      // Fill remaining dimensions with hash-based patterns
      for (let j = embeddingIndex; j < 384; j++) {
        const termIndex = j % vocabArray.length;
        const term = vocabArray[termIndex];
        if (term) {
          let hash = 0;
          for (let k = 0; k < term.length; k++) {
            hash = ((hash << 5) - hash + term.charCodeAt(k)) & 0xffffffff;
          }
          embedding[j] = (Math.abs(hash) % 1000) / 1000;
        }
      }

      // Normalize the embedding
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        for (let j = 0; j < embedding.length; j++) {
          embedding[j] /= magnitude;
        }
      }

      embeddings.push(embedding);
    }

    return embeddings;
  }

  /**
   * Tokenize text into terms
   */
  tokenizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2)
      .slice(0, 100); // Limit to first 100 terms for performance
  }

  /**
   * BM25 tokenization: simple word-based tokenization for keyword matching
   * Different from WordPiece tokenization used for embeddings
   * @param {string} text - Text to tokenize
   * @returns {string[]} Array of tokens
   */
  bm25Tokenize(text) {
    if (!text || typeof text !== 'string') return [];

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(token => token.length > 2); // Filter out very short tokens
  }

  /**
   * Build BM25 inverted index for a chunk
   * @param {string} pageId - Page ID
   * @param {string} chunkId - Chunk ID
   * @param {string} text - Chunk text
   */
  buildBM25Index(pageId, chunkId, text) {
    const tokens = this.bm25Tokenize(text);
    const docKey = `${pageId}:${chunkId}`;

    // Store document length
    this.documentLengths.set(docKey, tokens.length);
    this.totalDocuments++;

    // Update average document length
    let totalLength = 0;
    for (const length of this.documentLengths.values()) {
      totalLength += length;
    }
    this.averageDocumentLength = totalLength / this.totalDocuments;

    // Build term frequency and positions for this document
    const termFrequencies = new Map();
    const termPositions = new Map();

    tokens.forEach((token, position) => {
      termFrequencies.set(token, (termFrequencies.get(token) || 0) + 1);
      if (!termPositions.has(token)) {
        termPositions.set(token, []);
      }
      termPositions.get(token).push(position);
    });

    // Update inverted index
    for (const [term, freq] of termFrequencies.entries()) {
      if (!this.invertedIndex.has(term)) {
        this.invertedIndex.set(term, []);
      }

      const postingsList = this.invertedIndex.get(term);
      postingsList.push({
        pageId,
        chunkId,
        termFreq: freq,
        positions: termPositions.get(term),
      });

      // Update document frequency
      this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
    }
  }

  /**
   * Calculate BM25 score for a document
   * @param {number} termFreq - Term frequency in document
   * @param {number} docFreq - Document frequency (number of docs containing term)
   * @param {number} docLength - Length of document
   * @returns {number} BM25 score
   */
  calculateBM25Score(termFreq, docFreq, docLength) {
    const idf = Math.log((this.totalDocuments - docFreq + 0.5) / (docFreq + 0.5) + 1);
    const tf =
      (termFreq * (this.bm25_k1 + 1)) /
      (termFreq + this.bm25_k1 * (1 - this.bm25_b + this.bm25_b * (docLength / this.averageDocumentLength)));
    return idf * tf;
  }

  /**
   * BM25 search
   * @param {string} query - Search query
   * @param {number} limit - Number of results to return
   * @returns {Array} Search results
   */
  async bm25Search(query, limit = 50) {
    const queryTokens = this.bm25Tokenize(query);
    if (queryTokens.length === 0) {
      console.warn('BM25 search: Query tokenized to empty array');
      return [];
    }

    // Debug: Check index state
    console.log('BM25 search debug:', {
      query,
      queryTokens,
      indexSize: this.invertedIndex.size,
      totalDocuments: this.totalDocuments,
      tokensInIndex: queryTokens.filter(t => this.invertedIndex.has(t)).length,
    });

    if (this.invertedIndex.size === 0 || this.totalDocuments === 0) {
      console.warn('BM25 index is empty. You may need to rebuild the index for existing pages.');
      return [];
    }

    const scores = new Map(); // docKey -> score

    // Calculate BM25 scores for each document
    for (const queryToken of queryTokens) {
      if (!this.invertedIndex.has(queryToken)) {
        console.log(`Token "${queryToken}" not found in index`);
        continue;
      }

      const postings = this.invertedIndex.get(queryToken);
      const docFreq = this.documentFrequency.get(queryToken) || 0;

      for (const posting of postings) {
        const docKey = `${posting.pageId}:${posting.chunkId}`;
        const docLength = this.documentLengths.get(docKey) || 1;
        const score = this.calculateBM25Score(posting.termFreq, docFreq, docLength);

        scores.set(docKey, (scores.get(docKey) || 0) + score);
      }
    }

    // Convert to array and sort by score
    const results = [];
    for (const [docKey, score] of scores.entries()) {
      const [pageId, chunkId] = docKey.split(':');
      const page = this.pages.get(pageId);
      if (!page) continue;

      // Get chunk text
      const chunks = await this.getPageChunks(pageId);
      const chunk = chunks.find(c => c.id === chunkId);

      if (chunk) {
        results.push({
          pageId,
          pageTitle: page.title,
          pageUrl: page.url,
          chunkId,
          chunkText: chunk.text,
          score,
          timestamp: page.timestamp,
        });
      }
    }

    // Sort by score descending and return top results
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Reciprocal Rank Fusion (RRF) to combine multiple ranking systems
   * @param {Array} rankings - Array of ranking arrays, each with items having a score
   * @param {number} k - Constant for RRF (default 60)
   * @returns {Array} Combined ranking
   */
  reciprocalRankFusion(rankings, k = 60) {
    const rrfScores = new Map(); // docKey -> RRF score
    const docData = new Map(); // docKey -> document data

    rankings.forEach(ranking => {
      ranking.forEach((item, rank) => {
        const docKey = `${item.pageId}:${item.chunkId}`;
        const rrfScore = 1 / (rank + k);

        rrfScores.set(docKey, (rrfScores.get(docKey) || 0) + rrfScore);

        // Store document data (use first occurrence)
        if (!docData.has(docKey)) {
          docData.set(docKey, item);
        }
      });
    });

    // Convert to array and sort by RRF score
    const results = [];
    for (const [docKey, rrfScore] of rrfScores.entries()) {
      const item = docData.get(docKey);
      results.push({
        ...item,
        rrfScore,
      });
    }

    return results.sort((a, b) => b.rrfScore - a.rrfScore);
  }

  /**
   * Hybrid search combining BM25 and dense vector search
   * @param {string} query - Search query
   * @param {number} limit - Number of final results to return
   * @returns {Array} Combined search results
   */
  async hybridSearch(query, limit = 10) {
    try {
      // Run both searches in parallel
      const [bm25Results, denseResults] = await Promise.all([
        this.bm25Search(query, 50), // Get top 50 from BM25
        this.searchWithWorker(query, 50), // Get top 50 from dense search
      ]);

      // Normalize scores to be comparable
      // For BM25 results, use the BM25 score as similarity
      const bm25Normalized = bm25Results.map(r => ({
        ...r,
        similarity: r.score, // Use BM25 score as similarity for consistency
      }));

      // Combine using Reciprocal Rank Fusion
      const combined = this.reciprocalRankFusion([bm25Normalized, denseResults], 60);

      // Return top K results
      return combined.slice(0, limit);
    } catch (error) {
      console.error('Hybrid search failed:', error);
      throw error;
    }
  }

  /**
   * Save BM25 inverted index to OPFS
   */
  async saveBM25Index() {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const indexDir = await opfsRoot.getDirectoryHandle('index', { create: true });

      // Convert Maps to plain objects for JSON serialization
      const indexData = {
        invertedIndex: Array.from(this.invertedIndex.entries()).map(([term, postings]) => ({
          term,
          postings,
        })),
        documentFrequency: Array.from(this.documentFrequency.entries()).map(([term, freq]) => ({
          term,
          freq,
        })),
        documentLengths: Array.from(this.documentLengths.entries()).map(([docKey, length]) => ({
          docKey,
          length,
        })),
        averageDocumentLength: this.averageDocumentLength,
        totalDocuments: this.totalDocuments,
      };

      // Write to OPFS
      const indexFile = await indexDir.getFileHandle('inverted.json', { create: true });
      const writable = await indexFile.createWritable();
      await writable.write(JSON.stringify(indexData));
      await writable.close();
    } catch (error) {
      console.error('Failed to save BM25 index to OPFS:', error);
      throw error;
    }
  }

  /**
   * Rebuild BM25 index for all existing pages
   * Useful when BM25 feature is added to existing indexed pages
   */
  async rebuildBM25Index() {
    console.log('Rebuilding BM25 index for all existing pages...');
    
    // Clear existing index
    this.invertedIndex = new Map();
    this.documentFrequency = new Map();
    this.documentLengths = new Map();
    this.averageDocumentLength = 0;
    this.totalDocuments = 0;

    // Get all pages
    const pages = Array.from(this.pages.values());
    console.log(`Found ${pages.length} pages to index`);

    if (pages.length === 0) {
      console.warn('No pages found to index. Make sure you have indexed some pages first.');
      return {
        success: false,
        error: 'No pages found to index',
        pagesIndexed: 0,
        errors: 0,
        totalDocuments: 0,
        totalTerms: 0,
      };
    }

    let indexedCount = 0;
    let errorCount = 0;
    let totalChunksIndexed = 0;

    for (const page of pages) {
      try {
        const chunks = await this.getPageChunks(page.pageId);
        if (chunks.length === 0) {
          console.warn(`No chunks found for page: ${page.title} (${page.pageId})`);
          errorCount++;
          continue;
        }

        console.log(`Indexing ${chunks.length} chunks for page: ${page.title}`);

        for (const chunk of chunks) {
          if (!chunk.text || chunk.text.trim().length === 0) {
            console.warn(`Skipping empty chunk ${chunk.id} for page ${page.pageId}`);
            continue;
          }
          this.buildBM25Index(page.pageId, chunk.id, chunk.text);
          totalChunksIndexed++;
        }
        indexedCount++;
      } catch (error) {
        console.error(`Failed to index page ${page.pageId} (${page.title}):`, error);
        errorCount++;
      }
    }

    // Save the rebuilt index
    await this.saveBM25Index();

    console.log(`BM25 index rebuild complete:`, {
      pagesIndexed: indexedCount,
      errors: errorCount,
      totalChunksIndexed,
      totalDocuments: this.totalDocuments,
      totalTerms: this.invertedIndex.size,
      avgDocLength: this.averageDocumentLength,
    });

    return {
      success: true,
      pagesIndexed: indexedCount,
      errors: errorCount,
      totalChunksIndexed,
      totalDocuments: this.totalDocuments,
      totalTerms: this.invertedIndex.size,
    };
  }

  /**
   * Load BM25 inverted index from OPFS
   */
  async loadBM25Index() {
    try {
      const opfsRoot = await navigator.storage.getDirectory();
      const indexDir = await opfsRoot.getDirectoryHandle('index');
      const indexFile = await indexDir.getFileHandle('inverted.json');
      const file = await indexFile.getFile();
      const text = await file.text();
      const indexData = JSON.parse(text);

      // Restore Maps from plain objects
      this.invertedIndex = new Map(
        indexData.invertedIndex.map(item => [item.term, item.postings])
      );
      this.documentFrequency = new Map(
        indexData.documentFrequency.map(item => [item.term, item.freq])
      );
      this.documentLengths = new Map(
        indexData.documentLengths.map(item => [item.docKey, item.length])
      );
      this.averageDocumentLength = indexData.averageDocumentLength || 0;
      this.totalDocuments = indexData.totalDocuments || 0;

      console.log('BM25 index loaded from OPFS:', {
        terms: this.invertedIndex.size,
        documents: this.totalDocuments,
        avgDocLength: this.averageDocumentLength,
      });
    } catch (error) {
      console.log('No existing BM25 index found in OPFS, starting fresh');
      // Initialize empty index structures
      this.invertedIndex = new Map();
      this.documentFrequency = new Map();
      this.documentLengths = new Map();
      this.averageDocumentLength = 0;
      this.totalDocuments = 0;
    }
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Create service instance
const backgroundService = new BackgroundService();

// Initialize on startup
backgroundService.init().catch(console.error);

// Handle messages from content scripts and UI
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, data } = request;

  switch (type) {
    // Handle offscreen ready signal
    case 'offscreen:ready':
      backgroundService.offscreenReady = true;
      return false; // No response needed

    // Handle responses from offscreen document (now handled via direct callback)
    case 'PAGE_PROCESSED':
    case 'QUERY_EMBEDDING_COMPUTED':
    case 'ERROR':
      // These are now handled via direct response callback in sendToOffscreen
      return false; // No response needed for offscreen messages

    case 'CAPTURE_PAGE':
      // Respond immediately to prevent message channel timeout
      sendResponse({ success: true, message: 'Page capture initiated' });

      // Process asynchronously without blocking the response
      backgroundService
        .captureAndProcess(sender.tab.id, data.url, data.title)
        .then(() => {})
        .catch(error => {
          console.error('Page processing failed:', error);
        });
      return false; // Response already sent

    case 'GET_STATS':
      backgroundService
        .getStats()
        .then(stats => sendResponse({ success: true, data: stats }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_ALL_PAGES':
      backgroundService
        .getAllPages()
        .then(pages => sendResponse({ success: true, data: pages }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_RECENT_PAGES':
      backgroundService
        .getRecentPages(data.limit || 5)
        .then(pages => sendResponse({ success: true, data: pages }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_PAGE_DETAIL':
      backgroundService
        .getPageDetail(data.pageId)
        .then(page => sendResponse({ success: true, data: page }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_PAGE_CHUNKS':
      backgroundService
        .getPageChunks(data.pageId)
        .then(chunks => sendResponse({ success: true, data: chunks }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_PAGE_VECTORS':
      backgroundService
        .getPageVectors(data.pageId, data.dimensions)
        .then(vectors => sendResponse({ success: true, data: vectors }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_PAGE_DATA':
      backgroundService
        .getPageData(data.pageId)
        .then(pageData => sendResponse({ success: true, data: pageData }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'SEMANTIC_SEARCH':
      backgroundService
        .semanticSearch(data.query, data.limit || 10, data.mode)
        .then(results => sendResponse({ success: true, data: results }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'BM25_SEARCH':
      backgroundService
        .bm25Search(data.query, data.limit || 10)
        .then(results => sendResponse({ success: true, data: results }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'HYBRID_SEARCH':
      backgroundService
        .hybridSearch(data.query, data.limit || 10)
        .then(results => sendResponse({ success: true, data: results }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'REBUILD_BM25_INDEX':
      backgroundService
        .rebuildBM25Index()
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'DELETE_PAGE':
      backgroundService
        .deletePage(data.pageId)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'CLEAR_ALL_DATA':
      backgroundService
        .clearAllData()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'EXPORT_DATA':
      backgroundService
        .exportData()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_SETTINGS':
      backgroundService
        .getSettings()
        .then(settings => sendResponse({ success: true, data: settings }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'UPDATE_SETTING':
      backgroundService
        .updateSetting(data.key, data.value)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'INIT':
      backgroundService
        .init()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'DOWNLOAD_MODEL':
      backgroundService
        .downloadModel()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'ENSURE_MODEL_AVAILABLE':
      backgroundService
        .ensureModelAvailable()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      console.warn('Unknown message type:', type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Handle extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  backgroundService.init().catch(console.error);
});

chrome.runtime.onSuspend.addListener(() => {});
