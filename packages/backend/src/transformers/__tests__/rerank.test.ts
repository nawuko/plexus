import { test, expect, describe } from 'vitest';
import { RerankTransformer } from '../embeddings';

describe('RerankTransformer', () => {
  const transformer = new RerankTransformer();

  describe('parseRequest', () => {
    test('should parse rerank request', async () => {
      const input = {
        model: 'rerank-v1',
        query: 'hello',
        documents: ['a', 'b'],
        top_n: 2,
        return_documents: true,
      };

      const result = await transformer.parseRequest(input);

      expect(result.model).toBe('rerank-v1');
      expect(result.query).toBe('hello');
      expect(result.documents).toEqual(['a', 'b']);
      expect(result.top_n).toBe(2);
      expect(result.return_documents).toBe(true);
    });
  });

  describe('transformRequest', () => {
    test('should force return_documents false by default-compatible formatting', async () => {
      const result = await transformer.transformRequest({
        model: 'rerank-v1',
        query: 'hello',
        documents: ['a', 'b'],
      });

      expect(result.return_documents).toBe(false);
      expect(result.top_n).toBeUndefined();
    });
  });

  describe('transformResponse', () => {
    test('should normalize cohere style results/relevance_score', async () => {
      const result = await transformer.transformResponse({
        id: 'r-1',
        results: [
          { index: 1, relevance_score: 0.9 },
          { index: 0, relevance_score: 0.2 },
        ],
      });

      expect(result.id).toBe('r-1');
      expect(result.results).toEqual([
        { index: 1, score: 0.9 },
        { index: 0, score: 0.2 },
      ]);
    });

    test('should normalize fireworks style data/relevance_score', async () => {
      const result = await transformer.transformResponse({
        model: 'fw-rerank',
        data: [
          { index: 0, relevance_score: 0.8 },
          { index: 2, relevance_score: 0.5 },
        ],
        usage: { prompt_tokens: 7, total_tokens: 7 },
      });

      expect(result.model).toBe('fw-rerank');
      expect(result.usage?.prompt_tokens).toBe(7);
      expect(result.results).toEqual([
        { index: 0, score: 0.8 },
        { index: 2, score: 0.5 },
      ]);
    });
  });

  describe('formatResponse', () => {
    test('should format normalized client response', async () => {
      const result = await transformer.formatResponse({
        id: 'r-1',
        model: 'rerank-v1',
        usage: { prompt_tokens: 4, total_tokens: 4 },
        results: [{ index: 0, score: 0.99 }],
      });

      expect(result).toEqual({
        id: 'r-1',
        model: 'rerank-v1',
        usage: { prompt_tokens: 4, total_tokens: 4 },
        results: [{ index: 0, score: 0.99 }],
      });
    });
  });

  describe('properties', () => {
    test('should have correct name and endpoint', () => {
      expect(transformer.name).toBe('rerank');
      expect(transformer.defaultEndpoint).toBe('/rerank');
    });
  });
});
