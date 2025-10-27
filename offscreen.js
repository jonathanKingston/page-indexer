/**
 * Offscreen Document Script
 * Handles page processing, MHTML parsing, text extraction, and embedding computation
 */

class OffscreenController {
  constructor() {
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.ort = null;
    this.session = null;
    this.tokenizer = null;
    this.modelPath = null;
    this.initialized = false;
  }

  /**
   * Initialize the offscreen controller
   * @param {string[]} vocab - Optional vocabulary array from background
   */
  async init(vocab = null) {
    try {
      // Initialize ONNX Runtime directly in offscreen document
      await this.initONNXRuntime(vocab);

      // Handle messages from service worker
      const messageListener = (message, sender, sendResponse) => {
        const handled = this.handleServiceWorkerMessage(message, sendResponse);
        return handled;
      };

      chrome.runtime.onMessage.addListener(messageListener);

      // Send ready signal to background script
      chrome.runtime.sendMessage({ type: 'offscreen:ready' });
    } catch (error) {
      console.error('Failed to initialize offscreen controller:', error);
    }
  }

  /**
   * Initialize ONNX Runtime in offscreen document context
   */
  async waitForWasmBackend() {
    // Wait for WASM backend to be available
    const maxAttempts = 50; // 5 seconds max
    const delay = 100; // 100ms between attempts

    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Check if WASM backend is available
        const availableProviders = this.ort.env.availableProviders || [];

        if (availableProviders.includes('wasm')) {
          return;
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async initONNXRuntime(vocab = null) {
    try {
      // Import ONNX Runtime Web - use the minified version from extension
      try {
        // Import from the extension's ORT files
        const ortModule = await import(chrome.runtime.getURL('generated/ort/ort.wasm.min.mjs'));
        this.ort = ortModule.default || ortModule;
      } catch (importError) {
        console.error('Failed to import ONNX Runtime:', importError);
        throw new Error(
          'ONNX Runtime not available. Please ensure the extension is properly built.'
        );
      }

      // Set global reference for bundled context
      if (typeof window !== 'undefined') {
        window.ort = this.ort;
      }

      // Configure WASM paths and settings for Chrome extension
      const ortBaseUrl = chrome.runtime.getURL('generated/ort/');
      this.ort.env.wasm.wasmPaths = ortBaseUrl;
      this.ort.env.wasm.numThreads = 1; // Use single thread to avoid SharedArrayBuffer issues

      // Suppress CPU vendor warnings and other non-critical logs
      this.ort.env.logLevel = 'error'; // Only show errors, suppress warnings
      this.ort.env.wasm.simd = true; // Enable SIMD for better performance

      // Load model from OPFS
      this.modelPath = await this.getModelPath();
      if (!this.modelPath) {
        throw new Error(
          'ONNX model not found in OPFS. Please download the all-MiniLM-L6-v2 model first.'
        );
      }

      // Create object URL for the model file
      const opfsRoot = await navigator.storage.getDirectory();
      const modelDir = await opfsRoot.getDirectoryHandle('models');
      const modelSubDir = await modelDir.getDirectoryHandle('all-MiniLM-L6-v2');
      const modelFile = await modelSubDir.getFileHandle('model.onnx');
      const file = await modelFile.getFile();
      this.modelPath = URL.createObjectURL(file);

      // Create ONNX session with Chrome extension compatible settings
      this.session = await this.ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: false,
        enableMemPattern: false,
        logId: 'chrome-extension-ort',
      });

      // Load tokenizer with vocab if provided
      await this.loadTokenizer(vocab);

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ONNX Runtime:', error);
      throw error;
    }
  }

  /**
   * Handle messages from service worker
   * @param {Object} message - Message from service worker
   * @param {Function} sendResponse - Response callback
   */
  handleServiceWorkerMessage(message, sendResponse) {
    const { type, data } = message;

    // Only handle specific message types meant for offscreen document
    if (!['PROCESS_PAGE', 'COMPUTE_QUERY_EMBEDDING', 'INIT_WITH_VOCAB'].includes(type)) {
      return false; // Let other handlers process this message
    }

    // Handle async operations properly
    try {
      switch (type) {
        case 'INIT_WITH_VOCAB':
          this.initWithVocab(data, sendResponse);
          break;

        case 'PROCESS_PAGE':
          this.processPage(data, sendResponse);
          break;

        case 'COMPUTE_QUERY_EMBEDDING':
          this.computeQueryEmbedding(data, sendResponse);
          break;

        default:
          console.warn('Unknown message type from service worker:', type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }

      return true; // Indicate we handled this message and will respond asynchronously
    } catch (error) {
      console.error('Error handling service worker message:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }

  /**
   * Initialize with vocab passed from background
   * @param {Object} data - Data containing vocab array
   * @param {Function} sendResponse - Response callback
   */
  async initWithVocab(data, sendResponse) {
    try {
      if (data && data.vocab) {
        console.log('Received vocab from background, size:', data.vocab.length);
        await this.loadTokenizer(data.vocab);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No vocab provided' });
      }
    } catch (error) {
      console.error('Failed to init with vocab:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Process page directly
   * @param {Object} data - Page data
   * @param {Function} sendResponse - Response callback
   */
  async processPage(data, sendResponse) {
    try {
      const result = await this.processPageInternal(
        data.mhtmlData,
        data.url,
        data.title,
        data.pageId
      );

      // Store embeddings in OPFS to avoid message size limits
      await this.storeEmbeddingsInOPFS(result.pageId, result.embeddings);

      // Send data without embeddings (just metadata)
      const metadataData = {
        ...result,
        embeddings: null, // Remove embeddings from message
        embeddingsStored: true, // Flag indicating embeddings are stored separately
      };

      sendResponse({ success: true, data: metadataData });
    } catch (error) {
      console.error('Failed to process page:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Compute query embedding directly
   * @param {Object} data - Query data
   * @param {Function} sendResponse - Response callback
   */
  async computeQueryEmbedding(data, sendResponse) {
    try {
      if (!data || !data.query) {
        throw new Error('Invalid query data');
      }

      const embedding = await this.computeSingleEmbedding(data.query);
      sendResponse({ success: true, data: { embedding: embedding } });
    } catch (error) {
      console.error('Failed to compute query embedding:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Send message to service worker
   * @param {Object} message - Message to send
   */
  sendToServiceWorker(message) {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send message to service worker:', chrome.runtime.lastError);
      }
    });
  }

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  generateRequestId() {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  /**
   * Get model path from OPFS
   * @returns {string|null} Model path or null if not found
   */
  async getModelPath() {
    try {
      const opfsRoot = await navigator.storage.getDirectory();

      const modelDir = await opfsRoot.getDirectoryHandle('models');
      const modelSubDir = await modelDir.getDirectoryHandle('all-MiniLM-L6-v2');
      const modelFile = await modelSubDir.getFileHandle('model.onnx');
      const file = await modelFile.getFile();

      const modelUrl = URL.createObjectURL(file);
      return modelUrl;
    } catch (error) {
      return null;
    }
  }

  /**
   * Load tokenizer from vocab array
   * @param {string[]} vocab - Vocabulary array (passed from background)
   */
  async loadTokenizer(vocab = null) {
    try {
      console.log('Loading tokenizer...');

      // If vocab not provided, try to load from extension URL
      if (!vocab) {
        console.log('No vocab provided, attempting to load from bundle...');
        try {
          const vocabUrl = chrome.runtime.getURL('generated/models/all-MiniLM-L6-v2/vocab.txt');
          const response = await fetch(vocabUrl);

          if (!response.ok) {
            throw new Error(`Failed to fetch vocab: ${response.status}`);
          }

          const vocabText = await response.text();
          vocab = vocabText.split('\n').filter(line => line.trim());
        } catch (error) {
          console.error('Failed to load vocab from URL:', error);
          throw new Error('Vocab must be provided to loadTokenizer');
        }
      }

      console.log('Vocabulary loaded, size:', vocab.length);

      // Create vocab map for O(1) lookup
      const vocabMap = new Map(vocab.map((token, idx) => [token, idx]));

      // Get special token IDs
      const clsId = vocabMap.get('[CLS]') || 101;
      const sepId = vocabMap.get('[SEP]') || 102;
      const unkId = vocabMap.get('[UNK]') || 100;

      console.log('Special tokens:', { clsId, sepId, unkId });

      // Create WordPiece tokenizer
      this.tokenizer = {
        vocab,
        vocabMap,
        clsId,
        sepId,
        unkId,
        encoder: {
          encode: text => {
            const tokens = [clsId];

            // Basic preprocessing: lowercase and split by whitespace
            const words = text
              .toLowerCase()
              .replace(/['']/g, "'") // Normalize quotes
              .split(/\s+/)
              .filter(w => w.length > 0);

            // WordPiece tokenization for each word
            for (const word of words) {
              // Remove punctuation for initial lookup
              const cleanWord = word.replace(/[^\w]/g, '');
              if (!cleanWord) continue;

              // Greedy longest-match first
              if (vocabMap.has(cleanWord)) {
                tokens.push(vocabMap.get(cleanWord));
                continue;
              }

              // Subword tokenization
              let start = 0;
              const chars = Array.from(cleanWord);
              let hasTokens = false;

              while (start < chars.length) {
                let end = chars.length;
                let found = false;

                // Try longest match first
                while (end > start) {
                  const substr = chars.slice(start, end).join('');
                  const token = start === 0 ? substr : '##' + substr;

                  if (vocabMap.has(token)) {
                    tokens.push(vocabMap.get(token));
                    found = true;
                    hasTokens = true;
                    start = end;
                    break;
                  }
                  end--;
                }

                // No subword found, use UNK and move forward
                if (!found) {
                  if (!hasTokens) {
                    tokens.push(unkId);
                  }
                  break;
                }
              }
            }

            tokens.push(sepId);
            return tokens;
          },
        },
      };

      // Test tokenization
      const testText = 'electro';
      const testTokens = this.tokenizer.encoder.encode(testText);
      console.log(`Test: "${testText}" -> tokens:`, testTokens);

      return;
    } catch (error) {
      console.error('Failed to load tokenizer:', error);
      throw new Error('Failed to load tokenizer from bundled vocab.txt');
    }
  }

  /**
   * Store embeddings in OPFS to avoid message size limits
   * @param {string} pageId - Page ID
   * @param {Float32Array[]} embeddings - Array of embedding vectors
   */
  async storeEmbeddingsInOPFS(pageId, embeddings) {
    try {
      const opfsRoot = await navigator.storage.getDirectory();

      // Create embeddings directory if it doesn't exist
      let embeddingsDir;
      try {
        embeddingsDir = await opfsRoot.getDirectoryHandle('embeddings');
      } catch (error) {
        embeddingsDir = await opfsRoot.getDirectoryHandle('embeddings', { create: true });
      }

      // Store each embedding as a separate file
      for (let i = 0; i < embeddings.length; i++) {
        const embedding = embeddings[i];
        // Sanitize pageId to ensure valid filename
        const sanitizedPageId = pageId ? pageId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'unknown';
        const fileName = `${sanitizedPageId}_chunk_${i}.json`;

        // Convert Float32Array to regular array for JSON serialization
        const embeddingData = {
          embedding: Array.from(embedding),
          chunkIndex: i,
          pageId: pageId,
          timestamp: Date.now(),
        };

        // Write to OPFS
        const fileHandle = await embeddingsDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(embeddingData));
        await writable.close();
      }
    } catch (error) {
      console.error('Failed to store embeddings in OPFS:', error);
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
          embeddings.push(new Float32Array(data.embedding));
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
   * Process MHTML and extract text content
   * @param {ArrayBuffer} mhtmlData - MHTML data
   * @returns {string} Extracted text content
   */
  async processMHTML(mhtmlData) {
    try {
      // Handle different data types
      let arrayBuffer;
      if (mhtmlData instanceof Uint8Array) {
        arrayBuffer = mhtmlData.buffer;
      } else if (mhtmlData instanceof ArrayBuffer) {
        arrayBuffer = mhtmlData;
      } else if (Array.isArray(mhtmlData)) {
        // Convert array to Uint8Array
        const uint8Array = new Uint8Array(mhtmlData);
        arrayBuffer = uint8Array.buffer;
      } else if (mhtmlData && typeof mhtmlData === 'object' && mhtmlData.data) {
        // Handle serialized data
        const uint8Array = new Uint8Array(mhtmlData.data);
        arrayBuffer = uint8Array.buffer;
      } else {
        console.error('Invalid data type:', typeof mhtmlData, mhtmlData);
        throw new Error(
          'Invalid data type received, expected Uint8Array, ArrayBuffer, or serialized data'
        );
      }

      // Convert ArrayBuffer to text
      const decoder = new TextDecoder('utf-8');
      const mhtmlText = decoder.decode(arrayBuffer);

      // Extract HTML from MHTML
      const htmlContent = await this.extractHTMLFromMHTML(mhtmlText);

      // Parse HTML to extract text using DOMParser + Readability
      const textContent = await this.extractTextFromHTML(htmlContent);

      return textContent;
    } catch (error) {
      console.error('Failed to process MHTML:', error);
      throw error;
    }
  }

  /**
   * Extract HTML from MHTML content
   * @param {string} mhtmlText - MHTML text content
   * @returns {string} HTML content
   */
  async extractHTMLFromMHTML(mhtmlText) {
    try {
      // Import mhtml-to-html dynamically
      const { convert } = await import('mhtml-to-html');

      // Convert MHTML to HTML using the library
      const htmlContent = await convert(mhtmlText);

      // Handle different return types from mhtml-to-html
      if (typeof htmlContent === 'string') {
        return htmlContent;
      } else if (htmlContent && typeof htmlContent === 'object') {
        if (htmlContent.data) {
          return htmlContent.data;
        } else if (htmlContent.html) {
          return htmlContent.html;
        } else if (htmlContent.content) {
          return htmlContent.content;
        } else if (htmlContent.body) {
          return htmlContent.body;
        } else {
          return String(htmlContent);
        }
      } else {
        return String(htmlContent);
      }
    } catch (error) {
      // Fallback to manual MHTML parsing
      const lines = mhtmlText.split('\n');
      let htmlContent = '';
      let inHtmlSection = false;

      for (const line of lines) {
        if (line.includes('Content-Type: text/html')) {
          inHtmlSection = true;
          continue;
        }
        if (inHtmlSection && line.trim() === '') {
          continue;
        }
        if (inHtmlSection && line.startsWith('--')) {
          break;
        }
        if (inHtmlSection) {
          htmlContent += line + '\n';
        }
      }

      return htmlContent;
    }
  }

  /**
   * Extract text content from HTML using DOMParser + Readability
   * @param {string} htmlContent - HTML content
   * @returns {string} Extracted text
   */
  async extractTextFromHTML(htmlContent) {
    try {
      // Ensure we have a string
      if (typeof htmlContent !== 'string') {
        htmlContent = String(htmlContent);
      }

      // Parse HTML using native DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // Use Readability to extract main content
      const { Readability } = await import('@mozilla/readability');
      const reader = new Readability(doc.cloneNode(true)); // Clone to avoid modifying original
      const article = reader.parse();

      // Extract text from Readability article or fallback to body text
      const textContent = article ? article.textContent : doc.body.textContent;

      return textContent.trim();
    } catch (error) {
      console.error('Failed to extract text from HTML:', error);
      // Fallback to simple text extraction
      return htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  /**
   * Chunk text into segments for embedding
   * @param {string} text - Text to chunk
   * @returns {Object[]} Array of chunk objects
   */
  chunkText(text) {
    const chunks = [];
    const maxChunkSize = 512; // tokens
    const overlap = 50; // tokens

    // Simple word-based chunking (in production, use proper tokenization)
    const words = text.split(/\s+/);
    const chunks_text = [];

    for (let i = 0; i < words.length; i += maxChunkSize - overlap) {
      const chunkWords = words.slice(i, i + maxChunkSize);
      chunks_text.push(chunkWords.join(' '));
    }

    // Create chunk objects
    chunks_text.forEach((chunkText, index) => {
      chunks.push({
        id: `chunk_${index}`,
        text: chunkText,
        startIndex: index * (maxChunkSize - overlap),
        endIndex: Math.min((index + 1) * maxChunkSize - overlap, words.length),
        tokenCount: chunkText.split(/\s+/).length,
      });
    });

    return chunks;
  }

  /**
   * Tokenize text using the loaded tokenizer
   * @param {string} text - Text to tokenize
   * @returns {number[]} Token IDs
   */
  tokenize(text) {
    if (!this.tokenizer || !this.tokenizer.encoder) {
      throw new Error('Tokenizer not loaded. Please ensure tokenizer.json is properly downloaded.');
    }

    try {
      console.log('Tokenizing text:', text);
      const tokens = this.tokenizer.encoder.encode(text);
      console.log('Generated tokens:', tokens);
      console.log('Number of tokens:', tokens.length);

      // Log first few and last few tokens for debugging
      if (tokens.length > 0) {
        console.log('First 5 tokens:', tokens.slice(0, 5));
        if (tokens.length > 5) {
          console.log('Last 5 tokens:', tokens.slice(-5));
        }
      }

      return tokens;
    } catch (error) {
      console.error('Tokenization failed:', error);
      throw new Error('Failed to tokenize text: ' + error.message);
    }
  }

  /**
   * Compute embeddings for text chunks
   * @param {Object[]} chunks - Array of chunk objects
   * @returns {Float32Array[]} Array of embedding vectors
   */
  async computeEmbeddings(chunks) {
    const embeddings = [];
    const startTime = Date.now();

    for (const chunk of chunks) {
      try {
        // Add timeout to prevent hanging
        const embeddingPromise = this.computeSingleEmbedding(chunk.text);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Embedding computation timeout')), 30000)
        );

        const embedding = await Promise.race([embeddingPromise, timeoutPromise]);
        embeddings.push(embedding);
      } catch (error) {
        console.error(`Failed to compute embedding for chunk ${chunk.id}:`, error);
        // Add zero vector as fallback
        embeddings.push(new Float32Array(384).fill(0));
      }
    }

    const totalTime = Date.now() - startTime;

    return embeddings;
  }

  /**
   * Compute embedding for a single text
   * @param {string} text - Text to embed
   * @returns {Float32Array} Embedding vector
   */
  async computeSingleEmbedding(text) {
    if (!this.ort || !this.session) {
      throw new Error('ONNX Runtime not initialized. Please ensure the model is downloaded.');
    }

    try {
      console.log(
        'Computing embedding for text:',
        text.substring(0, 100) + (text.length > 100 ? '...' : '')
      );

      // Tokenize the text
      const tokens = this.tokenize(text);
      console.log('Tokenized text into', tokens.length, 'tokens');

      // Limit to max sequence length (512 tokens)
      const MAX_SEQUENCE_LENGTH = 512;
      const trimmedTokens = tokens.slice(0, MAX_SEQUENCE_LENGTH);
      if (tokens.length > MAX_SEQUENCE_LENGTH) {
        console.warn(`Text has ${tokens.length} tokens, truncating to ${MAX_SEQUENCE_LENGTH}`);
      }

      // Prepare input for ONNX model - use BigInt64Array as required
      const inputIds = new BigInt64Array(trimmedTokens.map(t => BigInt(t)));
      const actualLength = trimmedTokens.length;
      const attentionMask = new BigInt64Array(actualLength).fill(1n);
      const tokenTypeIds = new BigInt64Array(actualLength).fill(0n); // All tokens are type 0 for single sentence

      console.log(
        'Input tensor shapes - inputIds:',
        inputIds.length,
        'attentionMask:',
        attentionMask.length,
        'tokenTypeIds:',
        tokenTypeIds.length
      );

      // Create input tensor
      const inputIdsTensor = new this.ort.Tensor('int64', inputIds, [1, actualLength]);
      const attentionMaskTensor = new this.ort.Tensor('int64', attentionMask, [1, actualLength]);
      const tokenTypeIdsTensor = new this.ort.Tensor('int64', tokenTypeIds, [1, actualLength]);

      // Run inference
      const inferenceStart = Date.now();
      console.log('Running ONNX inference...');

      let results;
      try {
        results = await this.session.run({
          input_ids: inputIdsTensor,
          attention_mask: attentionMaskTensor,
          token_type_ids: tokenTypeIdsTensor,
        });
      } catch (runtimeError) {
        console.error('ONNX Runtime error caught:');
        console.error('Error type:', typeof runtimeError);
        console.error('Error value:', runtimeError);
        console.error('Error message:', runtimeError?.message);
        console.error('Tensor info:', {
          inputIdsLength: inputIdsTensor.dims,
          attentionMaskLength: attentionMaskTensor.dims,
          tokenTypeIdsLength: tokenTypeIdsTensor.dims,
        });
        // Clean up tensors before re-throwing
        inputIdsTensor.dispose();
        attentionMaskTensor.dispose();
        tokenTypeIdsTensor.dispose();
        throw new Error(`ONNX Runtime inference failed: ${runtimeError}`);
      }

      const inferenceTime = Date.now() - inferenceStart;
      console.log('ONNX inference completed in', inferenceTime, 'ms');

      // Validate results
      if (!results.last_hidden_state) {
        console.error('ONNX results missing last_hidden_state');
        console.error('Available outputs:', Object.keys(results));
        throw new Error('ONNX inference returned unexpected output structure');
      }

      // Check if data is available
      if (!results.last_hidden_state.data) {
        console.error('hidden_state data is null or undefined');
        console.error('hidden_state object:', results.last_hidden_state);
        throw new Error('ONNX inference returned tensor without data');
      }

      // Extract embeddings and pool to sentence embedding
      // last_hidden_state shape is [batch_size, sequence_length, hidden_size]
      const hiddenState = results.last_hidden_state.data;
      const dims = results.last_hidden_state.dims;

      if (!dims || dims.length !== 3) {
        console.error('Invalid tensor dimensions:', dims);
        throw new Error(`Expected 3D tensor, got ${dims?.length}D tensor`);
      }

      const batchSize = dims[0];
      const seqLength = dims[1];
      const hiddenSize = dims[2];

      console.log('Hidden state dimensions:', { batchSize, seqLength, hiddenSize });

      // Validate expected shape
      if (batchSize !== 1) {
        console.error('Unexpected batch size:', batchSize);
        throw new Error(`Expected batch size 1, got ${batchSize}`);
      }

      if (hiddenState.length !== batchSize * seqLength * hiddenSize) {
        console.error('Tensor size mismatch:', {
          expected: batchSize * seqLength * hiddenSize,
          actual: hiddenState.length,
          batchSize,
          seqLength,
          hiddenSize,
        });
        throw new Error('Tensor data size does not match dimensions');
      }

      // For 3D tensor [batch, seq, hidden], to access [b, s, h]:
      // offset = b * seqLength * hiddenSize + s * hiddenSize + h
      // Since we only have batch=0, offset = s * hiddenSize + h

      // Average pool over sequence length (dimension 1)
      const embedding = new Float32Array(hiddenSize);
      for (let i = 0; i < hiddenSize; i++) {
        let sum = 0;
        for (let j = 0; j < seqLength; j++) {
          // Correct index: j * hiddenSize + i
          const index = j * hiddenSize + i;
          if (index >= 0 && index < hiddenState.length) {
            sum += hiddenState[index];
          } else {
            console.error(
              `Index out of bounds: ${index}, hiddenState.length: ${hiddenState.length}`
            );
            throw new Error(`Index out of bounds when processing embedding`);
          }
        }
        embedding[i] = sum / seqLength;
      }

      console.log('Generated embedding vector of size:', embedding.length);
      console.log('First 5 embedding values:', Array.from(embedding.slice(0, 5)));

      // Clean up tensors
      inputIdsTensor.dispose();
      attentionMaskTensor.dispose();
      tokenTypeIdsTensor.dispose();

      return embedding;
    } catch (error) {
      console.error('Failed to compute single embedding:');
      console.error('Error type:', typeof error);
      console.error('Error message:', error.message || error);
      console.error('Error stack:', error.stack || 'No stack');
      console.error('Full error object:', error);
      throw error;
    }
  }

  /**
   * Process a complete page: MHTML -> text -> chunks -> embeddings
   * @param {ArrayBuffer} mhtmlData - MHTML array buffer
   * @param {string} url - Page URL
   * @param {string} title - Page title
   * @param {string} pageId - Page ID (optional, will be generated if not provided)
   * @returns {Object} Processing result
   */
  async processPageInternal(mhtmlData, url, title, pageId) {
    try {
      // Validate inputs
      if (!mhtmlData) {
        throw new Error('No MHTML data provided');
      }
      if (!url || !title) {
        throw new Error('Missing URL or title');
      }

      // Extract text from MHTML
      const textContent = await this.processMHTML(mhtmlData);

      if (!textContent || textContent.length === 0) {
        throw new Error('No text content extracted from MHTML');
      }

      // Chunk the text
      const chunks = this.chunkText(textContent);

      if (chunks.length === 0) {
        throw new Error('No chunks created from text content');
      }

      // Compute embeddings
      const embeddings = await this.computeEmbeddings(chunks);

      if (embeddings.length !== chunks.length) {
        throw new Error(
          `Embedding count mismatch: ${embeddings.length} embeddings for ${chunks.length} chunks`
        );
      }

      // Use provided pageId or generate one
      const finalPageId = pageId || this.generatePageId(url);

      return {
        pageId: finalPageId,
        url,
        title,
        chunks,
        embeddings,
        timestamp: Date.now(),
        dimensions: embeddings[0]?.length || 384,
      };
    } catch (error) {
      console.error('Failed to process page:', error);
      throw error;
    }
  }

  /**
   * Generate unique page ID
   * @param {string} url - Page URL
   * @returns {string} Unique page ID
   */
  generatePageId(url) {
    // Simple hash-based ID generation
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `page_${Math.abs(hash)}_${Date.now()}`;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }

    if (this.modelPath) {
      URL.revokeObjectURL(this.modelPath);
      this.modelPath = null;
    }

    this.initialized = false;
    console.log('Offscreen controller cleaned up');
  }
}

// Initialize offscreen controller
const offscreenController = new OffscreenController();
offscreenController.init();

// Expose ORT globally for bundled context
if (typeof window !== 'undefined') {
  window.ort = null; // Will be set when ORT is initialized
}
