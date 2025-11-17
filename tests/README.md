# Integration Tests for Page Indexer

This directory contains comprehensive integration tests for the Chrome offline page indexer extension.

## Test Structure

```
tests/
├── fixtures/           # Sample HTML pages for testing
│   ├── sample-programming.html
│   ├── sample-cooking.html
│   ├── sample-science.html
│   └── sample-minimal.html
├── integration/        # Integration test suites
│   ├── indexing.test.js    # Tests for page indexing pipeline
│   └── search.test.js      # Tests for search functionality
├── mocks/              # Mock implementations (reserved for future use)
├── setup.js            # Test setup and Chrome API mocks
└── README.md           # This file
```

## What's Tested

### Indexing Pipeline (`integration/indexing.test.js`)
- **Text Extraction**: Extracts readable content from HTML using Readability
- **Tokenization**: Converts text to token IDs using WordPiece tokenizer
- **Token-based Chunking**: Splits text into 510-token chunks with 50-token overlap
- **Embedding Generation**: Creates 384-dimensional vectors using ONNX (mocked)
- **Storage Integration**: Stores page metadata and embeddings
- **Error Handling**: Handles edge cases like empty HTML and very long text

### Search Functionality (`integration/search.test.js`)
- **Query Embedding**: Generates embeddings for search queries
- **Cosine Similarity**: Calculates similarity between query and document embeddings
- **Result Ranking**: Orders results by relevance score
- **Top-K Results**: Returns the most relevant results
- **Filtering**: Applies similarity thresholds
- **Grouping**: Groups results by page
- **Performance**: Handles large numbers of pages efficiently

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run only integration tests
npm run test:integration

# Run with coverage
npm test -- --coverage
```

## Test Fixtures

The `fixtures/` directory contains sample HTML pages representing different topics:

- **sample-programming.html**: Article about JavaScript programming
- **sample-cooking.html**: Article about Italian cooking
- **sample-science.html**: Article about quantum physics
- **sample-minimal.html**: Minimal page with little content

These pages are used to test that:
1. Different types of content are indexed correctly
2. Search returns relevant results based on semantic similarity
3. Results from different topics are properly separated

## Mocks and Stubs

### Chrome API Mocks (`setup.js`)
- `chrome.storage.local`: In-memory storage implementation
- `chrome.runtime`: Message passing and extension URLs
- `chrome.tabs`: Tab management
- `navigator.storage.getDirectory()`: OPFS (Origin Private File System) mock

### ONNX Runtime Mock
The tests use a deterministic mock of the ONNX runtime that:
- Generates 384-dimensional embeddings (matching all-MiniLM-L6-v2)
- Creates topic-specific embedding patterns for testing relevance
- Returns normalized vectors (L2 norm = 1.0)

## Key Testing Principles

1. **Deterministic Results**: Mocks generate consistent embeddings for reproducible tests
2. **Topic Separation**: Different topics get distinct embedding patterns to test search relevance
3. **End-to-End Coverage**: Tests cover the full pipeline from HTML to search results
4. **Edge Cases**: Tests handle empty content, very long text, and error conditions
5. **Performance**: Tests verify the system can handle realistic workloads

## Adding New Tests

To add new test cases:

1. **Add fixtures**: Create HTML files in `fixtures/` for new test scenarios
2. **Write tests**: Add test cases to existing test files or create new ones
3. **Update mocks**: Modify `setup.js` if you need additional Chrome API mocks
4. **Run tests**: Verify tests pass with `npm test`

Example test structure:

```javascript
import { describe, test, expect, beforeEach } from '@jest/globals';

describe('New Feature Tests', () => {
  beforeEach(() => {
    // Setup code
  });

  test('should do something specific', () => {
    // Test code
    expect(actual).toBe(expected);
  });
});
```

## Continuous Integration

These tests are designed to run in CI/CD pipelines. They:
- Don't require actual Chrome extension environment
- Use mocks for all browser APIs
- Run quickly (< 30 seconds total)
- Provide clear error messages
- Report coverage metrics

## Troubleshooting

### Tests fail with "module not found"
```bash
npm install
```

### Tests timeout
Increase timeout in `jest.config.js`:
```javascript
testTimeout: 60000  // 60 seconds
```

### Mock embeddings don't match expected patterns
Check that embeddings are normalized (L2 norm = 1.0) in your test setup.

## Future Improvements

- [ ] Add unit tests for individual functions
- [ ] Test OPFS file operations with more detail
- [ ] Add performance benchmarks
- [ ] Test concurrent indexing operations
- [ ] Add visual regression tests for UI components
- [ ] Test offline functionality
- [ ] Add tests for settings persistence
