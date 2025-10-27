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
    };
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
   * @param {string} query - Search query
   * @param {number} limit - Number of results
   * @returns {Array} Search results
   */
  async semanticSearch(query, limit = 10) {
    try {
      // Use search worker for embedding search
      return await this.searchWithWorker(query, limit);
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

      // Search through all pages and their chunks
      for (const [pageId, page] of pageEntries) {
        try {
          if (!pageId) {
            console.warn('Skipping page with undefined pageId:', page);
            continue;
          }

          const pageData = await this.getPageData(pageId);

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
        } catch (error) {
          console.warn(`Failed to search page ${pageId}:`, error);
          // Continue with other pages
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
        .semanticSearch(data.query, data.limit || 10)
        .then(results => sendResponse({ success: true, data: results }))
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
