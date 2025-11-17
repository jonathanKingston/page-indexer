// Test setup and global mocks for Chrome extension APIs
import { jest, beforeEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder and TextDecoder for JSDOM
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Chrome Storage API
global.chrome = {
  storage: {
    local: {
      data: {},
      get: function(keys, callback) {
        const result = {};
        if (typeof keys === 'string') {
          keys = [keys];
        }
        if (Array.isArray(keys)) {
          keys.forEach(key => {
            if (key in this.data) {
              result[key] = this.data[key];
            }
          });
        } else if (typeof keys === 'object') {
          Object.keys(keys).forEach(key => {
            result[key] = this.data[key] !== undefined ? this.data[key] : keys[key];
          });
        }
        if (callback) callback(result);
        return Promise.resolve(result);
      },
      set: function(items, callback) {
        Object.assign(this.data, items);
        if (callback) callback();
        return Promise.resolve();
      },
      remove: function(keys, callback) {
        if (typeof keys === 'string') {
          keys = [keys];
        }
        keys.forEach(key => delete this.data[key]);
        if (callback) callback();
        return Promise.resolve();
      },
      clear: function(callback) {
        this.data = {};
        if (callback) callback();
        return Promise.resolve();
      }
    }
  },
  runtime: {
    lastError: null,
    getURL: (path) => `chrome-extension://test-extension-id/${path}`,
    sendMessage: jest.fn((message, callback) => {
      if (callback) callback({ success: true });
      return Promise.resolve({ success: true });
    }),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn((query, callback) => {
      const tabs = [{ id: 1, url: 'https://example.com', title: 'Example' }];
      if (callback) callback(tabs);
      return Promise.resolve(tabs);
    }),
    create: jest.fn((options, callback) => {
      const tab = { id: Date.now(), ...options };
      if (callback) callback(tab);
      return Promise.resolve(tab);
    })
  }
};

// Mock FileSystemDirectoryHandle and OPFS APIs
class MockFileSystemFileHandle {
  constructor(name, content = '') {
    this.name = name;
    this.kind = 'file';
    this.content = content;
  }

  async createWritable() {
    return {
      write: async (data) => {
        this.content = data;
      },
      close: async () => {}
    };
  }

  async getFile() {
    return new Blob([this.content], { type: 'application/json' });
  }
}

class MockFileSystemDirectoryHandle {
  constructor(name = 'root') {
    this.name = name;
    this.kind = 'directory';
    this.entries = new Map();
  }

  async getFileHandle(name, options = {}) {
    if (!this.entries.has(name) && options.create) {
      this.entries.set(name, new MockFileSystemFileHandle(name));
    }
    if (!this.entries.has(name)) {
      throw new DOMException('File not found', 'NotFoundError');
    }
    return this.entries.get(name);
  }

  async getDirectoryHandle(name, options = {}) {
    if (!this.entries.has(name) && options.create) {
      this.entries.set(name, new MockFileSystemDirectoryHandle(name));
    }
    if (!this.entries.has(name)) {
      throw new DOMException('Directory not found', 'NotFoundError');
    }
    return this.entries.get(name);
  }

  async removeEntry(name, options = {}) {
    if (!this.entries.has(name)) {
      throw new DOMException('Entry not found', 'NotFoundError');
    }
    this.entries.delete(name);
  }

  async *entries() {
    for (const [name, handle] of this.entries) {
      yield [name, handle];
    }
  }

  async *values() {
    for (const handle of this.entries.values()) {
      yield handle;
    }
  }
}

// Mock navigator.storage.getDirectory()
global.navigator = {
  ...global.navigator,
  storage: {
    getDirectory: async () => new MockFileSystemDirectoryHandle()
  }
};

// Export mock classes for use in tests
global.MockFileSystemFileHandle = MockFileSystemFileHandle;
global.MockFileSystemDirectoryHandle = MockFileSystemDirectoryHandle;

// Clear storage before each test
beforeEach(() => {
  global.chrome.storage.local.data = {};
});
