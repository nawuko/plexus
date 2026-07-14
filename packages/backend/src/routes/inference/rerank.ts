import { FastifyInstance } from 'fastify';
import { logger } from '../../utils/logger';
import { Dispatcher } from '../../services/dispatch/dispatcher';
import { RerankTransformer } from '../../transformers';
import { UsageStorageService } from '../../services/observability/usage-storage';
import { UsageRecord } from '../../types/usage';
import { getClientIp } from '../../utils/ip';
import { calculateCosts } from '../../utils/calculate-costs';
import { DebugManager } from '../../services/observability/debug-manager';
import { attachKeyAccessPolicy } from '../../utils/auth';

export async function registerRerankRoute(
  fastify: FastifyInstance,
  dispatcher: Dispatcher,
  usageStorage: UsageStorageService
) {
  fastify.post('/v1/rerank', async (request, reply) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    let usageRecord: Partial<UsageRecord> = {
      requestId,
      date: new Date().toISOString(),
      sourceIp: getClientIp(request),
      incomingApiType: 'rerank',
      startTime,
      isStreamed: false,
      responseStatus: 'pending',
    };

    usageStorage.emitStartedAsync(usageRecord);

    try {
      const body = request.body as any;
      usageRecord.incomingModelAlias = body.model;
      usageRecord.apiKey = (request as any).keyName;
      usageRecord.attribution = (request as any).attribution || null;

      usageStorage.emitUpdatedAsync({
        requestId,
        incomingModelAlias: body.model,
        apiKey: (request as any).keyName,
        attribution: (request as any).attribution || null,
      });

      logger.silly('Incoming Rerank Request', body);

      const transformer = new RerankTransformer();
      let unifiedRequest = await transformer.parseRequest(body);
      unifiedRequest.incomingApiType = 'rerank';
      unifiedRequest.originalBody = body;
      unifiedRequest.requestId = requestId;
      unifiedRequest = attachKeyAccessPolicy(request, unifiedRequest);

      DebugManager.getInstance().startLog(requestId, body);

      const unifiedResponse = await dispatcher.dispatchRerank(unifiedRequest);

      usageStorage.emitUpdatedAsync({
        requestId,
        provider: unifiedResponse.plexus?.provider,
        selectedModelName: unifiedResponse.plexus?.model,
        canonicalModelName: unifiedResponse.plexus?.canonicalModel,
      });

      usageRecord.provider = unifiedResponse.plexus?.provider;
      usageRecord.selectedModelName = unifiedResponse.plexus?.model;
      usageRecord.canonicalModelName = unifiedResponse.plexus?.canonicalModel;
      usageRecord.outgoingApiType = unifiedResponse.plexus?.apiType;
      usageRecord.isPassthrough = true;
      usageRecord.tokensInput = unifiedResponse.usage?.prompt_tokens || 0;
      usageRecord.tokensOutput = 0;
      usageRecord.durationMs = Date.now() - startTime;
      usageRecord.responseStatus = 'success';

      const pricing = unifiedResponse.plexus?.pricing;
      const providerDiscount = unifiedResponse.plexus?.providerDiscount;
      calculateCosts(usageRecord, pricing, providerDiscount);

      usageStorage.saveRequest(usageRecord as UsageRecord);

      const formattedResponse = await transformer.formatResponse(unifiedResponse);

      DebugManager.getInstance().addTransformedResponse(requestId, formattedResponse);
      DebugManager.getInstance().flush(requestId);

      return reply.send(formattedResponse);
    } catch (e: any) {
      usageRecord.responseStatus = 'error';
      usageRecord.durationMs = Date.now() - startTime;
      usageRecord.attemptCount = e.routingContext?.attemptCount || usageRecord.attemptCount || 1;
      usageRecord.retryHistory = e.routingContext?.retryHistory || usageRecord.retryHistory || null;
      usageStorage.saveRequest(usageRecord as UsageRecord);

      const errorDetails = {
        apiType: 'rerank',
        ...(e.routingContext || {}),
      };

      usageStorage.saveError(requestId, e, errorDetails);
      DebugManager.getInstance().flush(requestId);
      logger.error('Error processing rerank request', e);

      return reply.code(e.routingContext?.statusCode || 500).send({
        error: { message: e.message, type: 'api_error' },
      });
    }
  });
}
