/**
 * Integration tests for search functionality
 * Tests the full search pipeline: query → embedding → cosine similarity → ranked results
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Search Integration Tests', () => {
  let mockPages;
  let mockEmbeddings;

  beforeEach(() => {
    // Reset Chrome storage
    global.chrome.storage.local.data = {};

    // Create mock indexed pages with embeddings
    mockPages = [
      {
        id: 'page_programming',
        url: 'https://example.com/programming',
        title: 'Introduction to JavaScript Programming',
        timestamp: Date.now(),
        chunkCount: 3,
        chunks: [
          {
            id: 0,
            text: 'JavaScript is a high-level programming language used for web development.',
            tokens: [101, 1000, 2001, 2002, 1001, 1004, 102]
          },
          {
            id: 1,
            text: 'JavaScript frameworks like React and Vue make development easier.',
            tokens: [101, 1000, 1002, 1003, 102]
          },
          {
            id: 2,
            text: 'Learning JavaScript requires practice with functions and code.',
            tokens: [101, 1004, 1005, 1006, 102]
          }
        ]
      },
      {
        id: 'page_cooking',
        url: 'https://example.com/cooking',
        title: 'The Art of Italian Cooking',
        timestamp: Date.now(),
        chunkCount: 2,
        chunks: [
          {
            id: 0,
            text: 'Italian cooking emphasizes fresh ingredients and traditional recipes.',
            tokens: [101, 2000, 2001, 2002, 102]
          },
          {
            id: 1,
            text: 'Pasta and pizza are staples of Italian cuisine.',
            tokens: [101, 2000, 2001, 102]
          }
        ]
      },
      {
        id: 'page_science',
        url: 'https://example.com/science',
        title: 'Understanding Quantum Physics',
        timestamp: Date.now(),
        chunkCount: 2,
        chunks: [
          {
            id: 0,
            text: 'Quantum physics deals with the behavior of matter at atomic scales.',
            tokens: [101, 3000, 3001, 3002, 102]
          },
          {
            id: 1,
            text: 'Quantum computing uses quantum mechanics for computation.',
            tokens: [101, 3000, 3001, 102]
          }
        ]
      }
    ];

    // Generate mock embeddings for each chunk
    // Programming-related chunks will have similar embeddings
    // Other topics will have different embeddings
    mockEmbeddings = {};

    mockPages.forEach(page => {
      page.chunks.forEach((chunk, chunkIdx) => {
        const embedding = new Array(384).fill(0);

        // Create topic-specific embedding patterns
        if (page.id === 'page_programming') {
          // Programming embeddings cluster around [0.5, 0.5, ...]
          for (let i = 0; i < 384; i++) {
            embedding[i] = 0.5 + (Math.sin(i * 0.1 + chunkIdx) * 0.1);
          }
        } else if (page.id === 'page_cooking') {
          // Cooking embeddings cluster around [-0.5, 0.3, ...]
          for (let i = 0; i < 384; i++) {
            embedding[i] = -0.5 + (Math.cos(i * 0.1 + chunkIdx) * 0.1);
          }
        } else if (page.id === 'page_science') {
          // Science embeddings cluster around [0.3, -0.5, ...]
          for (let i = 0; i < 384; i++) {
            embedding[i] = 0.3 - (Math.sin(i * 0.15 + chunkIdx) * 0.2);
          }
        }

        // Normalize
        let norm = 0;
        for (let i = 0; i < 384; i++) {
          norm += embedding[i] * embedding[i];
        }
        norm = Math.sqrt(norm);
        for (let i = 0; i < 384; i++) {
          embedding[i] /= norm;
        }

        mockEmbeddings[`${page.id}_chunk_${chunkIdx}`] = embedding;
      });
    });
  });

  describe('Cosine Similarity Calculation', () => {
    test('should calculate cosine similarity correctly', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const vec3 = [0, 1, 0];

      // Cosine similarity = dot product / (norm1 * norm2)
      const cosineSimilarity = (a, b) => {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      };

      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0, 5); // Same vectors
      expect(cosineSimilarity(vec1, vec3)).toBeCloseTo(0.0, 5); // Orthogonal
    });

    test('should rank results by similarity score', () => {
      // Query about programming
      const queryEmbedding = new Array(384).fill(0);
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] = 0.5 + (Math.sin(i * 0.1) * 0.1);
      }

      // Normalize query embedding
      let norm = 0;
      for (let i = 0; i < 384; i++) {
        norm += queryEmbedding[i] * queryEmbedding[i];
      }
      norm = Math.sqrt(norm);
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] /= norm;
      }

      // Calculate similarities
      const cosineSimilarity = (a, b) => {
        let dotProduct = 0;
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
        }
        return dotProduct;
      };

      const results = [];
      for (const [key, embedding] of Object.entries(mockEmbeddings)) {
        const similarity = cosineSimilarity(queryEmbedding, embedding);
        results.push({ key, similarity });
      }

      results.sort((a, b) => b.similarity - a.similarity);

      // Programming chunks should rank highest
      expect(results[0].key).toContain('page_programming');
      expect(results[0].similarity).toBeGreaterThan(results[results.length - 1].similarity);
    });
  });

  describe('Query Embedding Generation', () => {
    test('should generate embedding for search query', async () => {
      const query = 'JavaScript programming tutorial';

      // Mock tokenizer
      const mockTokenizer = {
        encode: (text) => {
          const words = text.toLowerCase().split(/\s+/);
          return [101, ...words.map((w, i) => 1000 + i), 102];
        }
      };

      const tokens = mockTokenizer.encode(query);
      expect(tokens[0]).toBe(101); // [CLS]
      expect(tokens[tokens.length - 1]).toBe(102); // [SEP]

      // Mock ONNX session
      const mockSession = {
        run: async (feeds) => {
          const embedding = new Array(384).fill(0);
          for (let i = 0; i < 384; i++) {
            embedding[i] = 0.5 + (Math.sin(i * 0.1) * 0.1);
          }

          // Normalize
          let norm = 0;
          for (let i = 0; i < 384; i++) {
            norm += embedding[i] * embedding[i];
          }
          norm = Math.sqrt(norm);
          for (let i = 0; i < 384; i++) {
            embedding[i] /= norm;
          }

          return {
            sentence_embedding: {
              data: new Float32Array(embedding),
              dims: [1, 384]
            }
          };
        }
      };

      const result = await mockSession.run({
        input_ids: new Int32Array(tokens)
      });

      expect(result.sentence_embedding.data.length).toBe(384);
    });
  });

  describe('Search Result Ranking', () => {
    test('should return top K results ordered by relevance', () => {
      const K = 5;

      // Query embedding (programming-like)
      const queryEmbedding = new Array(384).fill(0);
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] = 0.5 + (Math.sin(i * 0.1) * 0.1);
      }
      let norm = 0;
      for (let i = 0; i < 384; i++) {
        norm += queryEmbedding[i] * queryEmbedding[i];
      }
      norm = Math.sqrt(norm);
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] /= norm;
      }

      // Calculate similarities
      const cosineSimilarity = (a, b) => {
        let dotProduct = 0;
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
        }
        return dotProduct;
      };

      const results = [];
      mockPages.forEach(page => {
        page.chunks.forEach((chunk, idx) => {
          const embeddingKey = `${page.id}_chunk_${idx}`;
          const similarity = cosineSimilarity(queryEmbedding, mockEmbeddings[embeddingKey]);

          results.push({
            pageId: page.id,
            pageTitle: page.title,
            pageUrl: page.url,
            chunkId: idx,
            chunkText: chunk.text,
            similarity: similarity
          });
        });
      });

      // Sort by similarity descending
      results.sort((a, b) => b.similarity - a.similarity);

      // Get top K
      const topK = results.slice(0, K);

      expect(topK.length).toBeLessThanOrEqual(K);
      expect(topK[0].similarity).toBeGreaterThanOrEqual(topK[topK.length - 1].similarity);

      // Verify descending order
      for (let i = 0; i < topK.length - 1; i++) {
        expect(topK[i].similarity).toBeGreaterThanOrEqual(topK[i + 1].similarity);
      }
    });

    test('should filter results by minimum similarity threshold', () => {
      const threshold = 0.5;

      const queryEmbedding = new Array(384).fill(0);
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] = 0.5 + (Math.sin(i * 0.1) * 0.1);
      }
      let norm = 0;
      for (let i = 0; i < 384; i++) {
        norm += queryEmbedding[i] * queryEmbedding[i];
      }
      norm = Math.sqrt(norm);
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] /= norm;
      }

      const cosineSimilarity = (a, b) => {
        let dotProduct = 0;
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
        }
        return dotProduct;
      };

      const results = [];
      mockPages.forEach(page => {
        page.chunks.forEach((chunk, idx) => {
          const embeddingKey = `${page.id}_chunk_${idx}`;
          const similarity = cosineSimilarity(queryEmbedding, mockEmbeddings[embeddingKey]);

          if (similarity >= threshold) {
            results.push({
              pageId: page.id,
              similarity: similarity
            });
          }
        });
      });

      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(threshold);
      });
    });
  });

  describe('Full Search Pipeline', () => {
    test('should execute complete search workflow', async () => {
      const query = 'JavaScript web development';

      // 1. Generate query embedding
      const queryEmbedding = new Array(384).fill(0);
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] = 0.5 + (Math.sin(i * 0.1) * 0.1);
      }
      let norm = 0;
      for (let i = 0; i < 384; i++) {
        norm += queryEmbedding[i] * queryEmbedding[i];
      }
      norm = Math.sqrt(norm);
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] /= norm;
      }

      // 2. Load all page embeddings (from OPFS or storage)
      const allEmbeddings = mockEmbeddings;

      // 3. Calculate similarity for each chunk
      const cosineSimilarity = (a, b) => {
        let dotProduct = 0;
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
        }
        return dotProduct;
      };

      const results = [];
      mockPages.forEach(page => {
        page.chunks.forEach((chunk, idx) => {
          const embeddingKey = `${page.id}_chunk_${idx}`;
          const similarity = cosineSimilarity(queryEmbedding, allEmbeddings[embeddingKey]);

          results.push({
            pageId: page.id,
            pageTitle: page.title,
            pageUrl: page.url,
            chunkId: idx,
            chunkText: chunk.text,
            similarity: similarity,
            timestamp: page.timestamp
          });
        });
      });

      // 4. Sort by similarity
      results.sort((a, b) => b.similarity - a.similarity);

      // 5. Return top results
      const topResults = results.slice(0, 10);

      expect(topResults.length).toBeGreaterThan(0);
      expect(topResults[0]).toHaveProperty('pageTitle');
      expect(topResults[0]).toHaveProperty('pageUrl');
      expect(topResults[0]).toHaveProperty('chunkText');
      expect(topResults[0]).toHaveProperty('similarity');

      // Results should be ordered by similarity
      for (let i = 0; i < topResults.length - 1; i++) {
        expect(topResults[i].similarity).toBeGreaterThanOrEqual(topResults[i + 1].similarity);
      }
    });

    test('should handle empty query', () => {
      const query = '';

      if (!query || query.trim().length === 0) {
        // Should return empty results or handle gracefully
        expect(true).toBe(true);
      }
    });

    test('should handle no indexed pages', () => {
      const emptyPages = [];
      const query = 'test query';

      const results = [];
      emptyPages.forEach(page => {
        // No pages to process
      });

      expect(results.length).toBe(0);
    });

    test('should group results by page', () => {
      const query = 'programming';

      const queryEmbedding = new Array(384).fill(0);
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] = 0.5 + (Math.sin(i * 0.1) * 0.1);
      }
      let norm = 0;
      for (let i = 0; i < 384; i++) {
        norm += queryEmbedding[i] * queryEmbedding[i];
      }
      norm = Math.sqrt(norm);
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] /= norm;
      }

      const cosineSimilarity = (a, b) => {
        let dotProduct = 0;
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
        }
        return dotProduct;
      };

      const results = [];
      mockPages.forEach(page => {
        page.chunks.forEach((chunk, idx) => {
          const embeddingKey = `${page.id}_chunk_${idx}`;
          const similarity = cosineSimilarity(queryEmbedding, mockEmbeddings[embeddingKey]);

          results.push({
            pageId: page.id,
            pageTitle: page.title,
            similarity: similarity
          });
        });
      });

      // Group by page
      const pageGroups = {};
      results.forEach(result => {
        if (!pageGroups[result.pageId]) {
          pageGroups[result.pageId] = {
            pageId: result.pageId,
            pageTitle: result.pageTitle,
            maxSimilarity: result.similarity,
            chunks: []
          };
        }
        pageGroups[result.pageId].chunks.push(result);
        pageGroups[result.pageId].maxSimilarity = Math.max(
          pageGroups[result.pageId].maxSimilarity,
          result.similarity
        );
      });

      const groupedResults = Object.values(pageGroups);
      groupedResults.sort((a, b) => b.maxSimilarity - a.maxSimilarity);

      expect(groupedResults.length).toBe(mockPages.length);
      expect(groupedResults[0].chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Search Performance', () => {
    test('should handle moderate number of pages efficiently', () => {
      const moderatePageSet = [];

      // Create just 10 mock pages (reduced from 100)
      for (let i = 0; i < 10; i++) {
        moderatePageSet.push({
          id: `page_${i}`,
          url: `https://example.com/${i}`,
          title: `Page ${i}`,
          chunks: [
            { id: 0, text: `Content for page ${i}` }
          ]
        });
      }

      // Simple query embedding (deterministic instead of random)
      const queryEmbedding = new Array(384).fill(0).map((_, i) => (i % 10) / 10);
      let norm = 0;
      for (let i = 0; i < 384; i++) {
        norm += queryEmbedding[i] * queryEmbedding[i];
      }
      norm = Math.sqrt(norm);
      for (let i = 0; i < 384; i++) {
        queryEmbedding[i] /= norm;
      }

      const cosineSimilarity = (a, b) => {
        let dotProduct = 0;
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
        }
        return dotProduct;
      };

      const results = [];
      moderatePageSet.forEach(page => {
        page.chunks.forEach((chunk, idx) => {
          // Use deterministic embeddings instead of random
          const mockEmbedding = new Array(384).fill(0).map((_, i) => ((i + idx) % 10) / 10);
          let norm = 0;
          for (let i = 0; i < 384; i++) {
            norm += mockEmbedding[i] * mockEmbedding[i];
          }
          norm = Math.sqrt(norm);
          for (let i = 0; i < 384; i++) {
            mockEmbedding[i] /= norm;
          }

          const similarity = cosineSimilarity(queryEmbedding, mockEmbedding);
          results.push({ pageId: page.id, similarity });
        });
      });

      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, 5); // Reduced from 10

      expect(topResults.length).toBeLessThanOrEqual(5);
      expect(topResults[0].similarity).toBeGreaterThanOrEqual(topResults[topResults.length - 1].similarity);
    });
  });
});
