/**
 * Popup Script
 * Handles the browser action popup interface
 */

class PopupController {
  constructor() {
    this.stats = {
      totalPages: 0,
      totalChunks: 0,
      storageUsage: 0,
    };
    this.recentPages = [];
  }

  /**
   * Initialize the popup
   */
  async init() {
    try {
      await this.loadStats();
      await this.loadRecentPages();
      this.setupEventListeners();
      this.updateUI();
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showError('Failed to load data');
    }
  }

  /**
   * Load statistics from background script
   */
  async loadStats() {
    try {
      const response = await this.sendMessage({
        type: 'GET_STATS',
      });

      if (response.success) {
        this.stats = response.data || this.stats;
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  /**
   * Load recent pages from storage
   */
  async loadRecentPages() {
    try {
      const response = await this.sendMessage({
        type: 'GET_RECENT_PAGES',
        data: { limit: 5 },
      });

      if (response.success) {
        this.recentPages = response.data || [];
      }
    } catch (error) {
      console.error('Failed to load recent pages:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Action buttons
    document.getElementById('viewAllPages').addEventListener('click', () => {
      this.openSidePanel('pages');
    });

    document.getElementById('searchIndex').addEventListener('click', () => {
      this.openSidePanel('search');
    });

    document.getElementById('openSettings').addEventListener('click', () => {
      this.openSidePanel('settings');
    });

    // Recent page items
    const recentPagesList = document.getElementById('recentPagesList');
    recentPagesList.addEventListener('click', event => {
      const pageItem = event.target.closest('.recent-page-item');
      if (pageItem) {
        const pageId = pageItem.dataset.pageId;
        this.openSidePanel('page-detail', { pageId });
      }
    });
  }

  /**
   * Update UI with current data
   */
  updateUI() {
    this.updateStats();
    this.updateRecentPages();
    this.updateStatus();
  }

  /**
   * Update statistics display
   */
  updateStats() {
    document.getElementById('totalPages').textContent = this.stats.totalPages || 0;
    document.getElementById('totalChunks').textContent = this.stats.totalChunks || 0;
    document.getElementById('storageUsage').textContent = this.formatStorageSize(
      this.stats.storageUsage || 0
    );
  }

  /**
   * Update recent pages list
   */
  updateRecentPages() {
    const container = document.getElementById('recentPagesList');

    if (this.recentPages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <div>No pages indexed yet</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.recentPages
      .map(
        page => `
      <div class="recent-page-item" data-page-id="${page.pageId}">
        <img class="page-favicon" src="${this.getFaviconUrl(page.url)}" alt="Favicon">
        <div class="page-info">
          <div class="page-title">${this.escapeHtml(page.title)}</div>
          <div class="page-url">${this.escapeHtml(page.url)}</div>
        </div>
        <div class="page-meta">
          <div>${this.formatDate(page.timestamp)}</div>
          <div>${page.chunkCount} chunks</div>
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
  }

  /**
   * Update status indicator
   */
  updateStatus() {
    const indicator = document.getElementById('statusIndicator');
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.status-text');

    if (this.stats.totalPages > 0) {
      dot.className = 'status-dot';
      text.textContent = 'Active';
    } else {
      dot.className = 'status-dot warning';
      text.textContent = 'No data';
    }
  }

  /**
   * Open side panel with specific view
   * @param {string} view - View to open
   * @param {Object} params - Additional parameters
   */
  openSidePanel(view, params = {}) {
    // For now, just open a new tab with the side panel content
    // This is a workaround until the side panel API is properly supported
    const sidePanelUrl = chrome.runtime.getURL('sidepanel.html');
    chrome.tabs.create({ url: sidePanelUrl });

    // Send message to the new tab to switch view
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'SWITCH_VIEW',
        data: { view, params },
      });
    }, 500);
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const indicator = document.getElementById('statusIndicator');
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.status-text');

    dot.className = 'status-dot error';
    text.textContent = message;
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
   * Format storage size
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatStorageSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Format date
   * @param {number} timestamp - Unix timestamp
   * @returns {string} Formatted date
   */
  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  /**
   * Get favicon URL
   * @param {string} url - Page URL
   * @returns {string} Favicon URL
   */
  getFaviconUrl(url) {
    try {
      const domain = new URL(url).origin;
      return `${domain}/favicon.ico`;
    } catch {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e5e5e5"/></svg>';
    }
  }

  /**
   * Escape HTML
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popup = new PopupController();
  popup.init();
});
