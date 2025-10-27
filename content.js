/**
 * Content Script
 * Triggers page capture on page load and handles status updates
 */

class ContentScript {
  constructor() {
    this.pageUrl = window.location.href;
    this.pageTitle = document.title;
    this.isProcessing = false;
    this.processingStartTime = null;
  }

  /**
   * Initialize the content script
   */
  init() {
    // Only run on http/https pages
    if (!this.isValidPage()) {
      return;
    }

    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.handlePageLoad());
    } else {
      this.handlePageLoad();
    }
  }

  /**
   * Check if page is valid for indexing
   * @returns {boolean} True if page should be indexed
   */
  isValidPage() {
    const url = new URL(this.pageUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  /**
   * Handle page load event
   */
  async handlePageLoad() {
    try {
      // Small delay to ensure page is fully rendered
      await this.delay(1000);

      // Check if page is already being processed
      if (this.isProcessing) {
        return;
      }

      this.isProcessing = true;
      this.processingStartTime = Date.now();

      // Send message to background script to capture page
      const response = await this.sendMessage({
        type: 'CAPTURE_PAGE',
        data: {
          url: this.pageUrl,
          title: this.pageTitle,
        },
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to trigger page capture');
      }
    } catch (error) {
      console.error('Failed to handle page load:', error);
      this.isProcessing = false;
    }
  }

  /**
   * Send message to background script
   * @param {Object} message - Message to send
   * @returns {Promise<Object>} Response from background script
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
   * Handle status updates from background script
   * @param {Object} message - Status message
   */
  handleStatusUpdate(message) {
    const { type, data } = message;

    if (type === 'INDEXING_STATUS') {
      this.handleIndexingStatus(data);
    }
  }

  /**
   * Handle indexing status updates
   * @param {Object} data - Status data
   */
  handleIndexingStatus(data) {
    const { status, error, url } = data;

    // Only handle messages for this page
    if (url !== this.pageUrl) {
      return;
    }

    switch (status) {
      case 'INDEXING_COMPLETE':
        this.handleIndexingComplete();
        break;

      case 'INDEXING_ERROR':
        this.handleIndexingError(error);
        break;

      case 'ALREADY_INDEXED':
        this.handleAlreadyIndexed();
        break;

      case 'CAPTURE_ERROR':
        this.handleCaptureError(error);
        break;

      default:
    }
  }

  /**
   * Handle successful indexing completion
   */
  handleIndexingComplete() {
    const processingTime = Date.now() - this.processingStartTime;

    this.isProcessing = false;
    this.showNotification('Page indexed successfully', 'success');
  }

  /**
   * Handle indexing error
   * @param {string} error - Error message
   */
  handleIndexingError(error) {
    console.error('Indexing failed:', error);
    this.isProcessing = false;
    this.showNotification(`Indexing failed: ${error}`, 'error');
  }

  /**
   * Handle already indexed page
   */
  handleAlreadyIndexed() {
    this.isProcessing = false;
    this.showNotification('Page already indexed', 'info');
  }

  /**
   * Handle capture error
   * @param {string} error - Error message
   */
  handleCaptureError(error) {
    console.error('Page capture failed:', error);
    this.isProcessing = false;
    this.showNotification(`Capture failed: ${error}`, 'error');
  }

  /**
   * Show notification to user
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, info)
   */
  showNotification(message, type = 'info') {
    // Only log to console, no visual notifications
  }

  /**
   * Utility function to add delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current page information
   * @returns {Object} Page information
   */
  getPageInfo() {
    return {
      url: this.pageUrl,
      title: this.pageTitle,
      isProcessing: this.isProcessing,
      processingTime: this.isProcessing ? Date.now() - this.processingStartTime : null,
    };
  }
}

// Create and initialize content script
const contentScript = new ContentScript();

// Initialize when script loads
contentScript.init();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  contentScript.handleStatusUpdate(message);
  sendResponse({ received: true });
});

// Expose content script for debugging
window.offlineIndexer = contentScript;
