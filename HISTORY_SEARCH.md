# History Search - Implementation Documentation

## Overview

A fast, privacy-first search interface for browsing your indexed pages with new-tab styling. Integrated with the Page Indexer's semantic search capabilities, this interface provides both fast baseline text search and AI-powered semantic search with full keyboard navigation and accessibility support.

## Implementation Status

### ✅ Phase 1 - Complete
- [x] Minimal new-tab UI
- [x] Baseline search with <150ms latency
- [x] Detail modal with full page information
- [x] Complete keyboard navigation
- [x] WCAG AA accessibility compliance
- [x] Performance metrics tracking
- [x] Debug panel (add `?debug=1` to URL)
- [x] **Integration with real indexed pages**
- [x] **AI-powered semantic search mode**
- [x] **Automatic fallback between AI and baseline modes**
- [x] **Snippet extraction from semantic search results**

### 🔜 Phase 2 - Enhancements (Planned)
- [ ] Move baseline scoring to Web Worker
- [ ] Query suggestions/typeahead based on indexed content
- [ ] Advanced filtering (by domain, date range, chunk count)
- [ ] Export search results

### 🔜 Phase 4 - Summaries & Polish (Planned)
- [ ] On-demand page summaries in modal
- [ ] A/B testing harness
- [ ] Advanced metrics dashboard
- [ ] Performance optimizations

## Architecture

### Files
- **`history.html`** - UI structure with semantic HTML and ARIA attributes
- **`history.css`** - WCAG AA compliant styling with CSS custom properties
- **`history.js`** - All functionality (search, modal, keyboard nav, data loading)

### Integration with Page Indexer
The History Search interface integrates with the existing Page Indexer extension:
- **Data Source**: Loads indexed pages from `chrome.storage` via background script
- **Baseline Search**: Fast local text matching on titles, URLs, and domains
- **AI Search**: Uses the extension's semantic search (ONNX embeddings) for intelligent ranking
- **Automatic Fallback**: Falls back to baseline search if AI search fails or is unavailable

### Key Components

#### 1. Data Loading
Loads indexed pages from the Page Indexer extension:
- **Real Data**: Fetches pages via `chrome.runtime.sendMessage({ type: 'GET_ALL_PAGES' })`
- **Mock Data**: Falls back to generated data for testing outside extension context
- **Data Conversion**: Converts page metadata to `HistoryEntry` format
- **Empty State**: Shows helpful message when no pages are indexed
- **URL Parameter**: Add `?mock=1` to force mock data mode for testing

#### 2. Search Modes

**Baseline Search** - Fast local text matching:
```javascript
score = 0.6 * textMatch + 0.25 * recency + 0.15 * frequency
```
- **Text Match**: Term matching in title/URL/domain with bonuses for title matches
- **Recency**: Exponential decay with τ = 2 weeks
- **Frequency**: Chunk count (indexed pages treated as 1 visit)
- **Performance**: ~5-10ms average search time

**AI Semantic Search** - Embedding-based search:
- Uses `SEMANTIC_SEARCH` message to background script
- Computes query embedding using all-MiniLM-L6-v2 model
- Finds most similar chunks using cosine similarity
- Groups results by page and shows best matching chunk as snippet
- Automatic fallback to baseline if AI search fails
- **Performance**: ~100-500ms depending on corpus size

#### 3. Modal Component
Displays detailed information:
- Page title
- Full URL (clickable)
- Domain
- Last visited (formatted timestamp)
- Total visit count
- Summary/snippet (when available)
- "Open Page" and "Close" buttons

#### 4. Keyboard Navigation
Full keyboard support:
- **`/`** - Focus search input (from anywhere)
- **`↑/↓`** - Navigate results
- **`Enter`** - Open modal for selected result
- **`Esc`** - Close modal
- **`Tab`** - Cycle through modal elements
- Focus trap within modal
- Proper focus return on modal close

#### 5. Accessibility Features
WCAG AA compliant:
- Semantic HTML with proper headings
- ARIA roles, labels, and live regions
- Screen reader announcements for result counts
- Color contrast ratios > 4.5:1
- Focus indicators visible at all times
- Keyboard-only navigation fully supported
- `.visually-hidden` utility for screen reader content

## Usage

### Basic Usage
1. Load the extension and browse some pages to build your index
2. Open `history.html` from the extension (or navigate to it)
3. Type in the search box to filter indexed pages
4. Toggle between Baseline and AI search modes
5. Use arrow keys to navigate results
6. Press Enter or click to view details
7. Click "Open Page" to visit the URL

### Search Modes
- **Baseline Mode**: Fast text-based search (default)
  - Best for: Quick lookups, exact title/URL matching
  - Speed: <10ms for most queries
- **AI Mode**: Semantic search with embeddings
  - Best for: Conceptual queries, finding related content
  - Speed: ~100-500ms depending on corpus size
  - Shows snippet from best matching chunk

### Keyboard Shortcuts
- **`/`** - Focus search (works from anywhere)
- **`↑`** - Previous result
- **`↓`** - Next result
- **`Enter`** - View details / Open link
- **`Esc`** - Close modal
- **`Tab`** - Navigate modal buttons

### URL Parameters
- `?debug=1` - Show debug panel with search metrics
- `?mock=1` - Use mock data instead of real indexed pages

## Performance

### Metrics Tracked
- Keystrokes to first result
- Search count
- Click positions (for CTR analysis)
- Search time (stage 1 baseline)

### Benchmarks (5000 items)
- **Data generation**: ~50-100ms
- **Baseline search**: ~5-10ms average
- **Rendering**: ~10-20ms for 100 results
- **Total time to results**: <150ms ✅

## Technical Details

### Scoring Algorithm

```javascript
function baselineScore(entry, q, now = Date.now()) {
  // Tokenize query
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);

  // Text matching (with title bonus)
  const haystack = `${entry.title} ${entry.url} ${entry.domain}`.toLowerCase();
  let textScore = 0;
  for (const term of terms) {
    if (haystack.includes(term)) {
      textScore += 1;
      if (entry.title.toLowerCase().includes(term)) {
        textScore += 0.5; // Title bonus
      }
    }
  }
  textScore = textScore / terms.length; // Normalize

  // Recency score (exponential decay)
  const dt = now - new Date(entry.visitedISO).getTime();
  const recencyScore = Math.exp(-dt / TAU); // TAU = 2 weeks

  // Frequency score (capped)
  const frequencyScore = Math.min(2, entry.visitCount / 10);

  // Weighted combination
  return 0.6 * textScore + 0.25 * recencyScore + 0.15 * frequencyScore;
}
```

### Data Structure

```typescript
type HistoryEntry = {
  id: string;              // Unique identifier
  title: string;           // Page title
  url: string;             // Full URL
  domain: string;          // Domain name
  visitedISO: string;      // ISO date of last visit
  visitCount: number;      // Total visit count
  snippet?: string;        // Optional summary
  contentHash?: string;    // Optional content hash
};
```

### State Management
Simple global state:
- `historyData: HistoryEntry[]` - All history entries
- `searchState: { q: string, mode: 'baseline' | 'ai' }` - Current search state
- `selectedIndex: number` - Currently selected result
- `selectedEntry: HistoryEntry | null` - Entry shown in modal
- `metrics: Object` - Performance tracking

## Browser Compatibility

- **Chrome/Edge**: Full support (tested)
- **Firefox**: Should work (untested)
- **Safari**: Should work (untested)

### Requirements
- ES6+ JavaScript support
- CSS Grid and Flexbox
- DOM Level 2 Events
- No external dependencies

## Security

### XSS Prevention
- All user content escaped via `escapeHtml()` before rendering
- No `innerHTML` with unescaped data
- Text content set via `.textContent` where possible

### Privacy
- **Local-only**: All data stays in browser
- **No tracking**: No analytics or external calls
- **No cookies**: No persistent storage (current implementation)
- **Mock data**: Uses generated data (not real browsing history)

## Future Enhancements

### Phase 2: Web Worker
Move scoring to worker to prevent UI blocking:
```javascript
// main → worker
postMessage({ q: 'query', entries: historyData, mode: 'baseline' });

// worker → main
postMessage({ results: [...], timings: { stage1: 5.2 } });
```

### Phase 3: AI Re-ranking
Blend baseline and neural scores:
```javascript
finalScore = 0.6 * neural + 0.3 * baseline + 0.1 * recency
```

Use embeddings:
- Compute query embedding
- Load page embeddings from cache
- Calculate cosine similarity
- Re-rank top 100 from baseline

### Phase 4: Summaries
Generate on-demand summaries:
- Check cache (by contentHash)
- If missing, call summarization API
- Cache result
- Display in modal

## Testing

### Manual Testing Checklist
- [x] Search returns results for various queries
- [x] Keyboard navigation works (/, ↑, ↓, Enter, Esc)
- [x] Modal opens and closes correctly
- [x] Focus trap works in modal
- [x] Accessible via screen reader
- [x] Responsive on mobile sizes
- [x] Color contrast meets WCAG AA
- [x] Performance under 150ms for 5k items

### Automated Testing (TODO)
- Unit tests for scoring algorithm
- Integration tests for search flow
- A11y tests with axe-core
- Performance benchmarks

## Contributing

When adding features:
1. Maintain WCAG AA compliance
2. Test keyboard navigation
3. Update this documentation
4. Check performance impact
5. Add to appropriate phase in roadmap

## License

MIT License - see LICENSE file for details.
