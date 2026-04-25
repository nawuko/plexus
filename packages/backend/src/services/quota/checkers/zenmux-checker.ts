import type { QuotaCheckResult, QuotaWindow, QuotaCheckerConfig } from '../../../types/quota';
import { QuotaChecker } from '../quota-checker';
import { logger } from '../../../utils/logger';

interface ZenmuxQuotaResponse {
  success: boolean;
  data: {
    plan: {
      tier: string;
      amount_usd: number;
      interval: string;
      expires_at: string;
    };
    currency: string;
    base_usd_per_flow: number;
    effective_usd_per_flow: number;
    account_status: string;
    quota_5_hour: {
      usage_percentage: number;
      resets_at: string;
      max_flows: number;
      used_flows: number;
      remaining_flows: number;
      used_value_usd: number;
      max_value_usd: number;
    };
    quota_7_day: {
      usage_percentage: number;
      resets_at: string;
      max_flows: number;
      used_flows: number;
      remaining_flows: number;
      used_value_usd: number;
      max_value_usd: number;
    };
    quota_monthly: {
      max_flows: number;
      max_value_usd: number;
    };
  };
}

const ZENMUX_DEFAULT_ENDPOINT = 'https://zenmux.ai/api/v1/management/subscription/detail';

export class ZenmuxQuotaChecker extends QuotaChecker {
  readonly category = 'rate-limit' as const;
  private endpoint: string;

  constructor(config: QuotaCheckerConfig) {
    super(config);
    this.endpoint = this.getOption<string>('endpoint', ZENMUX_DEFAULT_ENDPOINT);
  }

  async checkQuota(): Promise<QuotaCheckResult> {
    const managementApiKey = this.requireOption<string>('managementApiKey');

    try {
      logger.silly(`[zenmux] Calling ${this.endpoint}`);

      const response = await fetch(this.endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${managementApiKey}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return this.errorResult(new Error(`HTTP ${response.status}: ${response.statusText}`));
      }

      const data: ZenmuxQuotaResponse = await response.json();

      if (!data.success || !data.data) {
        return this.errorResult(new Error('Zenmux API returned unsuccessful response'));
      }

      const { quota_5_hour, quota_7_day } = data.data;
      const windows: QuotaWindow[] = [];

      // 5-hour rolling window
      windows.push(
        this.createWindow(
          'rolling_five_hour',
          quota_5_hour.max_flows,
          quota_5_hour.used_flows,
          quota_5_hour.remaining_flows,
          'points',
          new Date(quota_5_hour.resets_at),
          '5-hour quota'
        )
      );

      // 7-day rolling window
      windows.push(
        this.createWindow(
          'rolling_weekly',
          quota_7_day.max_flows,
          quota_7_day.used_flows,
          quota_7_day.remaining_flows,
          'points',
          new Date(quota_7_day.resets_at),
          '7-day quota'
        )
      );

      return {
        ...this.successResult(windows),
        rawResponse: data,
      };
    } catch (error) {
      return this.errorResult(error as Error);
    }
  }
}
