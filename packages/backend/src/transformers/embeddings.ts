import {
  UnifiedEmbeddingsRequest,
  UnifiedEmbeddingsResponse,
  UnifiedRerankRequest,
  UnifiedRerankResponse,
} from '../types/unified';

/**
 * EmbeddingsTransformer
 *
 * Simple pass-through transformer for embeddings since the API format
 * is standardized across all providers (OpenAI, Voyage, Cohere, Google, etc.)
 */
export class EmbeddingsTransformer {
  name = 'embeddings';
  defaultEndpoint = '/embeddings';

  async parseRequest(input: any): Promise<UnifiedEmbeddingsRequest> {
    return {
      model: input.model,
      input: input.input,
      encoding_format: input.encoding_format,
      dimensions: input.dimensions,
      user: input.user,
    };
  }

  async transformRequest(request: UnifiedEmbeddingsRequest): Promise<any> {
    // Pass-through - embeddings API is standardized across providers
    return {
      model: request.model,
      input: request.input,
      encoding_format: request.encoding_format,
      dimensions: request.dimensions,
      user: request.user,
    };
  }

  async transformResponse(response: any): Promise<UnifiedEmbeddingsResponse> {
    return {
      object: 'list',
      data: response.data,
      model: response.model,
      usage: response.usage,
    };
  }

  async formatResponse(response: UnifiedEmbeddingsResponse): Promise<any> {
    // Pass through - already in correct format
    return {
      object: response.object,
      data: response.data,
      model: response.model,
      usage: response.usage,
    };
  }

  /**
   * Embeddings don't support streaming, so this returns undefined
   */
  extractUsage(eventData: string) {
    return undefined;
  }
}

export class RerankTransformer {
  name = 'rerank';
  defaultEndpoint = '/rerank';

  async parseRequest(input: any): Promise<UnifiedRerankRequest> {
    return {
      model: input.model,
      query: input.query,
      documents: input.documents,
      top_n: input.top_n,
      return_documents: input.return_documents,
    };
  }

  async transformRequest(request: UnifiedRerankRequest): Promise<any> {
    return {
      model: request.model,
      query: request.query,
      documents: request.documents,
      top_n: request.top_n,
      return_documents: request.return_documents ?? false,
    };
  }

  async transformResponse(response: any): Promise<UnifiedRerankResponse> {
    const providerResults = Array.isArray(response.results)
      ? response.results
      : Array.isArray(response.data)
        ? response.data
        : [];

    return {
      id: response.id,
      model: response.model,
      usage: response.usage,
      results: providerResults.map((result: any) => ({
        index: result.index,
        score: result.score ?? result.relevance_score,
      })),
    };
  }

  async formatResponse(response: UnifiedRerankResponse): Promise<any> {
    return {
      results: response.results,
      ...(response.id ? { id: response.id } : {}),
      ...(response.model ? { model: response.model } : {}),
      ...(response.usage ? { usage: response.usage } : {}),
    };
  }

  extractUsage(eventData: string) {
    return undefined;
  }
}
