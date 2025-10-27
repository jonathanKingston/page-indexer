/**
 * Side Panel Script
 * Handles the side panel interface with multiple views
 */

class SidePanelController {
  constructor() {
    this.currentView = 'pages';
    this.pages = [];
    this.filteredPages = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.searchResults = [];
    this.embeddingWorker = null;
  }

  /**
   * Initialize the side panel
   */
  async init() {
    try {
      this.setupEventListeners();
      await this.loadInitialData();
      this.showView('pages');
    } catch (error) {
      console.error('Failed to initialize side panel:', error);
      this.showError('Failed to initialize side panel');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        const view = e.currentTarget.dataset.view;
        this.showView(view);
      });
    });

    // Pages view
    document.getElementById('pagesSearch').addEventListener('input', e => {
      this.filterPages(e.target.value);
    });

    document.getElementById('pagesSort').addEventListener('change', e => {
      this.sortPages(e.target.value);
    });

    // Search view
    document.getElementById('searchButton').addEventListener('click', () => {
      this.performSearch();
    });

    document.getElementById('searchQuery').addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });

    // Settings view
    document.getElementById('clearAllData').addEventListener('click', () => {
      this.clearAllData();
    });

    document.getElementById('exportData').addEventListener('click', () => {
      this.exportData();
    });

    // Event delegation for dynamically created buttons
    document.addEventListener('click', e => {
      if (e.target.classList.contains('view-page-btn')) {
        const pageId = e.target.dataset.pageId;
        this.showPageDetail(pageId);
      } else if (e.target.classList.contains('delete-page-btn')) {
        const pageId = e.target.dataset.pageId;
        this.deletePage(pageId);
      } else if (e.target.classList.contains('pagination-btn')) {
        const page = parseInt(e.target.dataset.page);
        this.goToPage(page);
      }
    });

    // Modal
    document.querySelector('.modal-close').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('pageDetailModal').addEventListener('click', e => {
      if (e.target.id === 'pageDetailModal') {
        this.closeModal();
      }
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SWITCH_VIEW') {
        this.showView(message.data.view, message.data.params);
      }
    });
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      // Load pages
      const response = await this.sendMessage({ type: 'GET_ALL_PAGES' });
      if (response.success) {
        this.pages = response.data || [];
        this.filteredPages = [...this.pages];
      } else {
        console.error('Failed to load pages:', response.error);
        this.pages = [];
        this.filteredPages = [];
      }

      // Load settings
      await this.loadSettings();
    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.pages = [];
      this.filteredPages = [];
    }
  }

  /**
   * Show specific view
   * @param {string} view - View to show
   * @param {Object} params - Additional parameters
   */
  showView(view, params = {}) {
    // Hide all views
    document.querySelectorAll('.view-container').forEach(v => {
      v.classList.add('hidden');
    });

    // Remove active class from all tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
    });

    // Show selected view
    const viewElement = document.getElementById(`${view}View`);
    if (viewElement) {
      viewElement.classList.remove('hidden');
    }

    // Activate corresponding tab
    const tabElement = document.querySelector(`[data-view="${view}"]`);
    if (tabElement) {
      tabElement.classList.add('active');
    }

    this.currentView = view;

    // Handle view-specific logic
    switch (view) {
      case 'pages':
        this.renderPagesList();
        break;
      case 'search':
        this.clearSearchResults();
        break;
      case 'settings':
        this.renderSettings();
        break;
    }

    // Handle params
    if (params.pageId) {
      this.showPageDetail(params.pageId);
    }
  }

  /**
   * Render pages list
   */
  renderPagesList() {
    const container = document.getElementById('pagesList');
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageItems = this.filteredPages.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <div>No pages found</div>
        </div>
      `;
      return;
    }

    container.innerHTML = pageItems
      .map(
        page => `
      <div class="page-item" data-page-id="${page.pageId}">
        <img class="page-favicon" src="${this.getFaviconUrl(page.url)}" alt="Favicon">
        <div class="page-content">
          <div class="page-title">${this.escapeHtml(page.title)}</div>
          <div class="page-url">${this.escapeHtml(page.url)}</div>
          <div class="page-meta">
            ${this.formatDate(page.timestamp)} • ${page.chunkCount} chunks
          </div>
        </div>
        <div class="page-actions">
          <button class="btn view-page-btn" data-page-id="${page.pageId}">View</button>
          <button class="btn danger delete-page-btn" data-page-id="${page.pageId}">Delete</button>
        </div>
      </div>
    `
      )
      .join('');

    // Add error handling for favicons after DOM is updated
    container.querySelectorAll('.page-favicon').forEach(img => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
      });
    });

    this.renderPagination();
  }

  /**
   * Filter pages based on search query
   * @param {string} query - Search query
   */
  filterPages(query) {
    if (!query.trim()) {
      this.filteredPages = [...this.pages];
    } else {
      const lowerQuery = query.toLowerCase();
      this.filteredPages = this.pages.filter(
        page =>
          page.title.toLowerCase().includes(lowerQuery) ||
          page.url.toLowerCase().includes(lowerQuery)
      );
    }
    this.currentPage = 1;
    this.renderPagesList();
  }

  /**
   * Sort pages
   * @param {string} sortBy - Sort criteria
   */
  sortPages(sortBy) {
    const [field, direction] = sortBy.split('-');

    this.filteredPages.sort((a, b) => {
      let aVal, bVal;

      switch (field) {
        case 'date':
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'chunks':
          aVal = a.chunkCount;
          bVal = b.chunkCount;
          break;
        default:
          return 0;
      }

      if (direction === 'desc') {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });

    this.renderPagesList();
  }

  /**
   * Render pagination controls
   */
  renderPagination() {
    const totalPages = Math.ceil(this.filteredPages.length / this.itemsPerPage);
    const container = document.getElementById('pagesPagination');

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let paginationHTML = '';

    // Previous button
    paginationHTML += `
      <button class="pagination-btn" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>
        Previous
      </button>
    `;

    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `
        <button class="pagination-btn ${i === this.currentPage ? 'current-page' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    }

    // Next button
    paginationHTML += `
      <button class="pagination-btn" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>
        Next
      </button>
    `;

    container.innerHTML = paginationHTML;
  }

  /**
   * Go to specific page
   * @param {number} page - Page number
   */
  goToPage(page) {
    const totalPages = Math.ceil(this.filteredPages.length / this.itemsPerPage);
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.renderPagesList();
    }
  }

  /**
   * Perform semantic search
   */
  async performSearch() {
    const query = document.getElementById('searchQuery').value.trim();
    const limit = parseInt(document.getElementById('searchLimit').value) || 10;

    if (!query) {
      this.showError('Please enter a search query');
      return;
    }

    try {
      this.showSearchLoading();

      const response = await this.sendMessage({
        type: 'SEMANTIC_SEARCH',
        data: { query, limit },
      });

      if (response.success) {
        this.searchResults = response.data || [];
        this.renderSearchResults();
      } else {
        this.showError(response.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search failed:', error);
      this.showError('Search failed: ' + error.message);
    }
  }

  /**
   * Show search loading state
   */
  showSearchLoading() {
    const container = document.getElementById('searchResults');
    container.innerHTML = `
      <div class="loading">
        Computing embeddings and searching...
      </div>
    `;
  }

  /**
   * Render search results
   */
  renderSearchResults() {
    const container = document.getElementById('searchResults');

    if (this.searchResults.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div>No results found</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.searchResults
      .map(
        result => `
      <div class="search-result">
        <div class="result-header">
          <div class="result-source">
            <a href="${result.pageUrl}" target="_blank">${this.escapeHtml(result.pageTitle)}</a>
          </div>
          <div class="result-similarity">
            ${(result.similarity * 100).toFixed(1)}% match
          </div>
        </div>
        <div class="result-text">
          ${this.escapeHtml(result.chunkText)}
        </div>
        <div class="result-source">
          Chunk ${result.chunkId} • ${this.escapeHtml(result.pageUrl)}
        </div>
      </div>
    `
      )
      .join('');
  }

  /**
   * Clear search results
   */
  clearSearchResults() {
    document.getElementById('searchQuery').value = '';
    document.getElementById('searchResults').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div>Enter a search query to find similar content</div>
      </div>
    `;
  }

  /**
   * Show page detail modal
   * @param {string} pageId - Page ID
   */
  async showPageDetail(pageId) {
    try {
      const response = await this.sendMessage({
        type: 'GET_PAGE_DETAIL',
        data: { pageId },
      });

      if (response.success && response.data) {
        const page = response.data;

        // Validate page data
        if (!page || typeof page !== 'object') {
          this.showError('Invalid page data received');
          return;
        }

        document.getElementById('modalPageTitle').textContent = page.title || 'Unknown Page';

        // Load chunks
        let chunksHTML = '';
        try {
          const chunksResponse = await this.sendMessage({
            type: 'GET_PAGE_CHUNKS',
            data: { pageId },
          });

          if (chunksResponse.success && chunksResponse.data && Array.isArray(chunksResponse.data)) {
            chunksHTML = chunksResponse.data
              .map(chunk => {
                if (!chunk || typeof chunk !== 'object') {
                  return '<div class="chunk-item">Invalid chunk data</div>';
                }
                return `
                <div class="chunk-item">
                  <div class="chunk-header">
                    <strong>Chunk ${chunk.id || 'Unknown'}</strong>
                    <span class="chunk-meta">${chunk.tokenCount || 0} tokens</span>
                  </div>
                  <div class="chunk-text">${this.escapeHtml(chunk.text || 'No text available')}</div>
                </div>
              `;
              })
              .join('');
          } else {
            chunksHTML = '<div class="empty-state">No chunks available</div>';
          }
        } catch (chunksError) {
          console.error('Failed to load chunks:', chunksError);
          chunksHTML = '<div class="empty-state">Failed to load chunks</div>';
        }

        document.getElementById('modalPageContent').innerHTML = `
          <div class="page-detail">
            <div class="page-info">
              <div><strong>URL:</strong> <a href="${page.url || '#'}" target="_blank">${page.url || 'Unknown URL'}</a></div>
              <div><strong>Indexed:</strong> ${this.formatDate(page.timestamp || Date.now())}</div>
              <div><strong>Chunks:</strong> ${page.chunkCount || 0}</div>
              <div><strong>Dimensions:</strong> ${page.dimensions || 384}</div>
            </div>
            <div class="chunks-section">
              <h4>Content Chunks</h4>
              ${chunksHTML}
            </div>
          </div>
        `;

        document.getElementById('pageDetailModal').classList.add('show');
      } else {
        console.error('Failed to load page details:', response.error);
        this.showError(`Failed to load page details: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to show page detail:', error);
      this.showError(`Failed to load page details: ${error.message}`);
    }
  }

  /**
   * Close modal
   */
  closeModal() {
    document.getElementById('pageDetailModal').classList.remove('show');
  }

  /**
   * Delete page
   * @param {string} pageId - Page ID
   */
  async deletePage(pageId) {
    if (!confirm('Are you sure you want to delete this page?')) {
      return;
    }

    try {
      const response = await this.sendMessage({
        type: 'DELETE_PAGE',
        data: { pageId },
      });

      if (response.success) {
        // Remove from local arrays
        this.pages = this.pages.filter(p => p.pageId !== pageId);
        this.filteredPages = this.filteredPages.filter(p => p.pageId !== pageId);
        this.renderPagesList();
      } else {
        this.showError('Failed to delete page');
      }
    } catch (error) {
      console.error('Failed to delete page:', error);
      this.showError('Failed to delete page');
    }
  }

  /**
   * Load settings
   */
  async loadSettings() {
    try {
      const response = await this.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success) {
        const settings = response.data;
        document.getElementById('autoIndexing').checked = settings.autoIndexing !== false;
        document.getElementById('chunkSize').value = settings.chunkSize || 512;
        document.getElementById('overlapSize').value = settings.overlapSize || 50;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Render settings
   */
  renderSettings() {
    // Update storage info
    this.updateStorageInfo();
  }

  /**
   * Update storage information
   */
  async updateStorageInfo() {
    try {
      const response = await this.sendMessage({ type: 'GET_STATS' });
      if (response.success) {
        const stats = response.data;
        document.getElementById('storagePages').textContent = stats.pageCount || 0;
        document.getElementById('storageChunks').textContent = stats.totalChunks || 0;
        document.getElementById('storageSize').textContent = this.formatStorageSize(
          stats.storageUsage || 0
        );
      }
    } catch (error) {
      console.error('Failed to update storage info:', error);
    }
  }

  /**
   * Clear all data
   */
  async clearAllData() {
    if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      return;
    }

    try {
      const response = await this.sendMessage({ type: 'CLEAR_ALL_DATA' });
      if (response.success) {
        this.pages = [];
        this.filteredPages = [];
        this.renderPagesList();
        this.updateStorageInfo();
        alert('All data cleared successfully');
      } else {
        this.showError('Failed to clear data');
      }
    } catch (error) {
      console.error('Failed to clear data:', error);
      this.showError('Failed to clear data');
    }
  }

  /**
   * Export data
   */
  async exportData() {
    try {
      const response = await this.sendMessage({ type: 'EXPORT_DATA' });
      if (response.success) {
        const data = response.data;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `offline-indexer-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        this.showError('Failed to export data');
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      this.showError('Failed to export data');
    }
  }

  /**
   * Send message to background script
   * @param {Object} message - Message to send
   * @returns {Promise<Object>} Response
   */
  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    console.error(message);
    // Could implement a toast notification system here
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format date for display
   * @param {number} timestamp - Timestamp to format
   * @returns {string} Formatted date
   */
  formatDate(timestamp) {
    if (!timestamp) return 'Unknown date';
    return new Date(timestamp).toLocaleString();
  }

  /**
   * Get favicon URL for a page
   * @param {string} url - Page URL
   * @returns {string} Favicon URL
   */
  getFaviconUrl(url) {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
    } catch {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>';
    }
  }

  /**
   * Format storage size for display
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatStorageSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Initialize side panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.sidePanel = new SidePanelController();
  window.sidePanel.init();
});
