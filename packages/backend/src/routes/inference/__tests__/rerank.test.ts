import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import Fastify, { FastifyInstance } from 'fastify';
import { setConfigForTesting } from '../../../config';
import { registerInferenceRoutes } from '../index';
import { Dispatcher } from '../../../services/dispatcher';
import { UsageStorageService } from '../../../services/usage-storage';
import { mock } from 'bun:test';
import { DebugManager } from '../../../services/debug-manager';
import { SelectorFactory } from '../../../services/selectors/factory';

const RERANK_TEST_CONFIG = {
  providers: {
    fireworks: {
      api_key: 'sk-test',
      api_base_url: {
        rerank: 'https://api.fireworks.ai/inference/v1',
      },
      estimateTokens: false,
      disable_cooldown: false,
      useClaudeMasking: false,
      models: {
        'accounts/fireworks/models/qwen3-reranker-8b': {
          type: 'rerank' as const,
          pricing: { source: 'simple' as const, input: 0.00002, output: 0 },
        },
      },
    },
  },
  models: {
    reranker: {
      type: 'rerank' as const,
      priority: 'selector' as const,
      targets: [{ provider: 'fireworks', model: 'accounts/fireworks/models/qwen3-reranker-8b' }],
    },
  },
  keys: {
    'test-key-1': { secret: 'sk-valid-key', comment: 'Test Key' },
  },
  failover: {
    enabled: false,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT'],
  },
  quotas: [],
};

describe('Rerank Endpoint', () => {
  let fastify: FastifyInstance;
  let mockUsageStorage: UsageStorageService;
  let mockDispatcher: Dispatcher;

  beforeEach(async () => {
    setConfigForTesting(RERANK_TEST_CONFIG);
    fastify = Fastify();

    mockDispatcher = {
      dispatch: mock(async () => ({})),
      dispatchEmbeddings: mock(async () => ({})),
      dispatchRerank: mock(async () => ({
        id: 'rerank-123',
        model: 'accounts/fireworks/models/qwen3-reranker-8b',
        usage: {
          prompt_tokens: 8,
          total_tokens: 8,
        },
        results: [
          { index: 1, score: 0.95 },
          { index: 0, score: 0.42 },
        ],
        plexus: {
          provider: 'fireworks',
          model: 'accounts/fireworks/models/qwen3-reranker-8b',
          apiType: 'rerank',
          canonicalModel: 'reranker',
        },
      })),
    } as unknown as Dispatcher;

    mockUsageStorage = {
      saveRequest: mock(),
      saveError: mock(),
      saveDebugLog: mock(),
      updatePerformanceMetrics: mock(),
      emitStartedAsync: mock(),
      emitUpdatedAsync: mock(),
    } as unknown as UsageStorageService;

    DebugManager.getInstance().setStorage(mockUsageStorage);
    SelectorFactory.setUsageStorage(mockUsageStorage);

    await registerInferenceRoutes(fastify, mockDispatcher, mockUsageStorage);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should accept rerank request and return normalized results', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/rerank',
      headers: {
        authorization: 'Bearer sk-valid-key',
        'content-type': 'application/json',
      },
      payload: {
        model: 'reranker',
        query: 'hello',
        documents: ['a', 'b'],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.results).toEqual([
      { index: 1, score: 0.95 },
      { index: 0, score: 0.42 },
    ]);
    expect(body.model).toBe('accounts/fireworks/models/qwen3-reranker-8b');
  });

  it('should track usage correctly for rerank', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/rerank',
      headers: {
        authorization: 'Bearer sk-valid-key',
        'content-type': 'application/json',
      },
      payload: {
        model: 'reranker',
        query: 'hello',
        documents: ['a', 'b'],
      },
    });

    expect(response.statusCode).toBe(200);

    const saveRequestCalls = (mockUsageStorage.saveRequest as any).mock.calls;
    const lastCall = saveRequestCalls[saveRequestCalls.length - 1];

    expect(lastCall[0].incomingApiType).toBe('rerank');
    expect(lastCall[0].tokensInput).toBe(8);
    expect(lastCall[0].tokensOutput).toBe(0);
    expect(lastCall[0].responseStatus).toBe('success');
  });

  it('should handle dispatcher errors gracefully', async () => {
    (mockDispatcher.dispatchRerank as any).mockRejectedValueOnce(new Error('Provider unavailable'));

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/rerank',
      headers: {
        authorization: 'Bearer sk-valid-key',
        'content-type': 'application/json',
      },
      payload: {
        model: 'reranker',
        query: 'hello',
        documents: ['a', 'b'],
      },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error.message).toContain('Provider unavailable');
  });
});
