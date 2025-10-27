/**
 * Settings Script
 * Handles the settings page functionality
 */

class SettingsController {
  constructor() {
    this.settings = {};
    this.stats = {};
  }

  /**
   * Initialize the settings page
   */
  async init() {
    try {
      await this.loadSettings();
      await this.loadStats();
      this.setupEventListeners();
      this.renderSettings();
      this.renderStats();
    } catch (error) {
      console.error('Failed to initialize settings:', error);
      this.showError('Failed to load settings');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Indexing settings
    document.getElementById('autoIndexing').addEventListener('change', e => {
      this.updateSetting('autoIndexing', e.target.checked);
    });

    document.getElementById('chunkSize').addEventListener('change', e => {
      this.updateSetting('chunkSize', parseInt(e.target.value));
    });

    document.getElementById('overlapSize').addEventListener('change', e => {
      this.updateSetting('overlapSize', parseInt(e.target.value));
    });

    // Search settings
    document.getElementById('defaultSearchLimit').addEventListener('change', e => {
      this.updateSetting('defaultSearchLimit', parseInt(e.target.value));
    });

    document.getElementById('enableCaching').addEventListener('change', e => {
      this.updateSetting('enableCaching', e.target.checked);
    });

    // Privacy settings
    document.getElementById('indexPrivatePages').addEventListener('change', e => {
      this.updateSetting('indexPrivatePages', e.target.checked);
    });

    document.getElementById('storePageContent').addEventListener('change', e => {
      this.updateSetting('storePageContent', e.target.checked);
    });

    // Advanced settings
    document.getElementById('enableDebugLogging').addEventListener('change', e => {
      this.updateSetting('enableDebugLogging', e.target.checked);
    });

    document.getElementById('enableVisualization').addEventListener('change', e => {
      this.updateSetting('enableVisualization', e.target.checked);
    });

    // Action buttons
    document.getElementById('refreshStats').addEventListener('click', () => {
      this.refreshStats();
    });

    document.getElementById('exportData').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('clearAllData').addEventListener('click', () => {
      this.clearAllData();
    });
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const response = await this.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success) {
        this.settings = response.data || this.getDefaultSettings();
      } else {
        this.settings = this.getDefaultSettings();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = this.getDefaultSettings();
    }
  }

  /**
   * Get default settings
   * @returns {Object} Default settings
   */
  getDefaultSettings() {
    return {
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
   * Load statistics
   */
  async loadStats() {
    try {
      const response = await this.sendMessage({ type: 'GET_STATS' });
      if (response.success) {
        this.stats = response.data || {};
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  /**
   * Render settings in the UI
   */
  renderSettings() {
    // Indexing settings
    document.getElementById('autoIndexing').checked = this.settings.autoIndexing;
    document.getElementById('chunkSize').value = this.settings.chunkSize;
    document.getElementById('overlapSize').value = this.settings.overlapSize;

    // Search settings
    document.getElementById('defaultSearchLimit').value = this.settings.defaultSearchLimit;
    document.getElementById('enableCaching').checked = this.settings.enableCaching;

    // Privacy settings
    document.getElementById('indexPrivatePages').checked = this.settings.indexPrivatePages;
    document.getElementById('storePageContent').checked = this.settings.storePageContent;

    // Advanced settings
    document.getElementById('enableDebugLogging').checked = this.settings.enableDebugLogging;
    document.getElementById('enableVisualization').checked = this.settings.enableVisualization;
  }

  /**
   * Render statistics
   */
  renderStats() {
    const storage = this.stats.storage || {};
    const opfs = this.stats.opfs || {};
    const model = this.stats.model || {};

    // Storage stats
    document.getElementById('storagePages').textContent = storage.pageCount || 0;
    document.getElementById('storageChunks').textContent = storage.totalChunks || 0;
    document.getElementById('storageSize').textContent = this.formatStorageSize(
      storage.storageUsage || 0
    );
    document.getElementById('opfsUsage').textContent = this.formatStorageSize(opfs.totalSize || 0);

    // Model info
    document.getElementById('modelName').textContent = model.modelName || 'all-MiniLM-L6-v2';
    document.getElementById('modelDims').textContent = model.dimensions || 384;

    // Show detailed model status
    const statusElement = document.getElementById('modelStatus');
    if (model.downloaded) {
      statusElement.textContent = 'Ready';
      statusElement.className = 'info-value status-ready';
    } else if (model.error) {
      statusElement.textContent = `Error: ${model.error}`;
      statusElement.className = 'info-value status-error';
    } else {
      statusElement.textContent = 'Not Downloaded';
      statusElement.className = 'info-value status-not-downloaded';
    }

    document.getElementById('modelSize').textContent = model.size || '~25 MB';
  }

  /**
   * Update a setting
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   */
  async updateSetting(key, value) {
    try {
      this.settings[key] = value;

      const response = await this.sendMessage({
        type: 'UPDATE_SETTING',
        data: { key, value },
      });

      if (!response.success) {
        console.error('Failed to update setting:', response.error);
        this.showError('Failed to update setting');
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
      this.showError('Failed to update setting');
    }
  }

  /**
   * Refresh statistics
   */
  async refreshStats() {
    const button = document.getElementById('refreshStats');
    const originalText = button.textContent;

    button.textContent = 'Refreshing...';
    button.disabled = true;

    try {
      await this.loadStats();
      this.renderStats();
    } catch (error) {
      console.error('Failed to refresh stats:', error);
      this.showError('Failed to refresh statistics');
    } finally {
      button.textContent = originalText;
      button.disabled = false;
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

        this.showSuccess('Data exported successfully');
      } else {
        this.showError('Failed to export data: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      this.showError('Failed to export data');
    }
  }

  /**
   * Clear all data
   */
  async clearAllData() {
    if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      return;
    }

    if (!confirm('This will delete all indexed pages, embeddings, and settings. Continue?')) {
      return;
    }

    try {
      const response = await this.sendMessage({ type: 'CLEAR_ALL_DATA' });

      if (response.success) {
        this.showSuccess('All data cleared successfully');
        await this.refreshStats();
      } else {
        this.showError('Failed to clear data: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to clear data:', error);
      this.showError('Failed to clear data');
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.showMessage(message, 'error');
  }

  /**
   * Show message
   * @param {string} message - Message text
   * @param {string} type - Message type
   */
  showMessage(message, type = 'info') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Style the toast
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 16px',
      borderRadius: '6px',
      color: '#fff',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '1000',
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      transition: 'all 0.3s ease',
    });

    // Set background color based on type
    switch (type) {
      case 'success':
        toast.style.backgroundColor = '#10b981';
        break;
      case 'error':
        toast.style.backgroundColor = '#ef4444';
        break;
      case 'warning':
        toast.style.backgroundColor = '#f59e0b';
        break;
      default:
        toast.style.backgroundColor = '#3b82f6';
    }

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
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
}

// Initialize settings when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const settings = new SettingsController();
  settings.init();
});
