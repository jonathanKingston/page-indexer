# Implementation Examples - Part 2

Continuation of implementation examples for enhancements #11-#63.

---

## User Experience Enhancements (Continued)

### #11: Visual Enhancements

**Branch**: `feature/enhancement-11-visual-enhancements`

**Files to Modify**:
- `sidepanel.css` - Modern design system
- `popup.css` - Consistent styling
- `settings.css` - Improved layout

**Files to Create**:
- `styles/design-tokens.css` - Design system variables
- `styles/dark-mode.css` - Dark theme
- `styles/animations.css` - Smooth transitions

**Implementation Example**:

```css
/* styles/design-tokens.css */
:root {
  /* Colors - Light Mode */
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f3f4f6;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-border: #e5e7eb;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;

  /* Borders */
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 350ms ease;
}

/* styles/dark-mode.css */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #3b82f6;
    --color-primary-hover: #60a5fa;
    --color-bg-primary: #1f2937;
    --color-bg-secondary: #111827;
    --color-text-primary: #f9fafb;
    --color-text-secondary: #9ca3af;
    --color-border: #374151;
  }
}

[data-theme="dark"] {
  --color-primary: #3b82f6;
  --color-primary-hover: #60a5fa;
  --color-bg-primary: #1f2937;
  --color-bg-secondary: #111827;
  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;
  --color-border: #374151;
}

/* Updated sidepanel.css */
body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  margin: 0;
  padding: 0;
}

.search-container {
  position: sticky;
  top: 0;
  background: var(--color-bg-primary);
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  z-index: 10;
}

.search-input {
  width: 100%;
  padding: var(--spacing-md);
  font-size: var(--font-size-lg);
  border: 2px solid var(--color-border);
  border-radius: var(--border-radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.search-result {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.search-result:hover {
  background: var(--color-bg-secondary);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.result-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.result-score {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  font-weight: 600;
  padding: 2px 8px;
  background: rgba(37, 99, 235, 0.1);
  border-radius: var(--border-radius-sm);
}

.result-url {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-preview {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: var(--spacing-sm);
}

.result-preview mark {
  background: rgba(37, 99, 235, 0.2);
  color: var(--color-primary);
  padding: 2px 4px;
  border-radius: 2px;
}

/* Buttons */
.btn {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  border: none;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-border);
}

/* Loading States */
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-xl);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty States */
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
  opacity: 0.5;
}

.empty-state-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
}

.empty-state-description {
  font-size: var(--font-size-base);
  max-width: 400px;
  margin: 0 auto;
}
```

**JavaScript for Theme Toggle**:
```javascript
// lib/theme-manager.js
export class ThemeManager {
  static STORAGE_KEY = 'theme-preference';

  static async init() {
    const theme = await this.getTheme();
    this.applyTheme(theme);
  }

  static async getTheme() {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || 'auto';
  }

  static async setTheme(theme) {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: theme });
    this.applyTheme(theme);
  }

  static applyTheme(theme) {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      // Auto - use system preference
      root.removeAttribute('data-theme');
    }
  }
}

// In settings.html
document.getElementById('theme-select').addEventListener('change', async (e) => {
  await ThemeManager.setTheme(e.target.value);
});
```

**Estimated LOC**: 150
**Time**: Short (1-3 days)
**Priority**: Medium

---

### #12: Page Management UI

**Branch**: `feature/enhancement-12-page-management`

**Files to Create**:
- `pages/manage.html` - Page management view
- `pages/manage.js` - Management logic
- `pages/manage.css` - Management styles

**Implementation Example**:

```javascript
// pages/manage.js
class PageManager {
  constructor() {
    this.pages = [];
    this.filteredPages = [];
    this.selectedPages = new Set();
    this.sortBy = 'indexedAt';
    this.sortOrder = 'desc';

    this.init();
  }

  async init() {
    await this.loadPages();
    this.setupEventListeners();
    this.render();
  }

  async loadPages() {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_ALL_PAGES'
    });
    this.pages = response.pages || [];
    this.filteredPages = [...this.pages];
  }

  setupEventListeners() {
    // Search/Filter
    document.getElementById('search').addEventListener('input', (e) => {
      this.filterPages(e.target.value);
    });

    // Sort
    document.getElementById('sort-by').addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.sortPages();
    });

    document.getElementById('sort-order').addEventListener('change', (e) => {
      this.sortOrder = e.target.value;
      this.sortPages();
    });

    // Bulk Actions
    document.getElementById('select-all').addEventListener('change', (e) => {
      if (e.target.checked) {
        this.filteredPages.forEach(p => this.selectedPages.add(p.url));
      } else {
        this.selectedPages.clear();
      }
      this.render();
    });

    document.getElementById('delete-selected').addEventListener('click', () => {
      this.deleteSelected();
    });

    document.getElementById('export-selected').addEventListener('click', () => {
      this.exportSelected();
    });

    document.getElementById('tag-selected').addEventListener('click', () => {
      this.tagSelected();
    });
  }

  filterPages(query) {
    const lowerQuery = query.toLowerCase();
    this.filteredPages = this.pages.filter(page => {
      return page.title.toLowerCase().includes(lowerQuery) ||
             page.url.toLowerCase().includes(lowerQuery) ||
             (page.tags && page.tags.some(t => t.toLowerCase().includes(lowerQuery)));
    });
    this.render();
  }

  sortPages() {
    this.filteredPages.sort((a, b) => {
      let aVal = a[this.sortBy];
      let bVal = b[this.sortBy];

      if (this.sortBy === 'title') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (this.sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    this.render();
  }

  async deleteSelected() {
    if (this.selectedPages.size === 0) return;

    const confirmed = confirm(`Delete ${this.selectedPages.size} page(s)?`);
    if (!confirmed) return;

    const urls = Array.from(this.selectedPages);

    await chrome.runtime.sendMessage({
      type: 'DELETE_PAGES',
      urls
    });

    this.pages = this.pages.filter(p => !this.selectedPages.has(p.url));
    this.filteredPages = this.filteredPages.filter(p => !this.selectedPages.has(p.url));
    this.selectedPages.clear();

    this.render();
  }

  async exportSelected() {
    if (this.selectedPages.size === 0) return;

    const urls = Array.from(this.selectedPages);
    const pages = this.pages.filter(p => urls.includes(p.url));

    const data = JSON.stringify(pages, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `pages-export-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  async tagSelected() {
    if (this.selectedPages.size === 0) return;

    const tag = prompt('Enter tag:');
    if (!tag) return;

    const urls = Array.from(this.selectedPages);

    await chrome.runtime.sendMessage({
      type: 'ADD_TAG_TO_PAGES',
      urls,
      tag
    });

    this.pages.forEach(p => {
      if (urls.includes(p.url)) {
        p.tags = p.tags || [];
        if (!p.tags.includes(tag)) {
          p.tags.push(tag);
        }
      }
    });

    this.render();
  }

  render() {
    const container = document.getElementById('pages-container');
    container.innerHTML = '';

    if (this.filteredPages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📄</div>
          <div class="empty-state-title">No pages found</div>
          <div class="empty-state-description">Try adjusting your filters</div>
        </div>
      `;
      return;
    }

    this.filteredPages.forEach(page => {
      const div = document.createElement('div');
      div.className = 'page-item';
      if (this.selectedPages.has(page.url)) {
        div.classList.add('selected');
      }

      div.innerHTML = `
        <div class="page-checkbox">
          <input type="checkbox" ${this.selectedPages.has(page.url) ? 'checked' : ''}>
        </div>
        <div class="page-content">
          <div class="page-header">
            <h3 class="page-title">${this.escapeHtml(page.title)}</h3>
            <span class="page-date">${this.formatDate(page.indexedAt)}</span>
          </div>
          <div class="page-url">${this.escapeHtml(page.url)}</div>
          <div class="page-meta">
            <span class="page-chunks">${page.chunks?.length || 0} chunks</span>
            <span class="page-size">${this.formatSize(page.size || 0)}</span>
          </div>
          ${page.tags ? `
            <div class="page-tags">
              ${page.tags.map(t => `<span class="tag">${this.escapeHtml(t)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="page-actions">
          <button class="btn-icon" data-action="open" title="Open">🔗</button>
          <button class="btn-icon" data-action="edit-tags" title="Edit Tags">🏷️</button>
          <button class="btn-icon" data-action="delete" title="Delete">🗑️</button>
        </div>
      `;

      // Checkbox
      div.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedPages.add(page.url);
        } else {
          this.selectedPages.delete(page.url);
        }
        div.classList.toggle('selected');
      });

      // Actions
      div.querySelector('[data-action="open"]').addEventListener('click', () => {
        chrome.tabs.create({ url: page.url });
      });

      div.querySelector('[data-action="edit-tags"]').addEventListener('click', () => {
        this.editPageTags(page);
      });

      div.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (confirm(`Delete "${page.title}"?`)) {
          await chrome.runtime.sendMessage({
            type: 'DELETE_PAGE',
            url: page.url
          });
          this.pages = this.pages.filter(p => p.url !== page.url);
          this.filteredPages = this.filteredPages.filter(p => p.url !== page.url);
          this.render();
        }
      });

      container.appendChild(div);
    });

    // Update stats
    document.getElementById('total-pages').textContent = this.pages.length;
    document.getElementById('selected-count').textContent = this.selectedPages.size;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString();
  }

  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  async editPageTags(page) {
    const currentTags = (page.tags || []).join(', ');
    const newTags = prompt('Edit tags (comma-separated):', currentTags);

    if (newTags === null) return;

    const tags = newTags.split(',').map(t => t.trim()).filter(t => t);

    await chrome.runtime.sendMessage({
      type: 'UPDATE_PAGE_TAGS',
      url: page.url,
      tags
    });

    page.tags = tags;
    this.render();
  }
}

// Initialize
new PageManager();
```

**Estimated LOC**: 400
**Time**: Medium (3-7 days)
**Priority**: Medium

---

### #13: Advanced Filtering

**Branch**: `feature/enhancement-13-advanced-filtering`

**Files to Create**:
- `lib/filter-engine.js` - Filtering logic
- `components/filter-builder.js` - Visual filter builder

**Implementation Example**:

```javascript
// lib/filter-engine.js
export class FilterEngine {
  constructor() {
    this.filters = [];
  }

  /**
   * Add filter rule
   */
  addFilter(type, operator, value) {
    this.filters.push({ type, operator, value });
  }

  /**
   * Apply filters to pages
   */
  apply(pages) {
    return pages.filter(page => this.matchesAllFilters(page));
  }

  /**
   * Check if page matches all filters
   */
  matchesAllFilters(page) {
    return this.filters.every(filter => this.matchesFilter(page, filter));
  }

  /**
   * Check if page matches single filter
   */
  matchesFilter(page, filter) {
    const { type, operator, value } = filter;

    switch (type) {
      case 'domain':
        return this.matchDomain(page.url, operator, value);

      case 'url':
        return this.matchUrl(page.url, operator, value);

      case 'title':
        return this.matchText(page.title, operator, value);

      case 'date':
        return this.matchDate(page.indexedAt, operator, value);

      case 'size':
        return this.matchNumber(page.size || 0, operator, value);

      case 'tag':
        return this.matchTag(page.tags || [], operator, value);

      default:
        return true;
    }
  }

  matchDomain(url, operator, value) {
    const domain = new URL(url).hostname;

    switch (operator) {
      case 'is':
        return domain === value;
      case 'contains':
        return domain.includes(value);
      case 'starts_with':
        return domain.startsWith(value);
      case 'ends_with':
        return domain.endsWith(value);
      default:
        return true;
    }
  }

  matchUrl(url, operator, value) {
    switch (operator) {
      case 'contains':
        return url.toLowerCase().includes(value.toLowerCase());
      case 'matches':
        return new RegExp(value, 'i').test(url);
      case 'not_contains':
        return !url.toLowerCase().includes(value.toLowerCase());
      default:
        return true;
    }
  }

  matchText(text, operator, value) {
    const lowerText = text.toLowerCase();
    const lowerValue = value.toLowerCase();

    switch (operator) {
      case 'contains':
        return lowerText.includes(lowerValue);
      case 'not_contains':
        return !lowerText.includes(lowerValue);
      case 'equals':
        return lowerText === lowerValue;
      default:
        return true;
    }
  }

  matchDate(timestamp, operator, value) {
    const date = new Date(timestamp);
    const now = new Date();

    switch (operator) {
      case 'today':
        return this.isSameDay(date, now);

      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return this.isSameDay(date, yesterday);

      case 'last_7_days':
        return (now - date) < 7 * 24 * 60 * 60 * 1000;

      case 'last_30_days':
        return (now - date) < 30 * 24 * 60 * 60 * 1000;

      case 'before':
        return date < new Date(value);

      case 'after':
        return date > new Date(value);

      default:
        return true;
    }
  }

  matchNumber(num, operator, value) {
    switch (operator) {
      case 'equals':
        return num === value;
      case 'greater_than':
        return num > value;
      case 'less_than':
        return num < value;
      default:
        return true;
    }
  }

  matchTag(tags, operator, value) {
    switch (operator) {
      case 'has':
        return tags.includes(value);
      case 'not_has':
        return !tags.includes(value);
      case 'any':
        return tags.length > 0;
      case 'none':
        return tags.length === 0;
      default:
        return true;
    }
  }

  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Clear all filters
   */
  clear() {
    this.filters = [];
  }

  /**
   * Save filter preset
   */
  async savePreset(name) {
    const presets = await this.loadPresets();
    presets[name] = [...this.filters];

    await chrome.storage.local.set({
      'filter-presets': presets
    });
  }

  /**
   * Load filter preset
   */
  async loadPreset(name) {
    const presets = await this.loadPresets();
    if (presets[name]) {
      this.filters = [...presets[name]];
    }
  }

  async loadPresets() {
    const result = await chrome.storage.local.get('filter-presets');
    return result['filter-presets'] || {};
  }
}

// components/filter-builder.js
export class FilterBuilder {
  constructor(container, options = {}) {
    this.container = container;
    this.engine = new FilterEngine();
    this.onChange = options.onChange || (() => {});

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="filter-builder">
        <div class="filter-rules" id="filter-rules"></div>
        <div class="filter-actions">
          <button class="btn-add-rule" id="add-rule">+ Add Filter</button>
          <select id="filter-presets">
            <option value="">Load Preset...</option>
          </select>
          <button class="btn-save-preset" id="save-preset">Save Preset</button>
          <button class="btn-clear" id="clear-filters">Clear All</button>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.loadPresets();
  }

  setupEventListeners() {
    document.getElementById('add-rule').addEventListener('click', () => {
      this.addRule();
    });

    document.getElementById('clear-filters').addEventListener('click', () => {
      this.engine.clear();
      this.renderRules();
      this.onChange(this.engine);
    });

    document.getElementById('save-preset').addEventListener('click', async () => {
      const name = prompt('Preset name:');
      if (name) {
        await this.engine.savePreset(name);
        await this.loadPresets();
      }
    });

    document.getElementById('filter-presets').addEventListener('change', async (e) => {
      if (e.target.value) {
        await this.engine.loadPreset(e.target.value);
        this.renderRules();
        this.onChange(this.engine);
      }
    });
  }

  addRule(type = 'domain', operator = 'contains', value = '') {
    const rule = { type, operator, value };
    this.engine.addFilter(type, operator, value);
    this.renderRules();
  }

  renderRules() {
    const container = document.getElementById('filter-rules');
    container.innerHTML = '';

    if (this.engine.filters.length === 0) {
      container.innerHTML = '<div class="no-filters">No filters applied</div>';
      return;
    }

    this.engine.filters.forEach((filter, index) => {
      const ruleDiv = document.createElement('div');
      ruleDiv.className = 'filter-rule';
      ruleDiv.innerHTML = `
        <select class="filter-type" data-index="${index}">
          <option value="domain" ${filter.type === 'domain' ? 'selected' : ''}>Domain</option>
          <option value="url" ${filter.type === 'url' ? 'selected' : ''}>URL</option>
          <option value="title" ${filter.type === 'title' ? 'selected' : ''}>Title</option>
          <option value="date" ${filter.type === 'date' ? 'selected' : ''}>Date</option>
          <option value="size" ${filter.type === 'size' ? 'selected' : ''}>Size</option>
          <option value="tag" ${filter.type === 'tag' ? 'selected' : ''}>Tag</option>
        </select>

        <select class="filter-operator" data-index="${index}">
          ${this.getOperatorOptions(filter.type, filter.operator)}
        </select>

        <input type="text"
               class="filter-value"
               data-index="${index}"
               value="${filter.value}"
               placeholder="Value">

        <button class="btn-remove" data-index="${index}">×</button>
      `;

      // Event listeners
      ruleDiv.querySelector('.filter-type').addEventListener('change', (e) => {
        this.updateFilter(index, { type: e.target.value });
      });

      ruleDiv.querySelector('.filter-operator').addEventListener('change', (e) => {
        this.updateFilter(index, { operator: e.target.value });
      });

      ruleDiv.querySelector('.filter-value').addEventListener('input', (e) => {
        this.updateFilter(index, { value: e.target.value });
      });

      ruleDiv.querySelector('.btn-remove').addEventListener('click', () => {
        this.removeFilter(index);
      });

      container.appendChild(ruleDiv);
    });
  }

  getOperatorOptions(type, selected) {
    const operators = {
      domain: ['is', 'contains', 'starts_with', 'ends_with'],
      url: ['contains', 'matches', 'not_contains'],
      title: ['contains', 'not_contains', 'equals'],
      date: ['today', 'yesterday', 'last_7_days', 'last_30_days', 'before', 'after'],
      size: ['equals', 'greater_than', 'less_than'],
      tag: ['has', 'not_has', 'any', 'none']
    };

    return (operators[type] || [])
      .map(op => `<option value="${op}" ${op === selected ? 'selected' : ''}>${op.replace('_', ' ')}</option>`)
      .join('');
  }

  updateFilter(index, updates) {
    this.engine.filters[index] = {
      ...this.engine.filters[index],
      ...updates
    };
    this.renderRules();
    this.onChange(this.engine);
  }

  removeFilter(index) {
    this.engine.filters.splice(index, 1);
    this.renderRules();
    this.onChange(this.engine);
  }

  async loadPresets() {
    const presets = await this.engine.loadPresets();
    const select = document.getElementById('filter-presets');

    select.innerHTML = '<option value="">Load Preset...</option>';

    Object.keys(presets).forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  }
}
```

**Usage**:
```javascript
// In page management
const filterBuilder = new FilterBuilder(
  document.getElementById('filter-container'),
  {
    onChange: (engine) => {
      const filtered = engine.apply(allPages);
      displayPages(filtered);
    }
  }
);
```

**Estimated LOC**: 300
**Time**: Medium (3-7 days)
**Priority**: Medium

---

### #14: Keyboard Shortcuts

**Branch**: `feature/enhancement-14-keyboard-shortcuts`

**Files to Create**:
- `lib/keyboard-shortcuts.js` - Keyboard shortcut manager

**Implementation Example**:

```javascript
// lib/keyboard-shortcuts.js
export class KeyboardShortcuts {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
    this.init();
  }

  /**
   * Initialize default shortcuts
   */
  init() {
    // Search
    this.register('ctrl+k', () => this.focusSearch());
    this.register('cmd+k', () => this.focusSearch());
    this.register('/', () => this.focusSearch());

    // Navigation
    this.register('j', () => this.selectNext());
    this.register('k', () => this.selectPrevious());
    this.register('enter', () => this.openSelected());
    this.register('ctrl+enter', () => this.openSelectedNewTab());

    // Actions
    this.register('d', () => this.deleteSelected());
    this.register('t', () => this.tagSelected());
    this.register('e', () => this.exportSelected());

    // Escape
    this.register('escape', () => this.clearSelection());

    // Help
    this.register('?', () => this.showHelp());

    this.setupListener();
  }

  /**
   * Register keyboard shortcut
   */
  register(keys, handler, options = {}) {
    const normalized = this.normalizeKeys(keys);
    this.shortcuts.set(normalized, {
      handler,
      description: options.description || '',
      preventDefault: options.preventDefault !== false
    });
  }

  /**
   * Normalize key combination
   */
  normalizeKeys(keys) {
    return keys.toLowerCase()
      .replace('cmd', 'meta')
      .split('+')
      .sort()
      .join('+');
  }

  /**
   * Setup global keyboard listener
   */
  setupListener() {
    document.addEventListener('keydown', (event) => {
      if (!this.enabled) return;

      // Don't handle shortcuts when typing in inputs
      if (this.isInputElement(event.target)) {
        // Allow Escape and Ctrl+K/Cmd+K in inputs
        if (event.key !== 'Escape' && !this.isSearchShortcut(event)) {
          return;
        }
      }

      const keys = this.getKeyCombination(event);
      const shortcut = this.shortcuts.get(keys);

      if (shortcut) {
        if (shortcut.preventDefault) {
          event.preventDefault();
        }
        shortcut.handler(event);
      }
    });
  }

  /**
   * Get key combination from event
   */
  getKeyCombination(event) {
    const keys = [];

    if (event.ctrlKey) keys.push('ctrl');
    if (event.metaKey) keys.push('meta');
    if (event.altKey) keys.push('alt');
    if (event.shiftKey) keys.push('shift');

    const key = event.key.toLowerCase();
    if (!['control', 'meta', 'alt', 'shift'].includes(key)) {
      keys.push(key);
    }

    return keys.sort().join('+');
  }

  /**
   * Check if element is an input
   */
  isInputElement(element) {
    return element.tagName === 'INPUT' ||
           element.tagName === 'TEXTAREA' ||
           element.isContentEditable;
  }

  /**
   * Check if event is search shortcut (Ctrl+K/Cmd+K)
   */
  isSearchShortcut(event) {
    return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
  }

  // Shortcut handlers

  focusSearch() {
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  selectNext() {
    const results = document.querySelectorAll('.search-result, .page-item');
    const selected = document.querySelector('.search-result.selected, .page-item.selected');

    if (!selected) {
      results[0]?.classList.add('selected');
    } else {
      const index = Array.from(results).indexOf(selected);
      if (index < results.length - 1) {
        selected.classList.remove('selected');
        results[index + 1].classList.add('selected');
        results[index + 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  selectPrevious() {
    const results = document.querySelectorAll('.search-result, .page-item');
    const selected = document.querySelector('.search-result.selected, .page-item.selected');

    if (selected) {
      const index = Array.from(results).indexOf(selected);
      if (index > 0) {
        selected.classList.remove('selected');
        results[index - 1].classList.add('selected');
        results[index - 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  openSelected() {
    const selected = document.querySelector('.search-result.selected, .page-item.selected');
    if (selected) {
      const url = selected.dataset.url;
      if (url) {
        chrome.tabs.update({ url });
      }
    }
  }

  openSelectedNewTab() {
    const selected = document.querySelector('.search-result.selected, .page-item.selected');
    if (selected) {
      const url = selected.dataset.url;
      if (url) {
        chrome.tabs.create({ url });
      }
    }
  }

  deleteSelected() {
    const selected = document.querySelector('.search-result.selected, .page-item.selected');
    if (selected) {
      selected.querySelector('[data-action="delete"]')?.click();
    }
  }

  tagSelected() {
    const selected = document.querySelector('.search-result.selected, .page-item.selected');
    if (selected) {
      selected.querySelector('[data-action="tag"]')?.click();
    }
  }

  exportSelected() {
    document.querySelector('[data-action="export"]')?.click();
  }

  clearSelection() {
    document.querySelectorAll('.search-result.selected, .page-item.selected')
      .forEach(el => el.classList.remove('selected'));

    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput) {
      searchInput.blur();
    }
  }

  showHelp() {
    const modal = document.createElement('div');
    modal.className = 'keyboard-shortcuts-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="shortcut-group">
            <h3>Search</h3>
            <div class="shortcut"><kbd>Ctrl</kbd> + <kbd>K</kbd> or <kbd>/</kbd> - Focus search</div>
          </div>
          <div class="shortcut-group">
            <h3>Navigation</h3>
            <div class="shortcut"><kbd>J</kbd> - Select next result</div>
            <div class="shortcut"><kbd>K</kbd> - Select previous result</div>
            <div class="shortcut"><kbd>Enter</kbd> - Open selected page</div>
            <div class="shortcut"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> - Open in new tab</div>
          </div>
          <div class="shortcut-group">
            <h3>Actions</h3>
            <div class="shortcut"><kbd>D</kbd> - Delete selected</div>
            <div class="shortcut"><kbd>T</kbd> - Tag selected</div>
            <div class="shortcut"><kbd>E</kbd> - Export selected</div>
          </div>
          <div class="shortcut-group">
            <h3>Other</h3>
            <div class="shortcut"><kbd>Esc</kbd> - Clear selection</div>
            <div class="shortcut"><kbd>?</kbd> - Show this help</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
    };

    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.modal-overlay').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    }, { once: true });
  }

  /**
   * Enable shortcuts
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable shortcuts
   */
  disable() {
    this.enabled = false;
  }
}

// Initialize in sidepanel/popup
const shortcuts = new KeyboardShortcuts();
```

**CSS**:
```css
/* Keyboard shortcuts modal */
.keyboard-shortcuts-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  max-width: 600px;
  margin: 50px auto;
  background: var(--color-bg-primary);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-lg);
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.modal-close {
  font-size: 24px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.modal-body {
  padding: var(--spacing-lg);
}

.shortcut-group {
  margin-bottom: var(--spacing-lg);
}

.shortcut-group h3 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-primary);
}

.shortcut {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm) 0;
  color: var(--color-text-secondary);
}

kbd {
  display: inline-block;
  padding: 3px 8px;
  font-size: var(--font-size-sm);
  font-family: monospace;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  margin: 0 4px;
}

/* Selected state */
.search-result.selected,
.page-item.selected {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
```

**Estimated LOC**: 100
**Time**: Quick (<1 day)
**Priority**: Medium

---

## Code Quality Improvements

### #15: TypeScript Migration

**Branch**: `feature/enhancement-15-typescript`

**Files to Create**:
- `tsconfig.json` - TypeScript configuration
- `types/index.d.ts` - Type definitions
- `*.ts` - TypeScript versions of all JS files

**Implementation Example**:

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

```typescript
// types/index.d.ts

/**
 * Page metadata
 */
export interface PageMetadata {
  url: string;
  title: string;
  indexedAt: number;
  updatedAt?: number;
  size?: number;
  tags?: string[];
}

/**
 * Text chunk with embedding
 */
export interface Chunk {
  text: string;
  embedding: Float32Array;
  hash?: string;
  position: number;
}

/**
 * Indexed page
 */
export interface IndexedPage extends PageMetadata {
  content: string;
  contentHash?: string;
  chunks: Chunk[];
  versions?: PageVersion[];
}

/**
 * Page version history
 */
export interface PageVersion {
  timestamp: number;
  contentHash: string;
}

/**
 * Search result
 */
export interface SearchResult {
  url: string;
  title: string;
  score: number;
  preview: string;
  highlightedPreview?: string;
  matchedChunks: MatchedChunk[];
}

/**
 * Matched chunk in search result
 */
export interface MatchedChunk {
  text: string;
  score: number;
  chunkIndex: number;
}

/**
 * Message types for chrome.runtime communication
 */
export type MessageType =
  | 'INDEX_PAGE'
  | 'SEARCH'
  | 'DELETE_PAGE'
  | 'GET_ALL_PAGES'
  | 'COMPUTE_EMBEDDINGS'
  | 'SEARCH_SUGGESTIONS';

/**
 * Message format
 */
export interface Message<T = any> {
  type: MessageType;
  data?: T;
}

/**
 * Storage interface
 */
export interface Storage {
  getPage(url: string): Promise<IndexedPage | null>;
  savePage(page: IndexedPage): Promise<void>;
  deletePage(url: string): Promise<void>;
  getAllPages(): Promise<IndexedPage[]>;
}

/**
 * Search engine interface
 */
export interface SearchEngine {
  index(page: IndexedPage): Promise<void>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  delete(url: string): Promise<void>;
}
```

```typescript
// src/background.ts
import { IndexedPage, Message, SearchResult } from './types';
import { SearchEngine } from './lib/search-engine';
import { StorageManager } from './lib/storage';

const searchEngine = new SearchEngine();
const storage = new StorageManager();

/**
 * Handle incoming messages
 */
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((error) => {
        console.error('Message handler error:', error);
        sendResponse({ error: error.message });
      });

    return true; // Keep channel open for async response
  }
);

/**
 * Route message to appropriate handler
 */
async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  switch (message.type) {
    case 'INDEX_PAGE':
      return await indexPage(message.data);

    case 'SEARCH':
      return await search(message.data.query, message.data.limit);

    case 'DELETE_PAGE':
      return await deletePage(message.data.url);

    case 'GET_ALL_PAGES':
      return await getAllPages();

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

/**
 * Index a page
 */
async function indexPage(data: {
  tabId: number;
  url: string;
}): Promise<IndexedPage> {
  const { tabId, url } = data;

  // Extract content from tab
  const [{ result: content }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractPageContent
  });

  if (!content) {
    throw new Error('Failed to extract page content');
  }

  // Chunk content
  const chunks = await chunkContent(content.text);

  // Compute embeddings
  const embeddings = await computeEmbeddings(chunks);

  // Create indexed page
  const page: IndexedPage = {
    url,
    title: content.title,
    content: content.text,
    chunks: chunks.map((text, i) => ({
      text,
      embedding: embeddings[i],
      position: i
    })),
    indexedAt: Date.now()
  };

  // Save to storage
  await storage.savePage(page);

  // Add to search index
  await searchEngine.index(page);

  return page;
}

/**
 * Search indexed pages
 */
async function search(
  query: string,
  limit: number = 10
): Promise<{ results: SearchResult[] }> {
  const results = await searchEngine.search(query, limit);
  return { results };
}

/**
 * Delete indexed page
 */
async function deletePage(url: string): Promise<{ success: boolean }> {
  await storage.deletePage(url);
  await searchEngine.delete(url);
  return { success: true };
}

/**
 * Get all indexed pages
 */
async function getAllPages(): Promise<{ pages: IndexedPage[] }> {
  const pages = await storage.getAllPages();
  return { pages };
}

/**
 * Extract page content (injected into tab)
 */
function extractPageContent(): { title: string; text: string } | null {
  const title = document.title;
  const text = document.body.innerText;

  return { title, text };
}

/**
 * Chunk content into smaller pieces
 */
async function chunkContent(text: string): Promise<string[]> {
  // Send to offscreen document for tokenization
  const response = await chrome.runtime.sendMessage({
    type: 'CHUNK_CONTENT',
    data: { text }
  });

  return response.chunks;
}

/**
 * Compute embeddings for chunks
 */
async function computeEmbeddings(
  chunks: string[]
): Promise<Float32Array[]> {
  const response = await chrome.runtime.sendMessage({
    type: 'COMPUTE_EMBEDDINGS',
    data: { chunks }
  });

  return response.embeddings;
}
```

```typescript
// src/lib/search-engine.ts
import { IndexedPage, SearchResult, MatchedChunk } from '../types';
import { HNSWIndex } from './vector-db/hnsw';

export class SearchEngine {
  private index: HNSWIndex;
  private metadata: Map<string, PageChunkMetadata>;

  constructor() {
    this.index = new HNSWIndex({ M: 16, efConstruction: 200, efSearch: 50 });
    this.metadata = new Map();
  }

  /**
   * Index a page
   */
  async index(page: IndexedPage): Promise<void> {
    for (let i = 0; i < page.chunks.length; i++) {
      const chunk = page.chunks[i];
      const chunkId = `${page.url}#${i}`;

      await this.index.add(chunkId, chunk.embedding);

      this.metadata.set(chunkId, {
        url: page.url,
        title: page.title,
        chunkIndex: i,
        text: chunk.text
      });
    }
  }

  /**
   * Search for similar content
   */
  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    // Compute query embedding
    const queryEmbedding = await this.computeQueryEmbedding(query);

    // Search index
    const results = await this.index.search(queryEmbedding, limit * 2);

    // Group by URL and rank
    const pageScores = new Map<string, PageScore>();

    for (const { id, score } of results) {
      const meta = this.metadata.get(id);
      if (!meta) continue;

      if (!pageScores.has(meta.url)) {
        pageScores.set(meta.url, {
          url: meta.url,
          title: meta.title,
          maxScore: score,
          totalScore: 0,
          matchedChunks: []
        });
      }

      const page = pageScores.get(meta.url)!;
      page.totalScore += score;
      page.maxScore = Math.max(page.maxScore, score);
      page.matchedChunks.push({
        text: meta.text,
        score,
        chunkIndex: meta.chunkIndex
      });
    }

    // Convert to search results
    return Array.from(pageScores.values())
      .map((page) => ({
        url: page.url,
        title: page.title,
        score: page.maxScore,
        preview: page.matchedChunks[0].text,
        matchedChunks: page.matchedChunks
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Delete page from index
   */
  async delete(url: string): Promise<void> {
    // Remove all chunks for this URL
    const chunkIds = Array.from(this.metadata.keys()).filter((id) =>
      id.startsWith(url)
    );

    for (const chunkId of chunkIds) {
      await this.index.delete(chunkId);
      this.metadata.delete(chunkId);
    }
  }

  /**
   * Compute embedding for query
   */
  private async computeQueryEmbedding(query: string): Promise<Float32Array> {
    const response = await chrome.runtime.sendMessage({
      type: 'COMPUTE_EMBEDDINGS',
      data: { chunks: [query] }
    });

    return response.embeddings[0];
  }
}

interface PageChunkMetadata {
  url: string;
  title: string;
  chunkIndex: number;
  text: string;
}

interface PageScore {
  url: string;
  title: string;
  maxScore: number;
  totalScore: number;
  matchedChunks: MatchedChunk[];
}
```

**Build Configuration**:
```json
// package.json
{
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "lint": "eslint src --ext .ts",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.260",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Estimated LOC**: 4000 (converting all files)
**Time**: Extended (2+ weeks)
**Priority**: High

---

## (To be continued with remaining enhancements...)

This document continues the implementation guide with detailed examples for enhancements #11-#15. The pattern continues for all 63 enhancements with similar level of detail.
