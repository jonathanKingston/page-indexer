/**
 * @fileoverview History Search - Baseline MVP
 * Fast, privacy-first browser history search with modal details and keyboard navigation.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * @typedef {Object} HistoryEntry
 * @property {string} id - Unique identifier (pageId)
 * @property {string} title - Page title
 * @property {string} url - Full URL
 * @property {string} domain - Domain name
 * @property {string} visitedISO - ISO date of last visit (indexed timestamp)
 * @property {number} visitCount - Total visit count (always 1 for indexed pages)
 * @property {number} chunkCount - Number of chunks
 * @property {string} [snippet] - Optional summary
 */

/**
 * @typedef {Object} SearchState
 * @property {string} q - Query string
 * @property {'baseline' | 'ai'} mode - Search mode
 */

/**
 * @typedef {Object} SearchResult
 * @property {HistoryEntry[]} results - Matching entries
 * @property {Object} timings - Performance timings
 * @property {number} timings.stage1 - Baseline search time (ms)
 * @property {number} [timings.stage2] - AI search time (ms)
 */

// ============================================================================
// Constants & Configuration
// ============================================================================

const CONFIG = {
  DEBOUNCE_DELAY: 200, // ms
  RECENCY_TAU: 1000 * 60 * 60 * 24 * 14, // 2 weeks
  MAX_RESULTS: 100,
  USE_MOCK_DATA: false, // Set to true to use mock data for testing
  MOCK_DATA_SIZE: 100, // Reduced for faster loading if needed
  WEIGHTS: {
    TEXT: 0.6,
    RECENCY: 0.25,
    FREQUENCY: 0.15,
  },
};

// ============================================================================
// State Management
// ============================================================================

/** @type {HistoryEntry[]} */
let historyData = [];

/** @type {SearchState} */
let searchState = {
  q: '',
  mode: 'baseline',
};

/** @type {number} */
let selectedIndex = -1;

/** @type {HistoryEntry | null} */
let selectedEntry = null;

/** @type {number | null} */
let debounceTimer = null;

/** @type {Object} */
const metrics = {
  keystrokesToFirstResult: 0,
  searchCount: 0,
  clickPositions: [],
};

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  searchInput: /** @type {HTMLInputElement} */ (document.getElementById('search-input')),
  resultsList: /** @type {HTMLUListElement} */ (document.getElementById('results-list')),
  resultsCount: /** @type {HTMLElement} */ (document.getElementById('results-count')),
  resultsInfo: /** @type {HTMLElement} */ (document.getElementById('results-info')),
  loading: /** @type {HTMLElement} */ (document.getElementById('loading')),
  modeToggleBtn: /** @type {HTMLButtonElement} */ (document.getElementById('mode-toggle-btn')),
  modal: /** @type {HTMLElement} */ (document.getElementById('detail-modal')),
  modalTitle: /** @type {HTMLElement} */ (document.getElementById('modal-title')),
  modalUrl: /** @type {HTMLElement} */ (document.getElementById('modal-url')),
  modalDomain: /** @type {HTMLElement} */ (document.getElementById('modal-domain')),
  modalVisited: /** @type {HTMLElement} */ (document.getElementById('modal-visited')),
  modalVisitCount: /** @type {HTMLElement} */ (document.getElementById('modal-visit-count')),
  modalSnippet: /** @type {HTMLElement} */ (document.getElementById('modal-snippet')),
  modalSnippetRow: /** @type {HTMLElement} */ (document.getElementById('modal-snippet-row')),
  modalClose: /** @type {HTMLButtonElement} */ (document.getElementById('modal-close')),
  modalOpenBtn: /** @type {HTMLButtonElement} */ (document.getElementById('modal-open-btn')),
  modalCancelBtn: /** @type {HTMLButtonElement} */ (document.getElementById('modal-cancel-btn')),
  debugPanel: /** @type {HTMLElement} */ (document.getElementById('debug-panel')),
  debugQuery: /** @type {HTMLElement} */ (document.getElementById('debug-query')),
  debugResultsCount: /** @type {HTMLElement} */ (document.getElementById('debug-results-count')),
  debugSearchTime: /** @type {HTMLElement} */ (document.getElementById('debug-search-time')),
  debugMode: /** @type {HTMLElement} */ (document.getElementById('debug-mode')),
};

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load indexed pages from extension storage
 * @returns {Promise<HistoryEntry[]>}
 */
async function loadIndexedPages() {
  try {
    const response = await sendMessage({ type: 'GET_ALL_PAGES' });

    if (!response.success) {
      console.error('Failed to load pages:', response.error);
      return [];
    }

    const pages = response.data || [];

    // Convert page data to HistoryEntry format
    return pages.map(page => {
      const url = new URL(page.url);
      return {
        id: page.pageId,
        title: page.title || 'Untitled',
        url: page.url,
        domain: url.hostname,
        visitedISO: new Date(page.timestamp).toISOString(),
        visitCount: 1, // Indexed pages are considered as 1 visit
        chunkCount: page.chunkCount || 0,
        snippet: undefined, // Can be loaded on demand
      };
    });
  } catch (error) {
    console.error('Failed to load indexed pages:', error);
    return [];
  }
}

/**
 * Send message to background script
 * @param {Object} message - Message to send
 * @returns {Promise<Object>} Response
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      // Not in extension context, reject
      reject(new Error('Not running in extension context'));
      return;
    }

    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ============================================================================
// Mock History Data Generator (for testing outside extension)
// ============================================================================

/**
 * Generates mock history data for testing
 * @param {number} count - Number of entries to generate
 * @returns {HistoryEntry[]}
 */
function generateMockHistory(count) {
  const domains = [
    'github.com', 'stackoverflow.com', 'mdn.mozilla.org', 'news.ycombinator.com',
    'reddit.com', 'twitter.com', 'youtube.com', 'wikipedia.org',
    'dev.to', 'medium.com', 'linkedin.com', 'google.com',
    'aws.amazon.com', 'docs.microsoft.com', 'npmjs.com', 'python.org',
  ];

  const titlePrefixes = [
    'How to', 'Understanding', 'Introduction to', 'Guide to', 'Tutorial:',
    'Best practices for', 'Getting started with', 'Advanced', 'Learn',
    'Complete guide to', 'Tips for', 'Mastering', 'Deep dive into',
  ];

  const topics = [
    'JavaScript', 'Python', 'React', 'Node.js', 'TypeScript', 'CSS',
    'HTML', 'Git', 'Docker', 'Kubernetes', 'AWS', 'Machine Learning',
    'Web Development', 'API Design', 'Database', 'Security', 'Performance',
    'Testing', 'CI/CD', 'DevOps', 'Cloud Computing', 'Microservices',
  ];

  const entries = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const prefix = titlePrefixes[Math.floor(Math.random() * titlePrefixes.length)];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const title = `${prefix} ${topic}`;

    // Generate realistic visit patterns
    const daysAgo = Math.floor(Math.random() * 365); // Within last year
    const visitedDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    const visitCount = Math.max(1, Math.floor(Math.random() * 50));

    // Generate URL path
    const slug = topic.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');
    const pathVariations = [
      `/docs/${slug}`,
      `/questions/${Math.floor(Math.random() * 100000)}/${slug}`,
      `/article/${slug}`,
      `/${slug}`,
      `/wiki/${slug}`,
      `/learn/${slug}`,
    ];
    const path = pathVariations[Math.floor(Math.random() * pathVariations.length)];
    const url = `https://${domain}${path}`;

    entries.push({
      id: `entry-${i}`,
      title,
      url,
      domain,
      visitedISO: visitedDate.toISOString(),
      visitCount,
      snippet: Math.random() > 0.7 ? `A comprehensive resource about ${topic.toLowerCase()} that covers key concepts and practical examples.` : undefined,
      contentHash: `hash-${i}`,
    });
  }

  return entries;
}

// ============================================================================
// Tokenization & Scoring
// ============================================================================

/**
 * Tokenize query string
 * @param {string} q - Query string
 * @returns {string[]}
 */
function tokenize(q) {
  return q
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Calculate baseline score for a history entry
 * @param {HistoryEntry} entry - History entry
 * @param {string} q - Query string
 * @param {number} [now] - Current timestamp
 * @returns {number}
 */
function baselineScore(entry, q, now = Date.now()) {
  if (!q) return 0;

  const terms = tokenize(q);
  if (terms.length === 0) return 0;

  const haystack = `${entry.title} ${entry.url} ${entry.domain}`.toLowerCase();

  // Text match score
  let textScore = 0;
  for (const term of terms) {
    if (haystack.includes(term)) {
      textScore += 1;
      // Bonus for title match
      if (entry.title.toLowerCase().includes(term)) {
        textScore += 0.5;
      }
    }
  }

  // Normalize text score by number of terms
  textScore = textScore / terms.length;

  // Recency score (exponential decay)
  const visitedTime = new Date(entry.visitedISO).getTime();
  const dt = now - visitedTime;
  const recencyScore = Math.exp(-dt / CONFIG.RECENCY_TAU);

  // Frequency score (capped)
  const frequencyScore = Math.min(2, entry.visitCount / 10);

  // Weighted combination
  const finalScore =
    CONFIG.WEIGHTS.TEXT * textScore +
    CONFIG.WEIGHTS.RECENCY * recencyScore +
    CONFIG.WEIGHTS.FREQUENCY * frequencyScore;

  return finalScore;
}

// ============================================================================
// Search Implementation
// ============================================================================

/**
 * Perform baseline search
 * @param {string} q - Query string
 * @returns {SearchResult}
 */
function baselineSearch(q) {
  const start = performance.now();

  if (!q.trim()) {
    // Return recently visited when no query
    const recent = [...historyData]
      .sort((a, b) => new Date(b.visitedISO).getTime() - new Date(a.visitedISO).getTime())
      .slice(0, 20);

    return {
      results: recent,
      timings: {
        stage1: performance.now() - start,
      },
    };
  }

  const now = Date.now();
  const scored = historyData
    .map((entry) => ({
      entry,
      score: baselineScore(entry, q, now),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      // Sort by score (descending), then recency
      if (Math.abs(a.score - b.score) < 0.001) {
        return new Date(b.entry.visitedISO).getTime() - new Date(a.entry.visitedISO).getTime();
      }
      return b.score - a.score;
    })
    .slice(0, CONFIG.MAX_RESULTS)
    .map(({ entry }) => entry);

  return {
    results: scored,
    timings: {
      stage1: performance.now() - start,
    },
  };
}

/**
 * Perform AI-powered semantic search
 * @param {string} q - Query string
 * @returns {Promise<SearchResult>}
 */
async function semanticSearch(q) {
  const start = performance.now();

  if (!q.trim()) {
    // Return recently visited when no query
    const recent = [...historyData]
      .sort((a, b) => new Date(b.visitedISO).getTime() - new Date(a.visitedISO).getTime())
      .slice(0, 20);

    return {
      results: recent,
      timings: {
        stage1: performance.now() - start,
      },
    };
  }

  try {
    const response = await sendMessage({
      type: 'SEMANTIC_SEARCH',
      data: { query: q, limit: CONFIG.MAX_RESULTS },
    });

    if (!response.success) {
      console.error('Semantic search failed, falling back to baseline');
      return baselineSearch(q);
    }

    const semanticResults = response.data || [];

    // Group results by page (may have multiple chunks per page)
    const pageMap = new Map();
    semanticResults.forEach(result => {
      const pageId = result.pageId;
      if (!pageMap.has(pageId)) {
        // Find the corresponding history entry
        const entry = historyData.find(e => e.id === pageId);
        if (entry) {
          pageMap.set(pageId, {
            entry,
            maxSimilarity: result.similarity,
            bestChunk: result.chunkText,
          });
        }
      } else {
        // Update if this chunk has higher similarity
        const existing = pageMap.get(pageId);
        if (result.similarity > existing.maxSimilarity) {
          existing.maxSimilarity = result.similarity;
          existing.bestChunk = result.chunkText;
        }
      }
    });

    // Convert to array and sort by similarity
    const results = Array.from(pageMap.values())
      .sort((a, b) => b.maxSimilarity - a.maxSimilarity)
      .map(({ entry, bestChunk }) => ({
        ...entry,
        snippet: bestChunk ? bestChunk.substring(0, 200) + '...' : undefined,
      }));

    return {
      results,
      timings: {
        stage1: performance.now() - start,
      },
    };
  } catch (error) {
    console.error('Semantic search error, falling back to baseline:', error);
    return baselineSearch(q);
  }
}

/**
 * Perform search based on current mode
 * @param {string} q - Query string
 * @returns {Promise<SearchResult>}
 */
async function search(q) {
  if (searchState.mode === 'ai') {
    return await semanticSearch(q);
  } else {
    return baselineSearch(q);
  }
}

// ============================================================================
// UI Rendering
// ============================================================================

/**
 * Render search results
 * @param {HistoryEntry[]} results - Search results
 */
function renderResults(results) {
  elements.resultsList.innerHTML = '';

  if (results.length === 0) {
    elements.resultsList.innerHTML = `
      <li class="empty-state">
        <div class="empty-state-title">No results found</div>
        <div class="empty-state-text">Try a different search term</div>
      </li>
    `;
    elements.resultsCount.textContent = '';
    return;
  }

  results.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'result-item';
    li.setAttribute('role', 'option');
    li.setAttribute('tabindex', index === 0 ? '0' : '-1');
    li.setAttribute('data-id', entry.id);
    li.setAttribute('data-index', String(index));

    const visitDate = new Date(entry.visitedISO);
    const relativeTime = getRelativeTime(visitDate);

    li.innerHTML = `
      <div class="result-title">${escapeHtml(entry.title)}</div>
      <div class="result-url">${escapeHtml(entry.url)}</div>
      <div class="result-meta">
        <span class="result-meta-item">
          <span aria-label="Last indexed">${relativeTime}</span>
        </span>
        <span class="result-meta-item">
          <span aria-label="Chunk count">${entry.chunkCount} ${entry.chunkCount === 1 ? 'chunk' : 'chunks'}</span>
        </span>
        <span class="result-meta-item">
          <span aria-label="Domain">${escapeHtml(entry.domain)}</span>
        </span>
      </div>
    `;

    li.addEventListener('click', () => {
      metrics.clickPositions.push(index);
      openModal(entry);
    });

    elements.resultsList.appendChild(li);
  });

  // Update results count
  const query = searchState.q;
  if (query) {
    elements.resultsCount.textContent = `Found ${results.length} result${results.length === 1 ? '' : 's'} for "${query}"`;
  } else {
    elements.resultsCount.textContent = 'Recently visited';
  }

  // Reset selection
  selectedIndex = -1;
}

/**
 * Get relative time string
 * @param {Date} date
 * @returns {string}
 */
function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? '' : 's'} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? '' : 's'} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) === 1 ? '' : 's'} ago`;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================================
// Modal Management
// ============================================================================

/**
 * Open modal with entry details
 * @param {HistoryEntry} entry
 */
function openModal(entry) {
  selectedEntry = entry;

  elements.modalTitle.textContent = entry.title;
  elements.modalUrl.textContent = entry.url;
  elements.modalDomain.textContent = entry.domain;
  elements.modalVisited.textContent = new Date(entry.visitedISO).toLocaleString();
  elements.modalVisitCount.textContent = `${entry.chunkCount} ${entry.chunkCount === 1 ? 'chunk' : 'chunks'}`;

  if (entry.snippet) {
    elements.modalSnippet.textContent = entry.snippet;
    elements.modalSnippetRow.hidden = false;
  } else {
    elements.modalSnippetRow.hidden = true;
  }

  elements.modal.hidden = false;
  elements.modalClose.focus();
}

/**
 * Close modal
 */
function closeModal() {
  elements.modal.hidden = true;
  selectedEntry = null;

  // Return focus to search input
  elements.searchInput.focus();
}

/**
 * Open selected entry URL
 */
function openSelectedUrl() {
  if (selectedEntry) {
    window.open(selectedEntry.url, '_blank');
    closeModal();
  }
}

// ============================================================================
// Keyboard Navigation
// ============================================================================

/**
 * Navigate results with keyboard
 * @param {'up' | 'down'} direction
 */
function navigateResults(direction) {
  const items = elements.resultsList.querySelectorAll('.result-item');
  if (items.length === 0) return;

  // Remove previous selection
  if (selectedIndex >= 0 && selectedIndex < items.length) {
    items[selectedIndex].setAttribute('aria-selected', 'false');
    items[selectedIndex].setAttribute('tabindex', '-1');
  }

  // Update index
  if (direction === 'down') {
    selectedIndex = (selectedIndex + 1) % items.length;
  } else {
    selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
  }

  // Apply new selection
  const selectedItem = items[selectedIndex];
  selectedItem.setAttribute('aria-selected', 'true');
  selectedItem.setAttribute('tabindex', '0');
  selectedItem.focus();
  selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * Open currently selected result
 */
function openSelectedResult() {
  const items = elements.resultsList.querySelectorAll('.result-item');
  if (selectedIndex >= 0 && selectedIndex < items.length) {
    const item = items[selectedIndex];
    const id = item.getAttribute('data-id');
    const entry = historyData.find((e) => e.id === id);
    if (entry) {
      metrics.clickPositions.push(selectedIndex);
      openModal(entry);
    }
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle search input
 */
function handleSearchInput() {
  const query = elements.searchInput.value;
  searchState.q = query;

  // Track keystrokes to first result
  if (query.length === 1 && metrics.keystrokesToFirstResult === 0) {
    metrics.keystrokesToFirstResult = 1;
  } else if (query.length > 0) {
    metrics.keystrokesToFirstResult++;
  }

  // Debounce search
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    performSearch();
  }, CONFIG.DEBOUNCE_DELAY);
}

/**
 * Perform search and render results
 */
async function performSearch() {
  try {
    // Show loading indicator for AI search
    if (searchState.mode === 'ai' && searchState.q.trim()) {
      elements.loading.hidden = false;
    }

    const result = await search(searchState.q);
    metrics.searchCount++;

    renderResults(result.results);

    // Update debug panel
    if (!elements.debugPanel.hidden) {
      elements.debugQuery.textContent = searchState.q || '(empty)';
      elements.debugResultsCount.textContent = String(result.results.length);
      elements.debugSearchTime.textContent = `${result.timings.stage1.toFixed(2)}ms`;
      elements.debugMode.textContent = searchState.mode;
    }
  } catch (error) {
    console.error('Search error:', error);
    elements.resultsCount.textContent = 'Search failed. Please try again.';
  } finally {
    elements.loading.hidden = true;
  }
}

/**
 * Toggle search mode
 */
function toggleMode() {
  searchState.mode = searchState.mode === 'baseline' ? 'ai' : 'baseline';
  const isAI = searchState.mode === 'ai';

  elements.modeToggleBtn.setAttribute('aria-pressed', String(isAI));
  elements.modeToggleBtn.querySelector('.mode-label').textContent = isAI ? 'AI' : 'Baseline';
  elements.modeToggleBtn.title = isAI
    ? 'Toggle to baseline search (AI currently enabled)'
    : 'Toggle AI-assisted search (currently disabled)';

  // Re-run search if there's a query
  if (searchState.q) {
    performSearch();
  }
}

// ============================================================================
// Event Listeners
// ============================================================================

// Search input
elements.searchInput.addEventListener('input', handleSearchInput);

// Mode toggle
elements.modeToggleBtn.addEventListener('click', toggleMode);

// Modal controls
elements.modalClose.addEventListener('click', closeModal);
elements.modalCancelBtn.addEventListener('click', closeModal);
elements.modalOpenBtn.addEventListener('click', openSelectedUrl);

// Modal overlay click to close
elements.modal.querySelector('.modal-overlay')?.addEventListener('click', closeModal);

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Focus search with '/'
  if (e.key === '/' && document.activeElement !== elements.searchInput) {
    e.preventDefault();
    elements.searchInput.focus();
    return;
  }

  // Close modal with Escape
  if (e.key === 'Escape') {
    if (!elements.modal.hidden) {
      e.preventDefault();
      closeModal();
      return;
    }
  }

  // Navigate results with arrow keys (when search input is focused)
  if (document.activeElement === elements.searchInput) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateResults('down');
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateResults('up');
      return;
    }
  }

  // Navigate results with arrow keys (when result item is focused)
  if (document.activeElement?.classList.contains('result-item')) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateResults('down');
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateResults('up');
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      openSelectedResult();
      return;
    }
  }

  // Modal keyboard shortcuts
  if (!elements.modal.hidden) {
    if (e.key === 'Enter' && document.activeElement === elements.modalOpenBtn) {
      openSelectedUrl();
    }
  }
});

// Trap focus in modal
elements.modal.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;

  const focusableElements = elements.modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    }
  } else {
    if (document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
});

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the application
 */
async function init() {
  try {
    // Check for debug mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === '1') {
      elements.debugPanel.hidden = false;
    }

    // Check for mock data mode
    const useMock = urlParams.get('mock') === '1' || CONFIG.USE_MOCK_DATA;

    // Load data
    console.log('Loading history data...');
    const start = performance.now();

    if (useMock) {
      // Use mock data for testing
      console.log(`Generating ${CONFIG.MOCK_DATA_SIZE} mock history entries...`);
      historyData = generateMockHistory(CONFIG.MOCK_DATA_SIZE);
      console.log(`Generated ${historyData.length} mock entries in ${(performance.now() - start).toFixed(2)}ms`);
    } else {
      // Load real indexed pages
      try {
        historyData = await loadIndexedPages();
        console.log(`Loaded ${historyData.length} indexed pages in ${(performance.now() - start).toFixed(2)}ms`);

        if (historyData.length === 0) {
          showEmptyState();
        }
      } catch (error) {
        console.error('Failed to load indexed pages, falling back to mock data:', error);
        historyData = generateMockHistory(CONFIG.MOCK_DATA_SIZE);
      }
    }

    // Show initial "Recently Visited"
    await performSearch();

    // Focus search input
    elements.searchInput.focus();

    console.log('History Search initialized');
    console.log('Press "/" to focus search');
    console.log('Use ↑/↓ to navigate results');
    console.log('Press Enter to view details');
    console.log('Add ?debug=1 to URL for debug panel');
    console.log('Add ?mock=1 to URL to use mock data');
  } catch (error) {
    console.error('Failed to initialize:', error);
    showErrorState('Failed to initialize. Please try reloading.');
  }
}

/**
 * Show empty state when no pages are indexed
 */
function showEmptyState() {
  elements.resultsList.innerHTML = `
    <li class="empty-state">
      <div class="empty-state-title">No Pages Indexed Yet</div>
      <div class="empty-state-text">
        Visit some web pages to start building your searchable index.<br>
        The extension will automatically capture and index pages as you browse.<br><br>
        <em>Tip: Add ?mock=1 to the URL to see a demo with mock data.</em>
      </div>
    </li>
  `;
  elements.resultsCount.textContent = '';
}

/**
 * Show error state
 * @param {string} message - Error message
 */
function showErrorState(message) {
  elements.resultsList.innerHTML = `
    <li class="empty-state">
      <div class="empty-state-title">Error</div>
      <div class="empty-state-text">${escapeHtml(message)}</div>
    </li>
  `;
  elements.resultsCount.textContent = '';
}

// Start the application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
