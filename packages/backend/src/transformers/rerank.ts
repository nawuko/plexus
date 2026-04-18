import { UnifiedRerankRequest, UnifiedRerankResponse } from '../types/unified';

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

  extractUsage(_eventData: string): undefined {
    return undefined;
  }
}
